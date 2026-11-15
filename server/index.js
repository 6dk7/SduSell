// SduSell backend: zero-dependency Node HTTP server + SQLite.
// Serves the REST API under /api and the frontend from /public.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db, DATA_DIR, CATEGORIES, CITIES } = require('./db');
const auth = require('./auth');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_BODY = 14 * 1024 * 1024;        // 14 MB request body
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;  // per image after decoding
const MAX_IMAGES = 8;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// ---------- helpers ----------
function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new HttpError(413, 'Request body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

function requireUser(req) {
  const user = auth.getUserFromToken(bearer(req));
  if (!user) throw new HttpError(401, 'Please log in');
  return user;
}

// Simple in-memory rate limiter for login/register
const hits = new Map();
function rateLimit(req, limit = 10, windowMs = 60_000) {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  if (arr.length > limit) throw new HttpError(429, 'Too many attempts, try again in a minute');
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function cleanPhone(v) {
  const s = str(v, 30);
  if (!s) return '';
  const digits = s.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) throw new HttpError(400, 'Phone number looks invalid');
  return (s.startsWith('+') ? '+' : '') + digits;
}

// ---------- images ----------
function saveDataUrl(dataUrl) {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new HttpError(400, 'Images must be PNG, JPEG or WebP');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_IMAGE_BYTES) throw new HttpError(413, 'An image is larger than 3 MB');
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const name = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return `/uploads/${name}`;
}

function resolveImages(list) {
  if (!Array.isArray(list)) return [];
  if (list.length > MAX_IMAGES) throw new HttpError(400, `At most ${MAX_IMAGES} photos`);
  return list.map((item) => {
    if (typeof item !== 'string') throw new HttpError(400, 'Bad image');
    if (item.startsWith('data:')) return saveDataUrl(item);
    if (/^\/uploads\/[a-f0-9]{24}\.(png|jpg|webp)$/.test(item)) return item; // keep existing
    throw new HttpError(400, 'Bad image reference');
  });
}

function deleteUploadFiles(urls) {
  for (const u of urls) {
    const name = path.basename(u);
    if (/^[a-f0-9]{24}\.(png|jpg|webp)$/.test(name)) fs.rm(path.join(UPLOAD_DIR, name), { force: true }, () => {});
  }
}

// ---------- listings ----------
function validateListing(b) {
  const title = str(b.title, 100);
  const description = str(b.description, 4000);
  const price = Number(b.price);
  const category = str(b.category, 50);
  const city = str(b.city, 50);
  const condition = b.condition === 'new' ? 'new' : 'used';
  if (title.length < 3) throw new HttpError(400, 'Title must be at least 3 characters');
  if (!Number.isInteger(price) || price < 0 || price > 10_000_000_000) throw new HttpError(400, 'Price must be a whole number in tenge');
  if (!CATEGORIES.includes(category)) throw new HttpError(400, 'Unknown category');
  if (!CITIES.includes(city)) throw new HttpError(400, 'Unknown city');
  return { title, description, price, category, city, condition, negotiable: b.negotiable ? 1 : 0 };
}

const LISTING_SELECT = `
  SELECT l.id, l.title, l.description, l.price, l.category, l.city, l.condition, l.negotiable,
         l.status, l.views, l.created_at, l.user_id,
         u.name AS seller_name,
         (SELECT url FROM images WHERE listing_id = l.id ORDER BY position LIMIT 1) AS cover,
         EXISTS(SELECT 1 FROM favorites f WHERE f.listing_id = l.id AND f.user_id = ?) AS favorited
  FROM listings l JOIN users u ON u.id = l.user_id`;

function shape(row) {
  return { ...row, negotiable: !!row.negotiable, favorited: !!row.favorited };
}

