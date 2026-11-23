import { api } from '../lib/api.js';
import { Placeholder } from '../components/Artwork.jsx';
import { useOpenAuth } from '../components/AuthDialog.jsx';
import { EmptyState, PageError } from '../components/States.jsx';
import { useSession } from '../context/Session.jsx';
import { useUI } from '../context/UI.jsx';
import { formatNumber, money, timeAgo } from '../lib/format.js';
import { useFetch, useTitle } from '../lib/hooks.js';
import { deleteListing, toggleSold } from '../lib/listingActions.js';

export default function Mine() {
  const { user } = useSession();
  const { toast, confirmAction } = useUI();
  const openAuth = useOpenAuth();
  useTitle('My listings - SduSell');
  const { data, error, reload } = useFetch(
    () => (user ? api('/listings?mine=1&limit=50') : Promise.resolve(null)), [user?.id]);

  if (!user) {
    return (
      <div className="page narrow">
        <EmptyState title="Log in to see your listings" text="Your listings and their status appear here.">
          <button className="btn btn-primary" type="button" onClick={() => openAuth('login')}>Log in</button>
        </EmptyState>
      </div>
    );
  }
  if (error) return <PageError error={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div className="page narrow">
      <div className="results-head">
        <h1 className="page-title">My listings</h1>
        <a className="btn btn-sun" href="#/sell">Post a listing</a>
      </div>
      {data.items.length ? (
        <ul className="rows">
          {data.items.map((l) => (
            <li className="row" key={l.id}>
              <a className="row-thumb" href={`#/listing/${l.id}`} tabIndex={-1} aria-hidden="true">
                {l.cover ? <img src={l.cover} alt="" loading="lazy" /> : <Placeholder category={l.category} />}
              </a>
              <div className="row-main">
                <a className="row-title" href={`#/listing/${l.id}`}>{l.title}</a>
                <p className="price">{money(l.price)}</p>
                <p className="muted">{`${l.status === 'sold' ? 'Sold' : 'Active'}. ${formatNumber(l.views)} ${l.views === 1 ? 'view' : 'views'}. Posted ${timeAgo(l.created_at)}.`}</p>
              </div>
              <div className="row-actions">
                <a className="btn btn-quiet" href={`#/edit/${l.id}`}>Edit</a>
                <button className="btn btn-quiet" type="button" onClick={async () => { if (await toggleSold(l, { toast })) reload(); }}>
                  {l.status === 'sold' ? 'Mark as available' : 'Mark as sold'}
                </button>
                <button className="btn btn-danger-quiet" type="button" onClick={async () => { if (await deleteListing(l, { toast, confirmAction })) reload(); }}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="You have not posted anything yet" text="Sell something you no longer use. It only takes a minute.">
          <a className="btn btn-primary" href="#/sell">Post your first listing</a>
        </EmptyState>
      )}
    </div>
  );
}
