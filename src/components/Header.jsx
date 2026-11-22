import { useEffect, useRef, useState } from 'react';
import { useSession } from '../context/Session.jsx';
import { useUI } from '../context/UI.jsx';
import { filtersToHash, navigate, readFilters, useRoute } from '../lib/router.js';
import { useOpenAuth } from './AuthDialog.jsx';

function AccountMenu() {
  const { user, logout } = useSession();
  const { toast } = useUI();
  const ref = useRef(null);
  // The native <details> owns its open state; we only close it.
  const close = () => ref.current?.removeAttribute('open');

  useEffect(() => {
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) ref.current.removeAttribute('open'); };
    document.addEventListener('click', away);
    return () => document.removeEventListener('click', away);
  }, []);

  const doLogout = async () => {
    close();
    await logout();
    toast('Logged out');
    navigate('#/');
  };

  return (
    <details className="menu" ref={ref}>
      <summary aria-label="Account menu">
        <span className="avatar">{user.name.trim().charAt(0).toUpperCase()}</span>
      </summary>
      <div className="menu-panel" onClick={(e) => { if (e.target.closest('a, button')) close(); }}>
        <p className="menu-name">{user.name}</p>
        <a href="#/me">My listings</a>
        <a href="#/favorites">Favorites</a>
        <button type="button" onClick={doLogout}>Log out</button>
      </div>
    </details>
  );
}

function Actions() {
  const { user } = useSession();
  const openAuth = useOpenAuth();
  return (
    <nav className="actions" id="actions" aria-label="Account">
      <a className="discover-link" href="#/discover">Finds</a>
      {!user && <button className="link-btn" type="button" onClick={() => openAuth('login')}>Log in</button>}
      <a className="btn btn-sun" href="#/sell">+ Sell</a>
      {user && <AccountMenu />}
    </nav>
  );
}

export function Header() {
  const { parts, params } = useRoute();
  const onHome = parts.length === 0;
  const routeQ = onHome ? params.get('q') || '' : '';
  const [q, setQ] = useState(routeQ);
  useEffect(() => { setQ(routeQ); }, [routeQ]);

  const search = (e) => {
    e.preventDefault();
    const current = onHome ? readFilters(params) : {};
    navigate(filtersToHash({ ...current, q: q.trim() }));
  };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="logo" href="#/" aria-label="SduSell home">
          <img className="logo-mark" src="/assets/sdusell-mark.svg" alt="" width="40" height="40" />
          <span className="logo-text">SduSell</span>
        </a>
        <form className="search" id="searchForm" role="search" onSubmit={search}>
          <input type="search" id="q" name="q" placeholder="Search for your next find…" aria-label="Search listings"
            autoComplete="off" maxLength={100} value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="search-btn" type="submit">Search</button>
        </form>
        <Actions />
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <a href="#/" className="footer-logo">
            <img className="footer-logo-mark" src="/assets/sdusell-mark.svg" alt="" width="28" height="28" />SduSell
          </a>
          <p>Independent student project.</p>
        </div>
        <p className="footer-note">A student project, made for your community.<br />Meet in a public place and check the item before you pay.</p>
      </div>
    </footer>
  );
}
