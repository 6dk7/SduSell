// SduSell frontend: vanilla JS single-page app with hash routing.
// All user-provided text is inserted with textContent (via h()), never innerHTML.
'use strict';

const $app = document.getElementById('app');
const $dialog = document.getElementById('dialog');
const $toast = document.getElementById('toast');
const $actions = document.getElementById('actions');
const $q = document.getElementById('q');

const state = {
  token: localStorage.getItem('sdusell_token') || null,
  user: null,
  meta: { categories: [], cities: [] },
};

// ---------- small helpers ----------
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

// replaceChildren() turns null into the text "null", so drop empty slots first.
const nodes = (...list) => list.flat(Infinity).filter(Boolean);

const nf = new Intl.NumberFormat('ru-RU');
const money = (n) => (n === 0 ? 'Free' : `${nf.format(n)} ₸`);

function timeAgo(sqlDate) {
  const d = new Date(sqlDate.replace(' ', 'T') + 'Z');
  const sec = (Date.now() - d.getTime()) / 1000;
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return day === 1 ? 'yesterday' : `${day} days ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function prettyPhone(p) {
  const d = (p || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('7')) return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
  return p;
}

function whatsappLink(phone, title) {
  let d = (phone || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('8')) d = '7' + d.slice(1);
  const text = `Hi! Is "${title}" still available? (from SduSell)`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

let toastTimer;
function toast(message) {
  $toast.textContent = message;
  $toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 3200);
}

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && state.token) setSession(null, null); // session expired
    throw new ApiError(res.status, (data && data.error) || 'Something went wrong. Try again.');
  }
  return data;
}

// ---------- categories ----------
const CAT_STYLE = {
  'Electronics': { emoji: '📱', bg: '#DDF1F7', fg: '#00657D' },
  'Transport': { emoji: '🚗', bg: '#E4EEF9', fg: '#2A5DA8' },
  'Fashion': { emoji: '👕', bg: '#F7E6EE', fg: '#A33A6B' },
  'Home & Garden': { emoji: '🛋️', bg: '#E3F2E6', fg: '#2D7A45' },
  'Kids': { emoji: '🧸', bg: '#FFF1CC', fg: '#8F6400' },
  'Sports & Hobbies': { emoji: '🚴', bg: '#E9E6F7', fg: '#5B47A8' },
  'Books & Study': { emoji: '📚', bg: '#DFF0EE', fg: '#1F7A70' },
  'Services': { emoji: '🛠️', bg: '#FDE9DD', fg: '#B2531F' },
  'Other': { emoji: '📦', bg: '#E8EDF0', fg: '#4A636F' },
};
const catStyle = (c) => CAT_STYLE[c] || CAT_STYLE.Other;

// Placeholder for listings without photos: category colour + ram's-horn ornament pattern.
function placeholder(category) {
  const s = catStyle(category);
  const id = `orn-${Object.keys(CAT_STYLE).indexOf(category) + 1}`;
  const wrap = h('div', { class: 'ph', style: `--ph-bg:${s.bg};--ph-fg:${s.fg}`, 'aria-hidden': 'true' });
  wrap.innerHTML = `
    <svg class="ph-pattern" xmlns="http://www.w3.org/2000/svg" focusable="false">
      <defs>
        <pattern id="${id}" width="48" height="48" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 10C14 6 6 12 8 21C10 29 21 28 21 21C21 16 15 16 15 20"/>
            <path d="M23 10C14 6 6 12 8 21C10 29 21 28 21 21C21 16 15 16 15 20" transform="translate(48 0) scale(-1 1)"/>
            <path d="M24 34l4 4-4 4-4-4z"/>
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#${id})"/>
    </svg>
    <span class="ph-emoji">${s.emoji}</span>`;
  return wrap;
}

const HEART = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.4 4.8 6.6 4.8c1.9 0 3.5 1 4.4 2.6.2.3.8.3 1 0 .9-1.6 2.5-2.6 4.4-2.6 3.2 0 5.1 3.2 3.9 6.5-1.8 4.6-9.3 9.2-9.3 9.2z" stroke-width="1.8" stroke-linejoin="round"/></svg>';

// ---------- session ----------
function setSession(token, user) {
  state.token = token;
  state.user = user;
  try {
    if (token) localStorage.setItem('sdusell_token', token);
    else localStorage.removeItem('sdusell_token');
  } catch { /* storage blocked */ }
  renderActions();
}

function renderActions() {
  $actions.replaceChildren();
  const sell = h('a', { class: 'btn btn-sun', href: '#/sell' }, 'Post a listing');
  if (!state.user) {
    $actions.append(
      h('button', { class: 'link-btn', type: 'button', onclick: () => openAuth('login') }, 'Log in'),
      sell,
    );
    return;
  }
  const menu = h('details', { class: 'menu' },
    h('summary', { 'aria-label': 'Account menu' },
      h('span', { class: 'avatar' }, state.user.name.trim().charAt(0).toUpperCase()),
    ),
    h('div', { class: 'menu-panel' },
      h('p', { class: 'menu-name' }, state.user.name),
      h('a', { href: '#/me' }, 'My listings'),
      h('a', { href: '#/favorites' }, 'Favorites'),
      h('button', { type: 'button', onclick: logout }, 'Log out'),
    ),
  );
  $actions.append(sell, menu);
}

document.addEventListener('click', (e) => {
  document.querySelectorAll('details.menu[open]').forEach((d) => { if (!d.contains(e.target)) d.removeAttribute('open'); });
  if (e.target.closest('.menu-panel a, .menu-panel button')) document.querySelectorAll('details.menu[open]').forEach((d) => d.removeAttribute('open'));
});

async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* already logged out */ }
  setSession(null, null);
  toast('Logged out');
  location.hash = '#/';
  render();
}

// ---------- dialogs ----------
function openDialog(node) {
  $dialog.replaceChildren(node);
  if (!$dialog.open) $dialog.showModal();
}
$dialog.addEventListener('click', (e) => { if (e.target === $dialog) $dialog.close(); });

function confirmAction({ title, text, confirmLabel }) {
  return new Promise((resolve) => {
    let result = false;
    openDialog(h('div', { class: 'dialog-body' },
      h('h2', { class: 'dialog-title' }, title),
      h('p', {}, text),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => $dialog.close() }, 'Cancel'),
        h('button', { class: 'btn btn-danger', type: 'button', onclick: () => { result = true; $dialog.close(); } }, confirmLabel),
      ),
    ));
    $dialog.addEventListener('close', () => resolve(result), { once: true });
  });
}

function field(label, input, hint) {
  const id = input.id || `f-${Math.random().toString(36).slice(2, 8)}`;
  input.id = id;
  return h('div', { class: 'field' },
    h('label', { for: id }, label),
    input,
    hint ? h('p', { class: 'hint' }, hint) : null,
  );
}

function citySelect(value, withBlank, blankLabel = 'Choose a city') {
  const sel = h('select', { name: 'city' }, withBlank ? h('option', { value: '' }, blankLabel) : null);
  for (const c of state.meta.cities) sel.append(h('option', { value: c, selected: c === value }, c));
  return sel;
}

function openAuth(mode = 'login', reason) {
  const err = h('p', { class: 'form-error', role: 'alert' });
  const form = h('form', { class: 'form', novalidate: true });

  function drawForm() {
    const isLogin = mode === 'login';
    form.replaceChildren(...nodes(
      !isLogin ? field('Your name', h('input', { name: 'name', autocomplete: 'name', required: true, maxlength: 60 })) : null,
      field('Email', h('input', { name: 'email', type: 'email', autocomplete: 'email', required: true })),
      !isLogin ? field('Phone number', h('input', { name: 'phone', type: 'tel', autocomplete: 'tel', placeholder: '+7 701 123 45 67' }), 'Optional. Buyers can call or message you on WhatsApp.') : null,
      !isLogin ? field('City', citySelect('', true)) : null,
      field('Password', h('input', { name: 'password', type: 'password', autocomplete: isLogin ? 'current-password' : 'new-password', required: true, minlength: 8 }), isLogin ? null : 'At least 8 characters.'),
      err,
      h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, isLogin ? 'Log in' : 'Create account'),
    ));
    err.textContent = '';
  }

  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  function drawTabs() {
    tabs.replaceChildren(
      ...[['login', 'Log in'], ['register', 'Create account']].map(([m, label]) =>
        h('button', {
          type: 'button', role: 'tab', class: 'tab', 'aria-selected': String(mode === m),
          onclick: () => { mode = m; drawTabs(); drawForm(); form.querySelector('input').focus(); },
        }, label)),
    );
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    err.textContent = '';
    try {
      const res = await api(mode === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body: data });
      setSession(res.token, res.user);
      $dialog.close();
      toast(mode === 'login' ? `Welcome back, ${res.user.name}` : 'Account created');
      render();
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
    }
  });

  drawTabs();
  drawForm();
  openDialog(h('div', { class: 'dialog-body' },
    h('h2', { class: 'dialog-title' }, reason || 'Welcome to SduSell'),
    tabs,
    form,
  ));
  form.querySelector('input').focus();
}

// ---------- listing pieces ----------
function favToggle(l, { labelled = false, onChange } = {}) {
  const btn = h('button', { class: `fav${labelled ? ' fav-labelled' : ''}`, type: 'button' });
  function paint() {
    btn.setAttribute('aria-pressed', String(l.favorited));
    btn.setAttribute('aria-label', l.favorited ? 'Remove from favorites' : 'Add to favorites');
    btn.innerHTML = HEART;
    if (labelled) btn.append(h('span', {}, l.favorited ? 'Saved' : 'Save'));
  }
  btn.addEventListener('click', async () => {
    if (!state.user) { openAuth('login', 'Log in to save favorites'); return; }
    btn.disabled = true;
    try {
      await api(`/listings/${l.id}/favorite`, { method: l.favorited ? 'DELETE' : 'POST' });
      l.favorited = !l.favorited;
      paint();
      if (onChange) onChange(l.favorited);
    } catch (ex) { toast(ex.message); }
    btn.disabled = false;
  });
  paint();
  return btn;
}

function card(l, opts = {}) {
  const href = `#/listing/${l.id}`;
  return h('article', { class: 'card' },
    h('div', { class: 'card-top' },
      h('a', { class: 'card-media', href, tabindex: '-1', 'aria-hidden': 'true' },
        l.cover ? h('img', { src: l.cover, alt: '', loading: 'lazy' }) : placeholder(l.category),
        l.status === 'sold' ? h('span', { class: 'badge badge-sold' }, 'Sold') : null,
      ),
      favToggle(l, { onChange: opts.onFavChange ? (v) => opts.onFavChange(v, l) : undefined }),
    ),
    h('a', { class: 'card-body', href },
      h('p', { class: 'price' }, money(l.price)),
      h('h3', { class: 'card-title' }, l.title),
      h('p', { class: 'card-meta' }, `${l.city}, ${timeAgo(l.created_at)}`),
    ),
  );
}

