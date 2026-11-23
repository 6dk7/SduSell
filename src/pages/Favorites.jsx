import { api } from '../lib/api.js';
import { useOpenAuth } from '../components/AuthDialog.jsx';
import { ListingCard } from '../components/ListingCard.jsx';
import { EmptyState, PageError } from '../components/States.jsx';
import { useSession } from '../context/Session.jsx';
import { useFetch, useTitle } from '../lib/hooks.js';
import { useState } from 'react';

export default function Favorites() {
  const { user } = useSession();
  const openAuth = useOpenAuth();
  const [removed, setRemoved] = useState(() => new Set()); // un-hearted here, hidden without a refetch
  useTitle('Favorites - SduSell');
  const { data, error, reload } = useFetch(
    () => (user ? api('/listings?favorites=1&limit=50') : Promise.resolve(null)), [user?.id]);

  if (!user) {
    return (
      <div className="page narrow">
        <EmptyState title="Log in to see your favorites" text="Tap the heart on any listing to keep it here.">
          <button className="btn btn-primary" type="button" onClick={() => openAuth('login', 'Log in to see favorites')}>Log in</button>
        </EmptyState>
      </div>
    );
  }
  if (error) return <PageError error={error} onRetry={reload} />;
  if (!data) return null;

  const items = data.items.filter((l) => !removed.has(l.id));
  return (
    <div className="page">
      <section>
        <div className="results-head"><h1 className="page-title">Favorites</h1></div>
        {items.length ? (
          <div className="grid">
            {items.map((l) => (
              <ListingCard key={l.id} listing={l}
                onFavChange={(isFav) => { if (!isFav) setRemoved((s) => new Set(s).add(l.id)); }} />
            ))}
          </div>
        ) : (
          <EmptyState title="No favorites yet" text="Tap the heart on a listing to save it for later.">
            <a className="btn btn-primary" href="#/">Browse listings</a>
          </EmptyState>
        )}
      </section>
    </div>
  );
}
