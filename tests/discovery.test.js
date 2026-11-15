const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Set the directory before loading the server: never touch the developer's data.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sdusell-discovery-test-'));
process.env.SDUSELL_DATA = directory;
const { server } = require('../server/index');
const { db } = require('../server/db');
const { createSession } = require('../server/auth');
let origin;
let token;

async function request(route, { authenticated = false, body, method = 'GET' } = {}) {
  const headers = {};
  if (authenticated) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${origin}/api${route}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

function listing(id, category = 'Electronics', owner = 2, status = 'active') {
  db.prepare(`INSERT INTO listings
    (id, user_id, title, search_text, price, category, city, status)
    VALUES (?, ?, ?, ?, 1000, ?, 'Almaty', ?)`)
    .run(id, owner, `Test listing ${id}`, `test listing ${id}`, category, status);
}

const reaction = (id, value, authenticated = true) => request(`/discovery/${id}/reaction`, {
  method: 'POST', authenticated, body: { reaction: value },
});

before(async () => {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  db.exec('DELETE FROM users;');
  const insert = db.prepare('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)');
  insert.run(1, 'Viewer', 'viewer@example.test', 'unused');
  insert.run(2, 'Seller', 'seller@example.test', 'unused');
  token = createSession(1);
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('anonymous feed is available, empty state is finite, sold listings stay hidden', async () => {
  const empty = await request('/discovery');
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.data.items, []);
  assert.equal(empty.data.has_more, false);
  listing(1);
  listing(2, 'Books & Study', 2, 'sold');
  const feed = await request('/discovery');
  assert.equal(feed.status, 200);
  assert.deepEqual(feed.data.items.map((item) => item.id), [1]);
  assert.equal(typeof feed.data.items[0].reason, 'string');
  assert.equal(feed.data.personalized, false);
});

test('authenticated feed excludes own, saved, passed and sold listings', async () => {
  listing(1, 'Electronics', 1);
  listing(2);
  listing(3);
  listing(4, 'Electronics', 2, 'sold');
  listing(5);
  assert.equal((await reaction(2, 'like')).status, 200);
  assert.equal((await reaction(3, 'pass')).status, 200);
  const feed = await request('/discovery', { authenticated: true });
  assert.deepEqual(feed.data.items.map((item) => item.id), [5]);
});

test('likes use the existing favorites and are idempotent', async () => {
  listing(1);
  assert.equal((await reaction(1, 'like')).status, 200);
  assert.equal((await reaction(1, 'like')).status, 200);
  const favorites = await request('/listings?favorites=1', { authenticated: true });
  assert.equal(favorites.status, 200);
  assert.deepEqual(favorites.data.items.map((item) => item.id), [1]);
  assert.equal(favorites.data.items[0].favorited, true);
});

test('passing persists across feed requests without adding a favorite', async () => {
  listing(1);
  assert.equal((await reaction(1, 'pass')).status, 200);
  for (let attempt = 0; attempt < 2; attempt++) {
    const feed = await request('/discovery', { authenticated: true });
    assert.deepEqual(feed.data.items, []);
  }
  const favorites = await request('/listings?favorites=1', { authenticated: true });
  assert.equal(favorites.data.total, 0);
  const anonymous = await request('/discovery');
  assert.equal(anonymous.data.items.length, 1);
});

test('reactions require authentication and reject invalid values', async () => {
  listing(1);
  assert.equal((await reaction(1, 'like', false)).status, 401);
  assert.equal((await reaction(1, 'invalid')).status, 400);
  assert.equal((await reaction(1, { unexpected: true })).status, 400);
  assert.equal((await request('/discovery/1/reaction', {
    method: 'POST', authenticated: true, body: {},
  })).status, 400);
  assert.equal((await request('/discovery', { authenticated: true })).data.items.length, 1);
});

test('reactions cannot target own, missing or sold listings', async () => {
  listing(1, 'Electronics', 1);
  listing(2, 'Electronics', 2, 'sold');
  assert.equal((await reaction(1, 'like')).status, 403);
  assert.equal((await reaction(2, 'like')).status, 404);
  assert.equal((await reaction(999, 'pass')).status, 404);
});

test('saved categories lead the feed with explanations and room for discovery', async () => {
  listing(1, 'Electronics');
  await reaction(1, 'like');
  for (let id = 2; id <= 7; id++) listing(id, 'Electronics');
  listing(8, 'Books & Study');
  listing(9, 'Fashion');
  const feed = await request('/discovery?limit=8', { authenticated: true });
  assert.equal(feed.data.personalized, true);
  assert.equal(feed.data.items[0].category, 'Electronics');
  assert.match(feed.data.items[0].reason, /Electronics/);
  assert.notEqual(feed.data.items[3].category, 'Electronics');
  assert.equal(new Set(feed.data.items.map((item) => item.id)).size, feed.data.items.length);
});

test('exclude and has_more support finite batches without repeating cards', async () => {
  for (let id = 1; id <= 3; id++) listing(id);
  const first = await request('/discovery?limit=2');
  assert.equal(first.data.items.length, 2);
  assert.equal(first.data.has_more, true);
  const seen = first.data.items.map((item) => item.id);
  const second = await request(`/discovery?limit=2&exclude=${seen.join(',')}`);
  assert.equal(second.data.items.length, 1);
  assert.equal(second.data.has_more, false);
  assert.ok(!seen.includes(second.data.items[0].id));
});

test('feed caps large batches and rejects malformed exclusions', async () => {
  for (let id = 1; id <= 55; id++) listing(id);
  const feed = await request('/discovery?limit=999999');
  assert.equal(feed.status, 200);
  assert.equal(feed.data.items.length, 50);
  assert.equal(feed.data.has_more, true);
  for (const exclude of ['1,abc', '-1', '1.5', Array.from({ length: 101 }, (_, i) => i + 1).join(',')]) {
    assert.equal((await request(`/discovery?exclude=${exclude}`)).status, 400);
  }
});

test('one user reactions do not hide another user feed or favorites', async () => {
  listing(1);
  await reaction(1, 'pass');
  // Seller owns listing 1, so use a third user to check isolation.
  db.prepare('INSERT INTO users (id, name, email, password_hash) VALUES (3, ?, ?, ?)')
    .run('Other viewer', 'other@example.test', 'unused');
  token = createSession(3);
  const feed = await request('/discovery', { authenticated: true });
  assert.deepEqual(feed.data.items.map((item) => item.id), [1]);
  assert.equal(feed.data.items[0].favorited, false);
});
