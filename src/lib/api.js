// Thin fetch wrapper for the SduSell REST API. The session provider owns the
// token and tells this module about it through setAuth().
export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

let token = null;
let onUnauthorized = () => {};

export function setAuth(nextToken, onExpired) {
  token = nextToken;
  if (onExpired) onUnauthorized = onExpired;
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized(); // session expired
    throw new ApiError(res.status, (data && data.error) || 'Something went wrong. Try again.');
  }
  return data;
}