function emptyState(title, text, action) {
  return h('div', { class: 'empty' }, h('h2', {}, title), h('p', {}, text), action);
}

function errorState(ex) {
  return h('div', { class: 'page narrow' },
    emptyState('We could not load this page', ex.message,
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => render() }, 'Try again')),
  );
}

// ---------- views ----------
const FILTER_KEYS = ['q', 'category', 'city', 'min', 'max', 'condition', 'sort', 'seller'];

function readFilters(params) {
  const f = {};
  for (const k of FILTER_KEYS) f[k] = params.get(k) || '';
  f.page = Math.max(parseInt(params.get('page')) || 1, 1);
  return f;
}

function filtersToHash(f, page = 1) {
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) if (f[k]) p.set(k, f[k]);
  if (page > 1) p.set('page', page);
  const qs = p.toString();
  return qs ? `#/?${qs}` : '#/';
}

async function viewHome(params) {
  const f = readFilters(params);
  const api_q = new URLSearchParams({ limit: 24, page: f.page });
  for (const k of FILTER_KEYS) if (f[k]) api_q.set(k, f[k]);
  const data = await api(`/listings?${api_q}`);

  document.title = f.q ? `${f.q} - SduSell` : 'SduSell - buy and sell in Kazakhstan';

  // category chips
  const chips = h('nav', { class: 'chips', 'aria-label': 'Categories' },
    h('a', { class: 'chip', href: filtersToHash({ ...f, category: '' }), 'aria-current': String(!f.category) }, 'All'),
    state.meta.categories.map((c) =>
      h('a', { class: 'chip', href: filtersToHash({ ...f, category: c }), 'aria-current': String(f.category === c) },
        h('span', { 'aria-hidden': 'true' }, catStyle(c).emoji), c)),
  );

  // filters
  const form = h('form', { class: 'filters-form' },
    field('City', (() => { const s = citySelect(f.city, true, 'All of Kazakhstan'); return s; })()),
    h('div', { class: 'field-row' },
      field('Price from', h('input', { name: 'min', type: 'number', min: 0, inputmode: 'numeric', placeholder: '0', value: f.min })),
      field('Price to', h('input', { name: 'max', type: 'number', min: 0, inputmode: 'numeric', placeholder: 'Any', value: f.max })),
    ),
    field('Condition', h('select', { name: 'condition' },
      h('option', { value: '', selected: !f.condition }, 'New and used'),
      h('option', { value: 'new', selected: f.condition === 'new' }, 'New'),
      h('option', { value: 'used', selected: f.condition === 'used' }, 'Used'),
    )),
    field('Sort by', h('select', { name: 'sort' },
      [['', 'Newest first'], ['price_asc', 'Price, low to high'], ['price_desc', 'Price, high to low'], ['popular', 'Most viewed']]
        .map(([v, l]) => h('option', { value: v, selected: f.sort === v }, l)))),
    h('div', { class: 'filters-actions' },
      h('button', { class: 'btn btn-primary', type: 'submit' }, 'Apply filters'),
      h('a', { class: 'btn btn-quiet', href: filtersToHash({ q: f.q }) }, 'Clear filters'),
    ),
  );
  const apply = () => {
    const d = Object.fromEntries(new FormData(form));
    location.hash = filtersToHash({ ...f, city: d.city, min: d.min, max: d.max, condition: d.condition, sort: d.sort });
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); apply(); });
  form.addEventListener('change', apply);

  const filters = h('details', { class: 'filters', open: window.matchMedia('(min-width: 900px)').matches },
    h('summary', {}, 'Filters'), form);

  // results
  let heading = 'Fresh listings';
  if (f.q) heading = `Results for “${f.q}”`;
  else if (f.seller) heading = 'Listings from this seller';
  else if (f.category) heading = f.category;

  const grid = h('div', { class: 'grid' }, data.items.map((l) => card(l)));
  const results = h('section', { class: 'results', 'aria-labelledby': 'results-h' },
    h('div', { class: 'results-head' },
      h('h1', { id: 'results-h' }, heading),
      h('p', { class: 'muted' }, data.total === 1 ? '1 listing' : `${nf.format(data.total)} listings`),
    ),
    data.items.length
      ? grid
      : emptyState('Nothing matches yet', 'Try a different word, remove a filter, or post the first listing yourself.',
        h('a', { class: 'btn btn-quiet', href: '#/' }, 'Show all listings')),
    data.pages > 1 ? h('nav', { class: 'pager', 'aria-label': 'Pages' },
      f.page > 1 ? h('a', { class: 'btn btn-quiet', href: filtersToHash(f, f.page - 1) }, 'Previous') : h('span'),
      h('span', { class: 'muted' }, `Page ${data.page} of ${data.pages}`),
      f.page < data.pages ? h('a', { class: 'btn btn-quiet', href: filtersToHash(f, f.page + 1) }, 'Next') : h('span'),
    ) : null,
  );

  $q.value = f.q;
  return h('div', { class: 'page' }, chips, h('div', { class: 'home-layout' }, filters, results));
}

