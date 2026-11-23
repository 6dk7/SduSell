import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { Placeholder } from '../components/Artwork.jsx';
import { useOpenAuth } from '../components/AuthDialog.jsx';
import { EmptyState } from '../components/States.jsx';
import { useSession } from '../context/Session.jsx';
import { useUI } from '../context/UI.jsx';
import { money } from '../lib/format.js';
import { useTitle } from '../lib/hooks.js';

const MAX_FINDS = 100;

// One card at a time. Only explicit saves affect recommendations, never dwell time.
export default function Discovery() {
  useTitle('SDU Finds - SduSell');
  const { user } = useSession();
  const { toast } = useUI();
  const openAuth = useOpenAuth();

  const seen = useRef(new Set());   // ids already shown in this collection
  const queue = useRef([]);         // fetched, not yet shown
  const busyRef = useRef(false);
  const endedRef = useRef(false);
  const stageRef = useRef(null);
  const nextRef = useRef(null);

  const [current, setCurrent] = useState(null);
  const [count, setCount] = useState(0);
  const [ended, setEnded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null); // { saved: bool } when the next find could not load
  const [status, setStatus] = useState('');

  const refill = async () => {
    const params = new URLSearchParams({ limit: '12', exclude: [...seen.current].join(',') });
    const data = await api(`/discovery?${params}`);
    queue.current = data.items.filter((l) => !seen.current.has(l.id));
  };

  const draw = () => {
    const l = queue.current[0];
    if (!l || seen.current.size >= MAX_FINDS) {
      endedRef.current = true;
      setEnded(true);
      setCurrent(null);
      setStatus('End of this collection.');
      return;
    }
    seen.current.add(l.id);
    setCount(seen.current.size);
    setCurrent(l);
    setStatus(`${l.title}. ${money(l.price)}. ${l.reason}`);
  };

  const setBusyBoth = (v) => { busyRef.current = v; setBusy(v); };

  const advance = async (reaction) => {
    if (busyRef.current || endedRef.current) return;
    const el = document.activeElement;
    const restoreFocus = !!(stageRef.current?.contains(el) || el === nextRef.current);
    setBusyBoth(true);
    setFailure(null);
    const previous = [...queue.current];
    let committed = false;
    try {
      if (reaction) {
        await api(`/discovery/${queue.current[0].id}/reaction`, { method: 'POST', body: { reaction } });
        committed = true;
        queue.current = [];
        toast(reaction === 'like' ? 'Saved to Favorites. More finds like this are on their way.' : 'Hidden from your Finds.');
        await refill(); // refresh ranking right after an explicit preference
      } else {
        queue.current.shift();
        if (!queue.current.length && seen.current.size < MAX_FINDS) await refill();
      }
      draw();
    } catch (ex) {
      if (committed || !previous.length) {
        queue.current = [];
        setCurrent(null);
        setFailure({ saved: committed });
      } else queue.current = previous;
      setStatus(ex.message);
      toast(ex.message);
    } finally {
      setBusyBoth(false);
      if (restoreFocus) requestAnimationFrame(() => stageRef.current?.focus({ preventScroll: true }));
    }
  };
  // Event listeners registered once always call the latest advance().
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // First collection. (The flag keeps React StrictMode's double effect from drawing twice.)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await refill(); } catch (ex) { if (!cancelled) { setFailure({ saved: false }); toast(ex.message); } return; }
      if (!cancelled) draw();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wheel needs a non-passive listener so it can stop the page from scrolling.
  useEffect(() => {
    const el = stageRef.current;
    let wheelTotal = 0, lastWheel = 0;
    const onWheel = (e) => {
      // Capture only deliberate downward scrolling over the card; leave page scrolling available elsewhere.
      if (e.ctrlKey || e.deltaY <= 0 || endedRef.current) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheel < 900) return;
      wheelTotal += e.deltaY;
      if (wheelTotal > 100) { wheelTotal = 0; lastWheel = now; advanceRef.current(); }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const touchStart = useRef(null);
  const onTouchStart = (e) => {
    touchStart.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  };
  const onTouchEnd = (e) => {
    const start = touchStart.current;
    if (!start || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    touchStart.current = null;
    if (dy < -70 && Math.abs(dy) > Math.abs(dx)) advance();
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' && !e.target.closest('button, a')) { e.preventDefault(); advance(); }
  };

  const onReact = (reaction) => {
    if (!user) {
      if (reaction === 'like') { openAuth('login', 'Log in to save your finds'); return; }
      advance();
    } else advance(reaction);
  };

  let counter = '';
  if (ended) counter = `${count} finds explored`;
  else if (current) counter = `Find ${count} · made for your curiosity`;

  return (
    <div className="page discovery-page">
      <div className="discovery-heading">
        <div>
          <span className="eyebrow">Your daily discovery</span>
          <h1 className="page-title">SDU Finds</h1>
          <p className="muted">One good find at a time.</p>
        </div>
        <a className="btn btn-quiet" href="#/">Browse all ↗</a>
      </div>
      <div className="discovery-layout">
        <section className="discovery-stage" tabIndex={0} ref={stageRef} aria-busy={String(busy)}
          aria-label="Finds. Swipe up or press Arrow Down for the next item."
          onKeyDown={onKeyDown} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {current && <FindCard l={current} busy={busy} onReact={onReact} />}
          {ended && (
            <EmptyState title="You’re all caught up." text="Great finds deserve a pause. Come back for new listings, or browse the full marketplace.">
              <a className="btn btn-sun" href="#/">Browse marketplace</a>
            </EmptyState>
          )}
          {failure && (
            <EmptyState title={failure.saved ? 'Your preference is saved.' : 'Let’s reconnect.'} text="We couldn’t load the next find. Retry when your connection is back.">
              <button className="btn btn-primary" type="button" disabled={busy} onClick={() => advance()}>Retry next find</button>
            </EmptyState>
          )}
        </section>
        <aside className="discovery-guide">
          <span className="discovery-spark" aria-hidden="true">✦</span>
          <h2>A little more you.</h2>
          <p>Save what you love. Your next finds follow your interests, with something different mixed in.</p>
          <ul><li>♡ Keep the good ones</li><li>× Skip what’s not your thing</li><li>↓ Scroll for the next find</li></ul>
          <p className="muted">{user ? 'Your saves and hidden finds are kept with your account.' : 'Explore freely. Log in to save finds and keep your preferences.'}</p>
        </aside>
      </div>
      <div className="discovery-controls">
        <span className="muted">{counter}</span>
        <button className="btn btn-quiet" type="button" ref={nextRef} hidden={ended} disabled={busy} onClick={() => advance()}>Next find ↓</button>
      </div>
      <p className="discovery-status visually-hidden" role="status" aria-live="polite">{status}</p>
    </div>
  );
}

function FindCard({ l, busy, onReact }) {
  return (
    <article className="discovery-card">
      <a className="discovery-media" href={`#/listing/${l.id}`} aria-label={`View ${l.title}`}>
        {l.cover ? <img src={l.cover} alt={l.title} /> : <Placeholder category={l.category} />}
        <span className="discovery-category">{l.category}</span>
      </a>
      <div className="discovery-body">
        <p className="discovery-reason">{`✦ ${l.reason}`}</p>
        <div className="discovery-title-row"><h2>{l.title}</h2><p className="price price-lg">{money(l.price)}</p></div>
        <p className="muted">{`${l.city} · ${l.condition === 'new' ? 'New' : 'Used'} · ${l.seller_name}`}</p>
        <p className="discovery-description">{l.description || 'Take a closer look and contact the seller.'}</p>
        <div className="discovery-card-actions">
          <button className="btn discovery-save" type="button" disabled={busy} onClick={() => onReact('like')}>♡ Save find</button>
          <button className="btn btn-quiet" type="button" disabled={busy} onClick={() => onReact('pass')}>× Not for me</button>
          <a className="discovery-details" href={`#/listing/${l.id}`}>View details ↗</a>
        </div>
      </div>
    </article>
  );
}
