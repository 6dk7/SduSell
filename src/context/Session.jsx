import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuth } from '../lib/api.js';

const SessionContext = createContext(null);
export const useSession = () => useContext(SessionContext);

const TOKEN_KEY = 'sdusell_token';
const readToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };

// Holds the logged-in user and the categories/cities lists. `ready` turns true
// once the saved token has been checked, so pages never flash as logged out.
export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [meta, setMeta] = useState({ categories: [], cities: [] });
  const [ready, setReady] = useState(false);

  const setSession = useCallback((token, nextUser) => {
    setAuth(token);
    setUser(nextUser);
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch { /* storage blocked */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAuth(readToken(), () => setSession(null, null));
    (async () => {
      try { const m = await api('/meta'); if (!cancelled) setMeta(m); } catch { /* shown by the first page */ }
      if (readToken()) {
        try { const me = await api('/auth/me'); if (!cancelled) setUser(me.user); } catch { setSession(null, null); }
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, [setSession]);

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* already logged out */ }
    setSession(null, null);
  }, [setSession]);

  const value = useMemo(() => ({ user, meta, ready, setSession, logout }), [user, meta, ready, setSession, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