async function viewListing(id) {
  const l = await api(`/listings/${id}`);
  document.title = `${l.title} - SduSell`;
  $q.value = '';
  const isOwner = !!state.user && state.user.id === l.user_id;

  // gallery
  const stage = h('div', { class: 'gallery-stage' });
  const thumbs = h('div', { class: 'gallery-thumbs' });
  function show(i) {
    stage.replaceChildren(...nodes(
      l.images.length ? h('img', { src: l.images[i], alt: `${l.title}, photo ${i + 1} of ${l.images.length}` }) : placeholder(l.category),
      l.status === 'sold' ? h('span', { class: 'badge badge-sold badge-lg' }, 'Sold') : null,
    ));
    thumbs.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
  }
  if (l.images.length > 1) {
    l.images.forEach((src, i) => thumbs.append(
      h('button', { class: 'thumb', type: 'button', 'aria-label': `Show photo ${i + 1}`, onclick: () => show(i) }, h('img', { src, alt: '' }))));
  }
  show(0);

  // contact
  const contact = h('div', { class: 'contact' });
  if (isOwner) {
    contact.append(
      h('p', { class: 'muted' }, l.status === 'sold' ? 'This listing is marked as sold.' : 'This is your listing. Buyers see your phone number after they ask for it.'),
      h('div', { class: 'owner-actions' },
        h('a', { class: 'btn btn-primary', href: `#/edit/${l.id}` }, 'Edit listing'),
        h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => toggleSold(l, () => render()) }, l.status === 'sold' ? 'Mark as available' : 'Mark as sold'),
        h('button', { class: 'btn btn-danger-quiet', type: 'button', onclick: () => deleteListing(l, () => { location.hash = '#/me'; }) }, 'Delete'),
      ),
    );
  } else if (l.status === 'sold') {
    contact.append(h('p', { class: 'muted' }, 'This item has been sold.'));
  } else if (l.seller.phone) {
    const reveal = h('button', {
      class: 'btn btn-primary btn-block', type: 'button',
      onclick: () => reveal.replaceWith(h('a', { class: 'btn btn-primary btn-block phone', href: `tel:${l.seller.phone}` }, prettyPhone(l.seller.phone))),
    }, 'Show phone number');
    contact.append(reveal,
      h('a', { class: 'btn btn-quiet btn-block', href: whatsappLink(l.seller.phone, l.title), target: '_blank', rel: 'noopener' }, 'Write on WhatsApp'));
  } else {
    contact.append(h('p', { class: 'muted' }, 'The seller has not added a phone number yet.'));
  }

  const since = new Date(l.seller.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const panel = h('aside', { class: 'panel' },
    h('p', { class: 'price price-lg' }, money(l.price)),
    h('h1', { class: 'listing-title' }, l.title),
    h('ul', { class: 'tags' },
      h('li', {}, l.condition === 'new' ? 'New' : 'Used'),
      l.negotiable ? h('li', {}, 'Negotiable') : null,
      h('li', {}, l.category),
    ),
    h('p', { class: 'muted' }, `${l.city}. Posted ${timeAgo(l.created_at)}. ${nf.format(l.views)} ${l.views === 1 ? 'view' : 'views'}.`),
    contact,
    isOwner ? null : favToggle(l, { labelled: true }),
    h('div', { class: 'seller' },
      h('span', { class: 'avatar avatar-lg' }, l.seller.name.trim().charAt(0).toUpperCase()),
      h('div', {},
        h('p', { class: 'seller-name' }, l.seller.name),
        h('p', { class: 'muted' }, `On SduSell since ${since}`),
        h('a', { href: `#/?seller=${l.seller.id}` }, `${l.seller.active_listings} active ${l.seller.active_listings === 1 ? 'listing' : 'listings'}`),
      ),
    ),
  );

  return h('div', { class: 'page' },
    h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' },
      h('a', { href: '#/' }, 'All listings'), h('span', { 'aria-hidden': 'true' }, '/'),
      h('a', { href: `#/?category=${encodeURIComponent(l.category)}` }, l.category)),
    h('div', { class: 'detail' },
      h('div', { class: 'gallery' }, stage, thumbs),
      h('section', { class: 'desc' },
        h('h2', {}, 'Description'),
        l.description ? h('p', { class: 'desc-text' }, l.description) : h('p', { class: 'muted' }, 'The seller did not add a description.'),
      ),
      panel,
    ),
  );
}

