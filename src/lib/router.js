import { useSyncExternalStore } from 'react';

// Hash routing, same URLs as before: #/, #/listing/3, #/sell, #/edit/3, #/me, #/favorites, #/discover
const subscribe = (cb) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getHash = () => location.hash;

export function useRoute() {
  const hash = useSyncExternalStore(subscribe, getHash, () => '');
  const raw = hash.slice(1) || '/';
  const [path, qs = ''] = raw.split('?');
  return { hash, parts: path.split('/').filter(Boolean), params: new URLSearchParams(qs) };
}

export const navigate = (hash) => { location.hash = hash; };

export const FILTER_KEYS = ['q', 'category', 'city', 'min', 'max', 'condition', 'sort', 'seller'];

export function readFilters(params) {
  const f = {};
  for (const k of FILTER_KEYS) f[k] = params.get(k) || '';
  f.page = Math.max(parseInt(params.get('page')) || 1, 1);
  return f;
}

export function filtersToHash(f, page = 1) {
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) if (f[k]) p.set(k, f[k]);
  if (page > 1) p.set('page', page);
  const qs = p.toString();
  return qs ? `#/?${qs}` : '#/';
}