function listListings(url, viewer) {
  const p = url.searchParams;
  const where = [];
  const params = [viewer ? viewer.id : 0];

  if (p.get('mine') === '1') {
    if (!viewer) throw new HttpError(401, 'Please log in');
    where.push('l.user_id = ?'); params.push(viewer.id);
  } else {
    where.push("l.status = 'active'");
    if (p.get('seller')) { where.push('l.user_id = ?'); params.push(Number(p.get('seller')) || 0); }
  }
  if (p.get('favorites') === '1') {
    if (!viewer) throw new HttpError(401, 'Please log in');
    where.push('EXISTS(SELECT 1 FROM favorites f2 WHERE f2.listing_id = l.id AND f2.user_id = ?)');
    params.push(viewer.id);
  }
  const q = (p.get('q') || '').trim().toLowerCase().slice(0, 100);
  if (q) {
    for (const word of q.split(/\s+/).slice(0, 6)) {
      where.push("l.search_text LIKE ? ESCAPE '\\'");
      params.push(`%${word.replace(/[\\%_]/g, '\\$&')}%`);
    }
  }
  if (p.get('category')) { where.push('l.category = ?'); params.push(p.get('category')); }
  if (p.get('city')) { where.push('l.city = ?'); params.push(p.get('city')); }
  if (p.get('condition') === 'new' || p.get('condition') === 'used') { where.push('l.condition = ?'); params.push(p.get('condition')); }
  if (p.get('min') !== null && p.get('min') !== '' && Number.isFinite(Number(p.get('min')))) { where.push('l.price >= ?'); params.push(Number(p.get('min'))); }
  if (p.get('max') !== null && p.get('max') !== '' && Number.isFinite(Number(p.get('max')))) { where.push('l.price <= ?'); params.push(Number(p.get('max'))); }

  const order = {
    price_asc: 'l.price ASC, l.id DESC',
    price_desc: 'l.price DESC, l.id DESC',
    popular: 'l.views DESC, l.id DESC',
  }[p.get('sort')] || 'l.created_at DESC, l.id DESC';

  const limit = Math.min(Math.max(parseInt(p.get('limit')) || 20, 1), 50);
  const page = Math.max(parseInt(p.get('page')) || 1, 1);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // the first "?" belongs to the favorited subquery in LISTING_SELECT; count query doesn't use it
  const total = db.prepare(`SELECT COUNT(*) AS n FROM listings l ${whereSql}`).get(...params.slice(1)).n;
  const rows = db.prepare(`${LISTING_SELECT} ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit);

  return { items: rows.map(shape), total, page, pages: Math.max(Math.ceil(total / limit), 1) };
}

function getListing(id, viewer) {
  const row = db.prepare(`${LISTING_SELECT} WHERE l.id = ?`).get(viewer ? viewer.id : 0, id);
  if (!row) throw new HttpError(404, 'Listing not found');
  const isOwner = viewer && viewer.id === row.user_id;
  if (row.status !== 'active' && !isOwner) throw new HttpError(404, 'Listing not found');
  const images = db.prepare('SELECT url FROM images WHERE listing_id = ? ORDER BY position').all(id).map((i) => i.url);
  const seller = db.prepare('SELECT id, name, phone, city, created_at FROM users WHERE id = ?').get(row.user_id);
  const activeCount = db.prepare("SELECT COUNT(*) AS n FROM listings WHERE user_id = ? AND status = 'active'").get(row.user_id).n;
  return { ...shape(row), images, seller: { ...seller, active_listings: activeCount } };
}

function discoveryListings(url, viewer) {
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit')) || 20, 1), 50);
  const excluded = (url.searchParams.get('exclude') || '').split(',').filter(Boolean).map(Number);
  if (excluded.length > 100 || excluded.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    throw new HttpError(400, 'Exclude must contain at most 100 listing IDs');
  }
  const viewerId = viewer ? viewer.id : 0;
  const where = ["l.status = 'active'"];
  const params = [];
  if (viewer) {
    where.push('l.user_id != ?'); params.push(viewerId);
    where.push('NOT EXISTS (SELECT 1 FROM favorites f WHERE f.user_id = ? AND f.listing_id = l.id)');
    params.push(viewerId);
    where.push("NOT EXISTS (SELECT 1 FROM discovery_reactions r WHERE r.user_id = ? AND r.listing_id = l.id AND r.reaction = 'pass')");
    params.push(viewerId);
  }
  if (excluded.length) {
    where.push(`l.id NOT IN (${excluded.map(() => '?').join(',')})`);
    params.push(...excluded);
  }
  const base = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS n FROM listings l WHERE ${base}`).get(...params).n;
  const interests = viewer ? db.prepare(`SELECT l.category, COUNT(*) AS score
    FROM favorites f JOIN listings l ON l.id = f.listing_id
    WHERE f.user_id = ? GROUP BY l.category ORDER BY score DESC, l.category`).all(viewerId) : [];
  const select = (condition, extraParams = [], order = 'l.created_at DESC, l.id DESC') => db.prepare(
    `${LISTING_SELECT} WHERE ${base}${condition} ORDER BY ${order} LIMIT ?`
  ).all(viewerId, ...params, ...extraParams, limit);
  let rows;
  if (!interests.length) {
    rows = select('');
  } else {
    const categories = interests.map((i) => i.category);
    const inCategories = `(${categories.map(() => '?').join(',')})`;
    // Three matching cards followed by one different category keeps discovery varied.
    const preferred = select(` AND l.category IN ${inCategories}`, categories,
      `(SELECT COUNT(*) FROM favorites f JOIN listings saved ON saved.id = f.listing_id WHERE f.user_id = ${viewerId} AND saved.category = l.category) DESC, l.created_at DESC, l.id DESC`);
    const explore = select(` AND l.category NOT IN ${inCategories}`, categories);
    rows = [];
    let pi = 0, ei = 0;
    while (rows.length < limit && (pi < preferred.length || ei < explore.length)) {
      if (ei < explore.length && (rows.length % 4 === 3 || pi >= preferred.length)) rows.push(explore[ei++]);
      else rows.push(preferred[pi++]);
    }
  }
  const scores = new Set(interests.map((i) => i.category));
  return {
    items: rows.map((row) => ({ ...shape(row), reason: scores.has(row.category)
      ? `Because you saved ${row.category}` : interests.length ? 'Explore something different' : 'Fresh on SduSell' })),
    has_more: total > rows.length,
    personalized: interests.length > 0,
  };
}