async function toggleSold(l, done) {
  try {
    const next = l.status === 'sold' ? 'active' : 'sold';
    await api(`/listings/${l.id}/status`, { method: 'PATCH', body: { status: next } });
    toast(next === 'sold' ? 'Marked as sold' : 'Listing is available again');
    done();
  } catch (ex) { toast(ex.message); }
}

async function deleteListing(l, done) {
  const ok = await confirmAction({ title: 'Delete this listing?', text: `“${l.title}” and its photos will be removed. This cannot be undone.`, confirmLabel: 'Delete listing' });
  if (!ok) return;
  try {
    await api(`/listings/${l.id}`, { method: 'DELETE' });
    toast('Listing deleted');
    done();
  } catch (ex) { toast(ex.message); }
}

// Resize photos in the browser so uploads stay small.
async function readImage(file) {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error('Use PNG, JPEG or WebP photos.');
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

async function viewSell(editId) {
  if (!state.user) {
    return h('div', { class: 'page narrow' },
      emptyState('Log in to post a listing', 'It takes a minute: add photos, a price and your city.',
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openAuth('login', 'Log in to post a listing') }, 'Log in or create an account')));
  }
  let l = null;
  if (editId) {
    l = await api(`/listings/${editId}`);
    if (l.user_id !== state.user.id) throw new ApiError(403, 'You can only edit your own listings.');
  }
  document.title = `${l ? 'Edit listing' : 'Post a listing'} - SduSell`;
  $q.value = '';

  let images = l ? [...l.images] : [];
  const previews = h('ul', { class: 'photos' });
  const photoErr = h('p', { class: 'form-error', role: 'alert' });

  function drawPhotos() {
    previews.replaceChildren(...images.map((src, i) =>
      h('li', { class: 'photo' },
        h('img', { src, alt: `Photo ${i + 1}` }),
        i === 0 ? h('span', { class: 'badge badge-cover' }, 'Cover') : h('button', { class: 'photo-btn photo-cover', type: 'button', onclick: () => { images.unshift(images.splice(i, 1)[0]); drawPhotos(); } }, 'Make cover'),
        h('button', { class: 'photo-btn photo-remove', type: 'button', 'aria-label': `Remove photo ${i + 1}`, onclick: () => { images.splice(i, 1); drawPhotos(); } }, 'Remove'),
      )));
  }
  const fileInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', multiple: true, class: 'visually-hidden', id: 'photo-input' });
  fileInput.addEventListener('change', async () => {
    photoErr.textContent = '';
    for (const file of fileInput.files) {
      if (images.length >= 8) { photoErr.textContent = 'You can add up to 8 photos.'; break; }
      try { images.push(await readImage(file)); } catch (ex) { photoErr.textContent = ex.message; }
    }
    fileInput.value = '';
    drawPhotos();
  });
  drawPhotos();

  const err = h('p', { class: 'form-error', role: 'alert' });
  const form = h('form', { class: 'form sell-form', novalidate: true },
    h('fieldset', { class: 'photos-field' },
      h('legend', {}, 'Photos'),
      h('p', { class: 'hint' }, 'Add up to 8 photos. The first one is the cover. Listings with photos sell faster.'),
      previews,
      h('label', { class: 'btn btn-quiet', for: 'photo-input' }, 'Add photos'),
      fileInput, photoErr,
    ),
    field('Title', h('input', { name: 'title', required: true, minlength: 3, maxlength: 100, value: l ? l.title : '', placeholder: 'For example: Lenovo IdeaPad 3, 16 GB RAM' })),
    h('div', { class: 'field-row' },
      field('Category', (() => {
        const s = h('select', { name: 'category', required: true }, h('option', { value: '' }, 'Choose a category'));
        for (const c of state.meta.categories) s.append(h('option', { value: c, selected: l && l.category === c }, c));
        return s;
      })()),
      field('City', (() => { const s = citySelect(l ? l.city : state.user.city, true); s.required = true; return s; })()),
    ),
    h('div', { class: 'field-row' },
      field('Price in tenge', h('input', { name: 'price', type: 'number', min: 0, step: 1, inputmode: 'numeric', required: true, value: l ? l.price : '', placeholder: '0' }), 'Enter 0 for a free item.'),
      h('fieldset', { class: 'field radios' },
        h('legend', {}, 'Condition'),
        h('label', {}, h('input', { type: 'radio', name: 'condition', value: 'used', checked: !l || l.condition === 'used' }), 'Used'),
        h('label', {}, h('input', { type: 'radio', name: 'condition', value: 'new', checked: !!l && l.condition === 'new' }), 'New'),
      ),
    ),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'negotiable', checked: !!l && l.negotiable }), 'Price is negotiable'),
    field('Description', h('textarea', { name: 'description', rows: 6, maxlength: 4000, placeholder: 'Condition, what is included, where you can meet' }, l ? l.description : '')),
    err,
    h('div', { class: 'form-actions' },
      h('button', { class: 'btn btn-primary', type: 'submit' }, l ? 'Save changes' : 'Publish listing'),
      h('a', { class: 'btn btn-quiet', href: l ? `#/listing/${l.id}` : '#/' }, 'Cancel'),
    ),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const btn = form.querySelector('button[type=submit]');
    err.textContent = '';
    if (d.title.trim().length < 3) { err.textContent = 'Add a title with at least 3 characters.'; return; }
    if (!d.category) { err.textContent = 'Choose a category.'; return; }
    if (!d.city) { err.textContent = 'Choose a city.'; return; }
    if (d.price === '' || Number(d.price) < 0) { err.textContent = 'Enter a price in tenge, or 0 for free.'; return; }
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const saved = await api(l ? `/listings/${l.id}` : '/listings', {
        method: l ? 'PUT' : 'POST',
        body: { ...d, price: Number(d.price), negotiable: !!d.negotiable, images },
      });
      toast(l ? 'Changes saved' : 'Listing published');
      location.hash = `#/listing/${saved.id}`;
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
      btn.textContent = l ? 'Save changes' : 'Publish listing';
    }
  });

  return h('div', { class: 'page narrow' },
    h('h1', { class: 'page-title' }, l ? 'Edit listing' : 'Post a listing'), form);
}

