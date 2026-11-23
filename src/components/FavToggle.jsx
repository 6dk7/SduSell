import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useSession } from '../context/Session.jsx';
import { useUI } from '../context/UI.jsx';
import { HeartIcon } from './Artwork.jsx';
import { useOpenAuth } from './AuthDialog.jsx';

export function FavToggle({ listing, labelled = false, onChange }) {
  const { user } = useSession();
  const { toast } = useUI();
  const openAuth = useOpenAuth();
  const [favorited, setFavorited] = useState(!!listing.favorited);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setFavorited(!!listing.favorited); }, [listing.favorited]);

  const click = async () => {
    if (!user) { openAuth('login', 'Log in to save favorites'); return; }
    setBusy(true);
    try {
      await api(`/listings/${listing.id}/favorite`, { method: favorited ? 'DELETE' : 'POST' });
      setFavorited(!favorited);
      if (onChange) onChange(!favorited);
    } catch (ex) { toast(ex.message); }
    setBusy(false);
  };

  return (
    <button className={`fav${labelled ? ' fav-labelled' : ''}`} type="button" disabled={busy}
      aria-pressed={String(favorited)} aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'} onClick={click}>
      <HeartIcon />
      {labelled ? <span>{favorited ? 'Saved' : 'Save'}</span> : null}
    </button>
  );
}
