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

// Decorative illustrations are category artwork, never listing photographs.
const PRODUCT_ART = {
  Electronics: `<ellipse cx="120" cy="151" rx="86" ry="9" fill="currentColor" opacity=".08"/><rect x="53" y="33" width="134" height="94" rx="10" fill="#fff" stroke="currentColor" stroke-width="4"/><rect x="62" y="42" width="116" height="76" rx="4" fill="currentColor" opacity=".09"/><path d="M32 130h176l-17 16H49z" fill="#fff" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M98 131h44l-4 5h-36z" fill="currentColor" opacity=".3"/><path d="m102 68-15 13 15 13m36-26 15 13-15 13m-12-30-12 34" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  Audio: `<ellipse cx="120" cy="153" rx="66" ry="8" fill="currentColor" opacity=".08"/><path d="M65 101V79a55 55 0 0 1 110 0v22" fill="none" stroke="currentColor" stroke-width="15"/><path d="M66 101V79a54 54 0 0 1 108 0" fill="none" stroke="#fff" stroke-width="5" opacity=".55"/><rect x="51" y="87" width="34" height="57" rx="15" fill="#fff" stroke="currentColor" stroke-width="4"/><rect x="155" y="87" width="34" height="57" rx="15" fill="#fff" stroke="currentColor" stroke-width="4"/><path d="M76 97v36m88-36v36" stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity=".4"/>`,
  'Books & Study': `<ellipse cx="120" cy="151" rx="80" ry="8" fill="currentColor" opacity=".08"/><path d="m47 120 105-22 40 22-105 25z" fill="currentColor" opacity=".2"/><path d="M48 119v14l39 20 105-25v-14" fill="#fff" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="m47 119 105-25 40 20-105 25z" fill="currentColor" opacity=".6"/><path d="M53 89v15l42 19 91-23V85" fill="#fff" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="m53 89 92-23 41 19-91 23z" fill="currentColor" opacity=".25"/><path d="M65 61v14l42 19 78-20V60" fill="#fff" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="m65 61 78-20 42 19-78 20z" fill="currentColor" opacity=".8"/><path d="m115 56 27-7 15 7-27 7" fill="#fff" opacity=".8"/>`,
  Fashion: `<ellipse cx="120" cy="155" rx="69" ry="7" fill="currentColor" opacity=".08"/><path d="m88 34-33 22-18 46 28 13 14-27v59h82V88l14 27 28-13-18-46-33-22-18 13h-28z" fill="#fff" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M97 36q23 37 46 0M107 57v28m26-28v28m-35 24h44v20H98z" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M82 141h76" stroke="currentColor" stroke-width="8" opacity=".15"/>`,
  Transport: `<ellipse cx="120" cy="146" rx="89" ry="8" fill="currentColor" opacity=".08"/><path d="m40 102 16-13 21-37h81l27 38 18 12v27H37v-22z" fill="#fff" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M85 60h28v29H68zm39 0h28l20 29h-48z" fill="currentColor" opacity=".2"/><circle cx="72" cy="129" r="16" fill="#fff" stroke="currentColor" stroke-width="5"/><circle cx="169" cy="129" r="16" fill="#fff" stroke="currentColor" stroke-width="5"/><path d="M42 106h17m126 0h13m-85-7h14" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`,
  'Home & Garden': `<ellipse cx="120" cy="153" rx="73" ry="8" fill="currentColor" opacity=".08"/><rect x="68" y="33" width="104" height="82" rx="25" fill="#fff" stroke="currentColor" stroke-width="4"/><rect x="57" y="85" width="126" height="50" rx="13" fill="#fff" stroke="currentColor" stroke-width="4"/><path d="M73 136v17m94-17v17m-81-46h68" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><rect x="75" y="42" width="90" height="36" rx="17" fill="currentColor" opacity=".1"/>`,
  'Sports & Hobbies': `<circle cx="63" cy="119" r="32" fill="#fff" stroke="currentColor" stroke-width="4"/><circle cx="181" cy="119" r="32" fill="#fff" stroke="currentColor" stroke-width="4"/><path d="m63 119 35-58 24 58H63l75-47h27l16 47M91 56h23m45 16-9-22h-17" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="122" cy="119" r="8" fill="currentColor"/>`,
  Kids: `<ellipse cx="120" cy="153" rx="75" ry="8" fill="currentColor" opacity=".08"/><rect x="49" y="96" width="68" height="50" rx="8" fill="#fff" stroke="currentColor" stroke-width="4"/><rect x="123" y="96" width="68" height="50" rx="8" fill="currentColor" opacity=".22" stroke="currentColor" stroke-width="4"/><rect x="85" y="39" width="68" height="50" rx="8" fill="#fff" stroke="currentColor" stroke-width="4"/><path d="m104 73 15-21 15 21m-26-6h22" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="82" cy="121" r="12" fill="currentColor" opacity=".25"/><path d="m144 131 13-20 13 20z" fill="currentColor" opacity=".6"/>`,
  Services: `<ellipse cx="120" cy="154" rx="66" ry="8" fill="currentColor" opacity=".08"/><path d="M151 32a35 35 0 0 0-40 45l-55 55a13 13 0 0 0 18 18l55-55a35 35 0 0 0 45-40l-22 21-21-21z" fill="#fff" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="67" cy="139" r="4" fill="currentColor"/>`,
  Other: `<path d="m50 65 70-31 70 31v73l-70 27-70-27z" fill="#fff" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="m50 65 70 30 70-30m-70 30v70M85 49l70 30v29l-16 6V85" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="m65 121 31 12" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity=".3"/>`,
};
const CATEGORY_ICON = {
  Electronics: '<rect x="4" y="4" width="16" height="12" rx="2"/><path d="M2 20h20M9 16v4m6-4v4"/>',
  Transport: '<path d="m4 9 3-5h10l3 5M3 9h18v9H3z"/><path d="M6 18v2m12-2v2M6 13h2m8 0h2"/>',
  Fashion: '<path d="m8 3-6 4 3 6 3-2v10h8V11l3 2 3-6-6-4c0 4-8 4-8 0Z"/>',
  'Home & Garden': '<path d="M5 11V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6M3 11h18v8H3zm3 8v2m12-2v2M6 11v4m12-4v4"/>',
  Kids: '<path d="M3 12h9v9H3zM12 12h9v9h-9zM8 3h9v9H8z"/>',
  'Sports & Hobbies': '<circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="m6 16 4-10 4 10H6l10-7h2m-4-5h3l1 5m-10-3h4"/>',
  'Books & Study': '<path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1Zm0 0v15"/>',
  Services: '<path d="M20 3a6 6 0 0 0-8 8l-8 8a2 2 0 0 0 3 3l8-8a6 6 0 0 0 8-8l-4 4-4-4z"/>',
  Other: '<path d="m3 6 9-4 9 4v12l-9 4-9-4zm0 0 9 4 9-4m-9 4v12M8 4l9 4"/>',
};
function artwork(type, className = 'product-art') {
  const holder = document.createElement('span');
  holder.innerHTML = `<svg class="${className}" viewBox="0 0 ${className === 'category-icon' ? '24 24' : '240 180'}" fill="${className === 'category-icon' ? 'none' : 'currentColor'}" stroke="${className === 'category-icon' ? 'currentColor' : 'none'}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${className === 'category-icon' ? CATEGORY_ICON[type] || CATEGORY_ICON.Other : PRODUCT_ART[type] || PRODUCT_ART.Other}</svg>`;
  return holder.firstElementChild;
}
function placeholder(category) {
  const s = catStyle(category);
  return h('div', { class: 'ph', style: `--ph-bg:${s.bg};--ph-fg:${s.fg}` },
    artwork(category), h('span', { class: 'ph-label' }, 'No photo'));
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
  $actions.replaceChildren(h('a', { class: 'discover-link', href: '#/discover' }, 'Finds'));
  const sell = h('a', { class: 'btn btn-sun', href: '#/sell' }, '+ Sell');
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
        l.status === 'sold' ? h('span', { class: 'badge badge-sold' }, 'Sold') : h('span', { class: 'card-condition' }, l.condition === 'new' ? 'New' : 'Pre-loved'),
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
  const isBrowse = FILTER_KEYS.every(k => !f[k]) && f.page === 1;
  const api_q = new URLSearchParams({ limit: 24, page: f.page });
  for (const k of FILTER_KEYS) if (f[k]) api_q.set(k, f[k]);
  const data = await api(`/listings?${api_q}`);

  document.title = f.q ? `${f.q} - SduSell` : 'SduSell - buy and sell in Kazakhstan';

  // category chips
  const chips = h('nav', { class: 'chips', 'aria-label': 'Categories' },
    h('a', { class: 'chip', href: filtersToHash({ ...f, category: '' }), 'aria-current': String(!f.category) }, 'All'),
    state.meta.categories.map((c) =>
      h('a', { class: 'chip', href: filtersToHash({ ...f, category: c }), 'aria-current': String(f.category === c) },
        artwork(c, 'category-icon'), c)),
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
      h(isBrowse ? 'h2' : 'h1', { id: 'results-h' }, heading),
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
  const hero = isBrowse ? h('section', { class: 'home-hero', 'aria-labelledby': 'hero-heading' },
    h('div', { class: 'hero-copy' },
      h('span', { class: 'eyebrow' }, 'The student marketplace'),
      h('h1', { id: 'hero-heading' }, 'Good finds.', h('br'), h('em', {}, 'Better prices.')),
      h('p', { class: 'hero-description' }, 'A new home for your old favourites. Buy, sell and discover a little more around campus.'),
      h('div', { class: 'hero-actions' },
        h('a', { class: 'btn btn-primary', href: '#/discover' }, 'Explore finds', h('span', { 'aria-hidden': 'true' }, '↗')),
        h('a', { class: 'btn btn-quiet', href: '#/sell' }, 'Sell something')),
      h('p', { class: 'hero-note' }, 'Made for students. Open to good finds.')),
    h('div', { class: 'hero-visual', 'aria-hidden': 'true' },
      h('div', { class: 'hero-tile hero-tile-laptop' }, artwork('Electronics'), h('span', { class: 'hero-tile-label' }, 'Upgrade your everyday')),
      h('div', { class: 'hero-tile hero-tile-audio' }, artwork('Audio'), h('span', { class: 'hero-tile-label' }, 'Find your next favourite')),
      h('div', { class: 'hero-tile hero-tile-books' }, artwork('Books & Study'), h('span', { class: 'hero-tile-label' }, 'Pass it on')),
      h('span', { class: 'hero-sticker' }, 'Good stuff.', h('br'), 'Second stories.'))) : null;
  return h('div', { class: 'page home-page' }, hero,
    h('div', { class: 'market-section-label' }, h('h2', {}, 'Find your thing'), h('span', {}, 'A little bit of everything.')),
    chips, h('div', { class: 'home-layout' }, filters, results));
}


// One card at a time. Only explicit saves affect recommendations, never dwell time.
async function viewDiscovery() {
  document.title = 'SDU Finds - SduSell';
  $q.value = '';
  const seen = new Set();
  let queue = [], busy = false, ended = false;
  const stage = h('section', { class: 'discovery-stage', tabindex: 0, 'aria-label': 'Finds. Swipe up or press Arrow Down for the next item.' });
  const status = h('p', { class: 'discovery-status visually-hidden', role: 'status', 'aria-live': 'polite' });
  const next = h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => advance() }, 'Next find ↓');
  const counter = h('span', { class: 'muted' });
  const page = h('div', { class: 'page discovery-page' },
    h('div', { class: 'discovery-heading' },
      h('div', {}, h('span', { class: 'eyebrow' }, 'Your daily discovery'),
        h('h1', { class: 'page-title' }, 'SDU Finds'),
        h('p', { class: 'muted' }, 'One good find at a time.')),
      h('a', { class: 'btn btn-quiet', href: '#/' }, 'Browse all ↗')),
    h('div', { class: 'discovery-layout' }, stage,
      h('aside', { class: 'discovery-guide' }, h('span', { class: 'discovery-spark', 'aria-hidden': 'true' }, '✦'),
        h('h2', {}, 'A little more you.'),
        h('p', {}, 'Save what you love. Your next finds follow your interests, with something different mixed in.'),
        h('ul', {}, h('li', {}, '♡ Keep the good ones'), h('li', {}, '× Skip what’s not your thing'), h('li', {}, '↓ Scroll for the next find')),
        h('p', { class: 'muted' }, state.user ? 'Your saves and hidden finds are kept with your account.' : 'Explore freely. Log in to save finds and keep your preferences.'))),
    h('div', { class: 'discovery-controls' }, counter, next), status);

  async function refill() {
    const params = new URLSearchParams({ limit: '12', exclude: [...seen].join(',') });
    const data = await api(`/discovery?${params}`);
    queue = data.items.filter(l => !seen.has(l.id));
  }
  function draw() {
    const l = queue[0];
    if (!l || seen.size >= 100) {
      ended = true;
      next.hidden = true;
      stage.replaceChildren(emptyState('You’re all caught up.', 'Great finds deserve a pause. Come back for new listings, or browse the full marketplace.',
        h('a', { class: 'btn btn-sun', href: '#/' }, 'Browse marketplace')));
      counter.textContent = `${seen.size} finds explored`;
      status.textContent = 'End of this collection.';
      return;
    }
    seen.add(l.id);
    counter.textContent = `Find ${seen.size} · made for your curiosity`;
    status.textContent = `${l.title}. ${money(l.price)}. ${l.reason}`;
    const save = h('button', { class: 'btn discovery-save', type: 'button', onclick: () => react('like') }, '♡ Save find');
    const pass = h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => react('pass') }, '× Not for me');
    stage.replaceChildren(h('article', { class: 'discovery-card' },
      h('a', { class: 'discovery-media', href: `#/listing/${l.id}`, 'aria-label': `View ${l.title}` },
        l.cover ? h('img', { src: l.cover, alt: l.title }) : placeholder(l.category),
        h('span', { class: 'discovery-category' }, l.category)),
      h('div', { class: 'discovery-body' },
        h('p', { class: 'discovery-reason' }, `✦ ${l.reason}`),
        h('div', { class: 'discovery-title-row' }, h('h2', {}, l.title), h('p', { class: 'price price-lg' }, money(l.price))),
        h('p', { class: 'muted' }, `${l.city} · ${l.condition === 'new' ? 'New' : 'Used'} · ${l.seller_name}`),
        h('p', { class: 'discovery-description' }, l.description || 'Take a closer look and contact the seller.'),
        h('div', { class: 'discovery-card-actions' }, save, pass, h('a', { class: 'discovery-details', href: `#/listing/${l.id}` }, 'View details ↗')))));
  }
  function setBusy(value) {
    busy = value;
    next.disabled = value;
    stage.setAttribute('aria-busy', String(value));
    stage.querySelectorAll('button').forEach(b => { b.disabled = value; });
  }
  async function advance(reaction) {
    if (busy || ended) return;
    const restoreFocus = stage.contains(document.activeElement) || document.activeElement === next;
    setBusy(true);
    const previousQueue = [...queue];
    let committed = false;
    try {
      if (reaction) {
        await api(`/discovery/${queue[0].id}/reaction`, { method: 'POST', body: { reaction } });
        committed = true;
        queue = [];
        toast(reaction === 'like' ? 'Saved to Favorites. More finds like this are on their way.' : 'Hidden from your Finds.');
        // Refresh ranking immediately after an explicit preference.
        await refill();
      } else {
        queue.shift();
        if (!queue.length && seen.size < 100) await refill();
      }
      draw();
    } catch (ex) {
      if (committed || !previousQueue.length) {
        queue = [];
        stage.replaceChildren(emptyState(committed ? 'Your preference is saved.' : 'Let’s reconnect.',
          'We couldn’t load the next find. Retry when your connection is back.',
          h('button', { class: 'btn btn-primary', type: 'button', onclick: () => advance() }, 'Retry next find')));
      } else queue = previousQueue;
      status.textContent = ex.message;
      toast(ex.message);
    } finally {
      setBusy(false);
      if (restoreFocus && page.isConnected) stage.focus({ preventScroll: true });
    }
  }
  function react(reaction) {
    if (!state.user) {
      if (reaction === 'like') { openAuth('login', 'Log in to save your finds'); return; }
      advance();
    } else advance(reaction);
  }
  stage.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && !e.target.closest('button, a')) { e.preventDefault(); advance(); }
  });
  let wheelTotal = 0, lastWheel = 0;
  stage.addEventListener('wheel', e => {
    // Capture only deliberate downward scrolling over the card; leave page scrolling available elsewhere.
    if (e.ctrlKey || e.deltaY <= 0 || ended) return;
    e.preventDefault();
    const now = Date.now();
    if (now - lastWheel < 900) return;
    wheelTotal += e.deltaY;
    if (wheelTotal > 100) { wheelTotal = 0; lastWheel = now; advance(); }
  }, { passive: false });
  let touchStart = null;
  stage.addEventListener('touchstart', e => { touchStart = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (!touchStart || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (dy < -70 && Math.abs(dy) > Math.abs(dx)) advance();
  }, { passive: true });
  await refill();
  draw();
  return page;
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
    else if (parts[0] === 'discover') node = await viewDiscovery();
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