async function viewMine() {
  if (!state.user) {
    return h('div', { class: 'page narrow' },
      emptyState('Log in to see your listings', 'Your listings and their status appear here.',
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openAuth('login') }, 'Log in')));
  }
  document.title = 'My listings - SduSell';
  $q.value = '';
  const data = await api('/listings?mine=1&limit=50');
  const list = h('ul', { class: 'rows' });
  const draw = () => {
    list.replaceChildren(...data.items.map((l) =>
      h('li', { class: 'row' },
        h('a', { class: 'row-thumb', href: `#/listing/${l.id}`, tabindex: '-1', 'aria-hidden': 'true' }, l.cover ? h('img', { src: l.cover, alt: '', loading: 'lazy' }) : placeholder(l.category)),
        h('div', { class: 'row-main' },
          h('a', { class: 'row-title', href: `#/listing/${l.id}` }, l.title),
          h('p', { class: 'price' }, money(l.price)),
          h('p', { class: 'muted' }, `${l.status === 'sold' ? 'Sold' : 'Active'}. ${nf.format(l.views)} ${l.views === 1 ? 'view' : 'views'}. Posted ${timeAgo(l.created_at)}.`),
        ),
        h('div', { class: 'row-actions' },
          h('a', { class: 'btn btn-quiet', href: `#/edit/${l.id}` }, 'Edit'),
          h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => toggleSold(l, () => render()) }, l.status === 'sold' ? 'Mark as available' : 'Mark as sold'),
          h('button', { class: 'btn btn-danger-quiet', type: 'button', onclick: () => deleteListing(l, () => render()) }, 'Delete'),
        ),
      )));
  };
  draw();
  return h('div', { class: 'page narrow' },
    h('div', { class: 'results-head' },
      h('h1', { class: 'page-title' }, 'My listings'),
      h('a', { class: 'btn btn-sun', href: '#/sell' }, 'Post a listing')),
    data.items.length ? list : emptyState('You have not posted anything yet', 'Sell something you no longer use. It only takes a minute.',
      h('a', { class: 'btn btn-primary', href: '#/sell' }, 'Post your first listing')),
  );
}