function insertImages(listingId, urls) {
  const ins = db.prepare('INSERT INTO images (listing_id, url, position) VALUES (?, ?, ?)');
  urls.forEach((u, i) => ins.run(listingId, u, i));
}

function ownedListing(id, user) {
  const row = db.prepare('SELECT * FROM listings WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, 'Listing not found');
  if (row.user_id !== user.id) throw new HttpError(403, 'This is not your listing');
  return row;
}

// ---------- routes ----------
const routes = [];
const route = (method, pattern, handler) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler });
};

route('GET', '/api/meta', () => ({ categories: CATEGORIES, cities: CITIES }));

route('POST', '/api/auth/register', async (req) => {
  rateLimit(req);
  const b = await readJson(req);
  const name = str(b.name, 60);
  const email = str(b.email, 120).toLowerCase();
  const password = typeof b.password === 'string' ? b.password : '';
  const city = CITIES.includes(b.city) ? b.city : '';
  if (name.length < 2) throw new HttpError(400, 'Please enter your name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Please enter a valid email');
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  const phone = cleanPhone(b.phone);
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new HttpError(409, 'This email is already registered');
  const info = db.prepare('INSERT INTO users (name, email, phone, city, password_hash) VALUES (?, ?, ?, ?, ?)')
    .run(name, email, phone, city, auth.hashPassword(password));
  const token = auth.createSession(Number(info.lastInsertRowid));
  return { status: 201, body: { token, user: auth.getUserFromToken(token) } };
});

route('POST', '/api/auth/login', async (req) => {
  rateLimit(req);
  const b = await readJson(req);
  const email = str(b.email, 120).toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || typeof b.password !== 'string' || !auth.verifyPassword(b.password, user.password_hash)) {
    throw new HttpError(401, 'Wrong email or password');
  }
  const token = auth.createSession(user.id);
  return { token, user: auth.getUserFromToken(token) };
});

route('POST', '/api/auth/logout', (req) => { auth.destroySession(bearer(req)); return { ok: true }; });

route('GET', '/api/auth/me', (req) => ({ user: requireUser(req) }));

route('PUT', '/api/auth/me', async (req) => {
  const user = requireUser(req);
  const b = await readJson(req);
  const name = str(b.name, 60) || user.name;
  const city = CITIES.includes(b.city) ? b.city : '';
  const phone = cleanPhone(b.phone);
  db.prepare('UPDATE users SET name = ?, phone = ?, city = ? WHERE id = ?').run(name, phone, city, user.id);
  return { user: auth.getUserFromToken(bearer(req)) };
});

route('GET', '/api/listings', (req, _p, url) => listListings(url, auth.getUserFromToken(bearer(req))));

route('GET', '/api/discovery', (req, _p, url) => discoveryListings(url, auth.getUserFromToken(bearer(req))));

