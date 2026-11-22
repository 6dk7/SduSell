import { useState } from 'react';
import { api } from '../lib/api.js';
import { Placeholder } from '../components/Artwork.jsx';
import { FavToggle } from '../components/FavToggle.jsx';
import { PageError } from '../components/States.jsx';
import { useSession } from '../context/Session.jsx';
import { useUI } from '../context/UI.jsx';
import { formatNumber, memberSince, money, prettyPhone, timeAgo, whatsappLink } from '../lib/format.js';
import { useFetch, useTitle } from '../lib/hooks.js';
import { deleteListing, toggleSold } from '../lib/listingActions.js';
import { navigate } from '../lib/router.js';

function Gallery({ l }) {
  const [i, setI] = useState(0);
  return (
    <div className="gallery">
      <div className="gallery-stage">
        {l.images.length
          ? <img src={l.images[i]} alt={`${l.title}, photo ${i + 1} of ${l.images.length}`} />
          : <Placeholder category={l.category} />}
        {l.status === 'sold' && <span className="badge badge-sold badge-lg">Sold</span>}
      </div>
      <div className="gallery-thumbs">
        {l.images.length > 1 && l.images.map((src, j) => (
          <button key={src + j} className="thumb" type="button" aria-label={`Show photo ${j + 1}`}
            aria-current={String(j === i)} onClick={() => setI(j)}>
            <img src={src} alt="" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Contact({ l, isOwner, reload }) {
  const { toast, confirmAction } = useUI();
  const [revealed, setRevealed] = useState(false);

  if (isOwner) {
    return (
      <div className="contact">
        <p className="muted">{l.status === 'sold' ? 'This listing is marked as sold.' : 'This is your listing. Buyers see your phone number after they ask for it.'}</p>
        <div className="owner-actions">
          <a className="btn btn-primary" href={`#/edit/${l.id}`}>Edit listing</a>
          <button className="btn btn-quiet" type="button" onClick={async () => { if (await toggleSold(l, { toast })) reload(); }}>
            {l.status === 'sold' ? 'Mark as available' : 'Mark as sold'}
          </button>
          <button className="btn btn-danger-quiet" type="button" onClick={async () => { if (await deleteListing(l, { toast, confirmAction })) navigate('#/me'); }}>Delete</button>
        </div>
      </div>
    );
  }
  if (l.status === 'sold') return <div className="contact"><p className="muted">This item has been sold.</p></div>;
  if (!l.seller.phone) return <div className="contact"><p className="muted">The seller has not added a phone number yet.</p></div>;
  return (
    <div className="contact">
      {revealed
        ? <a className="btn btn-primary btn-block phone" href={`tel:${l.seller.phone}`}>{prettyPhone(l.seller.phone)}</a>
        : <button className="btn btn-primary btn-block" type="button" onClick={() => setRevealed(true)}>Show phone number</button>}
      <a className="btn btn-quiet btn-block" href={whatsappLink(l.seller.phone, l.title)} target="_blank" rel="noopener">Write on WhatsApp</a>
    </div>
  );
}

export default function Listing({ id }) {
  const { user } = useSession();
  const { data: l, error, reload } = useFetch(() => api(`/listings/${id}`), [id, user?.id]);
  useTitle(l ? `${l.title} - SduSell` : 'SduSell');

  if (error) return <PageError error={error} onRetry={reload} />;
  if (!l) return null;
  const isOwner = !!user && user.id === l.user_id;

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href="#/">All listings</a><span aria-hidden="true">/</span>
        <a href={`#/?category=${encodeURIComponent(l.category)}`}>{l.category}</a>
      </nav>
      <div className="detail">
        <Gallery key={l.id} l={l} />
        <section className="desc">
          <h2>Description</h2>
          {l.description ? <p className="desc-text">{l.description}</p> : <p className="muted">The seller did not add a description.</p>}
        </section>
        <aside className="panel">
          <p className="price price-lg">{money(l.price)}</p>
          <h1 className="listing-title">{l.title}</h1>
          <ul className="tags">
            <li>{l.condition === 'new' ? 'New' : 'Used'}</li>
            {l.negotiable ? <li>Negotiable</li> : null}
            <li>{l.category}</li>
          </ul>
          <p className="muted">{`${l.city}. Posted ${timeAgo(l.created_at)}. ${formatNumber(l.views)} ${l.views === 1 ? 'view' : 'views'}.`}</p>
          <Contact l={l} isOwner={isOwner} reload={reload} />
          {isOwner ? null : <FavToggle listing={l} labelled />}
          <div className="seller">
            <span className="avatar avatar-lg">{l.seller.name.trim().charAt(0).toUpperCase()}</span>
            <div>
              <p className="seller-name">{l.seller.name}</p>
              <p className="muted">{`On SduSell since ${memberSince(l.seller.created_at)}`}</p>
              <a href={`#/?seller=${l.seller.id}`}>{`${l.seller.active_listings} active ${l.seller.active_listings === 1 ? 'listing' : 'listings'}`}</a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
