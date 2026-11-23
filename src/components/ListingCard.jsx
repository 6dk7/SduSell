import { money, timeAgo } from '../lib/format.js';
import { FavToggle } from './FavToggle.jsx';
import { Placeholder } from './Artwork.jsx';

export function ListingCard({ listing: l, onFavChange }) {
  const href = `#/listing/${l.id}`;
  return (
    <article className="card">
      <div className="card-top">
        <a className="card-media" href={href} tabIndex={-1} aria-hidden="true">
          {l.cover ? <img src={l.cover} alt="" loading="lazy" /> : <Placeholder category={l.category} />}
          {l.status === 'sold'
            ? <span className="badge badge-sold">Sold</span>
            : <span className="card-condition">{l.condition === 'new' ? 'New' : 'Pre-loved'}</span>}
        </a>
        <FavToggle listing={l} onChange={onFavChange ? (v) => onFavChange(v, l) : undefined} />
      </div>
      <a className="card-body" href={href}>
        <p className="price">{money(l.price)}</p>
        <h3 className="card-title">{l.title}</h3>
        <p className="card-meta">{`${l.city}, ${timeAgo(l.created_at)}`}</p>
      </a>
    </article>
  );
}