route('POST', '/api/discovery/:id/reaction', async (req, p) => {
  const user = requireUser(req);
  const b = await readJson(req);
  if (!b || (b.reaction !== 'like' && b.reaction !== 'pass')) throw new HttpError(400, 'Reaction must be like or pass');
  const id = Number(p.id);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(404, 'Listing not found');
  const listing = db.prepare("SELECT user_id FROM listings WHERE id = ? AND status = 'active'").get(id);
  if (!listing) throw new HttpError(404, 'Listing not found');
  if (listing.user_id === user.id) throw new HttpError(403, 'You cannot react to your own listing');
  db.exec('BEGIN');
  try {
    db.prepare(`INSERT INTO discovery_reactions (user_id, listing_id, reaction) VALUES (?, ?, ?)
      ON CONFLICT(user_id, listing_id) DO UPDATE SET reaction = excluded.reaction`).run(user.id, id, b.reaction);
    if (b.reaction === 'like') db.prepare('INSERT OR IGNORE INTO favorites (user_id, listing_id) VALUES (?, ?)').run(user.id, id);
    db.exec('COMMIT');
  } catch (err) { db.exec('ROLLBACK'); throw err; }
  return { ok: true, reaction: b.reaction, favorited: !!db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND listing_id = ?').get(user.id, id) };
});

route('GET', '/api/listings/:id', (req, p) => {
  const viewer = auth.getUserFromToken(bearer(req));
  const l = getListing(Number(p.id), viewer);
  if (!viewer || viewer.id !== l.user_id) db.prepare('UPDATE listings SET views = views + 1 WHERE id = ?').run(l.id);
  return l;
});

route('POST', '/api/listings', async (req) => {
  const user = requireUser(req);
  const b = await readJson(req);
  const v = validateListing(b);
  const urls = resolveImages(b.images);
  const info = db.prepare(`INSERT INTO listings (user_id, title, description, search_text, price, category, city, condition, negotiable)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(user.id, v.title, v.description, `${v.title} ${v.description}`.toLowerCase(), v.price, v.category, v.city, v.condition, v.negotiable);
  const id = Number(info.lastInsertRowid);
  insertImages(id, urls);
  return { status: 201, body: getListing(id, user) };
});

route('PUT', '/api/listings/:id', async (req, p) => {
  const user = requireUser(req);
  const id = Number(p.id);
  ownedListing(id, user);
  const b = await readJson(req);
  const v = validateListing(b);
  const newUrls = resolveImages(b.images);
  const oldUrls = db.prepare('SELECT url FROM images WHERE listing_id = ?').all(id).map((i) => i.url);
  db.prepare(`UPDATE listings SET title=?, description=?, search_text=?, price=?, category=?, city=?, condition=?, negotiable=? WHERE id=?`)
    .run(v.title, v.description, `${v.title} ${v.description}`.toLowerCase(), v.price, v.category, v.city, v.condition, v.negotiable, id);
  db.prepare('DELETE FROM images WHERE listing_id = ?').run(id);
  insertImages(id, newUrls);
  deleteUploadFiles(oldUrls.filter((u) => !newUrls.includes(u)));
  return getListing(id, user);
});

route('PATCH', '/api/listings/:id/status', async (req, p) => {
  const user = requireUser(req);
  const id = Number(p.id);
  ownedListing(id, user);
  const b = await readJson(req);
  if (b.status !== 'active' && b.status !== 'sold') throw new HttpError(400, 'Status must be active or sold');
  db.prepare('UPDATE listings SET status = ? WHERE id = ?').run(b.status, id);
  return getListing(id, user);
});

route('DELETE', '/api/listings/:id', (req, p) => {
  const user = requireUser(req);
  const id = Number(p.id);
  ownedListing(id, user);
  const urls = db.prepare('SELECT url FROM images WHERE listing_id = ?').all(id).map((i) => i.url);
  db.prepare('DELETE FROM listings WHERE id = ?').run(id);
  deleteUploadFiles(urls);
  return { ok: true };
});

route('POST', '/api/listings/:id/favorite', (req, p) => {
  const user = requireUser(req);
  const id = Number(p.id);
  if (!db.prepare('SELECT 1 FROM listings WHERE id = ?').get(id)) throw new HttpError(404, 'Listing not found');
  db.prepare('INSERT OR IGNORE INTO favorites (user_id, listing_id) VALUES (?, ?)').run(user.id, id);
  return { favorited: true };
});

route('DELETE', '/api/listings/:id/favorite', (req, p) => {
  const user = requireUser(req);
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND listing_id = ?').run(user.id, Number(p.id));
  return { favorited: false };
});

// ---------- static files ----------
function serveFile(res, baseDir, rel, { spaFallback = false } = {}) {
  let file = path.normalize(path.join(baseDir, rel));
  if (!file.startsWith(baseDir + path.sep) && file !== baseDir) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      if (!spaFallback) { res.writeHead(404); return res.end('Not found'); }
      file = path.join(baseDir, 'index.html');
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': baseDir === UPLOAD_DIR ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  });
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (pathname.startsWith('/api/')) {
      const r = routes.find((x) => x.method === req.method && x.re.test(pathname));
      if (!r) {
        const pathMatch = routes.some((x) => x.re.test(pathname));
        throw new HttpError(pathMatch ? 405 : 404, pathMatch ? 'Method not allowed' : 'Unknown API endpoint');
      }
      const m = r.re.exec(pathname);
      const params = Object.fromEntries(r.keys.map((k, i) => [k, m[i + 1]]));
      const out = await r.handler(req, params, url);
      if (out && out.status && out.body) return send(res, out.status, out.body);
      return send(res, 200, out);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    if (pathname.startsWith('/uploads/')) return serveFile(res, UPLOAD_DIR, pathname.slice('/uploads/'.length));
    return serveFile(res, PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname.slice(1), { spaFallback: !path.extname(pathname) });
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error(e);
    return send(res, 500, { error: 'Something went wrong on our side' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`SduSell running at http://localhost:${PORT}`));
}

module.exports = { server };
