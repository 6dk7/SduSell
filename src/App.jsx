import { useEffect } from 'react';
import { Footer, Header } from './components/Header.jsx';
import { NotFound } from './components/States.jsx';
import { useSession } from './context/Session.jsx';
import { useRoute } from './lib/router.js';
import Discovery from './pages/Discovery.jsx';
import Favorites from './pages/Favorites.jsx';
import Home from './pages/Home.jsx';
import Listing from './pages/Listing.jsx';
import Mine from './pages/Mine.jsx';
import Profile from './pages/Profile.jsx';
import Sell from './pages/Sell.jsx';

function Page() {
  const { parts } = useRoute();
  const [first, second] = parts;
  if (!parts.length) return <Home />;
  if (first === 'discover') return <Discovery />;
  if (first === 'listing' && second) return <Listing key={second} id={Number(second)} />;
  if (first === 'sell') return <Sell />;
  if (first === 'edit' && second) return <Sell key={second} editId={Number(second)} />;
  if (first === 'me') return <Mine />;
  if (first === 'favorites') return <Favorites />;
  if (first === 'profile') return <Profile />;
  return <NotFound />;
}

export default function App() {
  const { ready } = useSession();
  const { hash } = useRoute();

  // New page, back to the top. Filters on the home page change the hash too, as before.
  useEffect(() => { window.scrollTo(0, 0); }, [hash]);

  return (
    <>
      <a className="skip" href="#/" id="skip" onClick={(e) => { e.preventDefault(); document.getElementById('app')?.focus(); }}>Skip to content</a>
      <Header />
      <main id="app" tabIndex={-1}>{ready ? <Page /> : null}</main>
      <Footer />
    </>
  );
}