async function viewFavorites() {
  if (!state.user) {
    return h('div', { class: 'page narrow' },
      emptyState('Log in to see your favorites', 'Tap the heart on any listing to keep it here.',
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openAuth('login', 'Log in to see favorites') }, 'Log in')));
  }
  document.title = 'Favorites - SduSell';
  $q.value = '';
  const data = await api('/listings?favorites=1&limit=50');
  const wrap = h('div', { class: 'page' });
  const grid = h('div', { class: 'grid' });
  const section = h('section', {}, h('div', { class: 'results-head' }, h('h1', { class: 'page-title' }, 'Favorites')), grid);
  const empty = () => emptyState('No favorites yet', 'Tap the heart on a listing to save it for later.', h('a', { class: 'btn btn-primary', href: '#/' }, 'Browse listings'));
  for (const l of data.items) {
    const c = card(l, { onFavChange: (isFav) => { if (!isFav) { c.remove(); if (!grid.children.length) grid.replaceWith(empty()); } } });
    grid.append(c);
  }
  if (!data.items.length) grid.replaceWith(empty());
  wrap.append(section);
  return wrap;
}

// ---------- router ----------
let renderId = 0;

async function render() {
  const id = ++renderId;
  const raw = location.hash.slice(1) || '/';
  const [path, qs = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  $app.classList.add('is-loading');
  try {
    let node;
    if (!parts.length) node = await viewHome(new URLSearchParams(qs));
    else if (parts[0] === 'listing' && parts[1]) node = await viewListing(Number(parts[1]));
    else if (parts[0] === 'sell') node = await viewSell();
    else if (parts[0] === 'edit' && parts[1]) node = await viewSell(Number(parts[1]));
    else if (parts[0] === 'me') node = await viewMine();
    else if (parts[0] === 'favorites') node = await viewFavorites();
    else node = h('div', { class: 'page narrow' }, emptyState('Page not found', 'This address does not lead anywhere on SduSell.', h('a', { class: 'btn btn-primary', href: '#/' }, 'Go to all listings')));
    if (id !== renderId) return;
    $app.replaceChildren(node);
  } catch (ex) {
    if (id !== renderId) return;
    const e = ex instanceof ApiError ? ex : new ApiError(0, 'Something went wrong. Try again.');
    if (ex instanceof ApiError && ex.status === 404) {
      $app.replaceChildren(h('div', { class: 'page narrow' }, emptyState('Listing not found', 'It may have been deleted or marked as sold.', h('a', { class: 'btn btn-primary', href: '#/' }, 'Go to all listings'))));
    } else {
      if (!(ex instanceof ApiError)) console.error(ex);
      $app.replaceChildren(errorState(e));
    }
  } finally {
    if (id === renderId) {
      $app.classList.remove('is-loading');
      window.scrollTo(0, 0);
    }
  }
}

// ---------- boot ----------
document.getElementById('searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const onHome = !(location.hash.slice(1) || '/').split('?')[0].split('/').filter(Boolean).length;
  const current = onHome ? readFilters(new URLSearchParams(location.hash.split('?')[1] || '')) : {};
  location.hash = filtersToHash({ ...current, q: $q.value.trim() });
});

document.getElementById('skip').addEventListener('click', (e) => { e.preventDefault(); $app.focus(); });
window.addEventListener('hashchange', render);

(async function boot() {
  try { state.meta = await api('/meta'); } catch { /* shown by the first view */ }
  if (state.token) {
    try { state.user = (await api('/auth/me')).user; } catch { state.token = null; }
  }
  renderActions();
  render();
})();
