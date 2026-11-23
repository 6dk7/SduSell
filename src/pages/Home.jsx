import { api } from '../lib/api.js';
import { Artwork } from '../components/Artwork.jsx';
import { CitySelect, Field } from '../components/Field.jsx';
import { ListingCard } from '../components/ListingCard.jsx';
import { EmptyState, PageError } from '../components/States.jsx';
import { useSession } from '../context/Session.jsx';
import { formatNumber } from '../lib/format.js';
import { useFetch, useTitle } from '../lib/hooks.js';
import { FILTER_KEYS, filtersToHash, navigate, readFilters, useRoute } from '../lib/router.js';

function Hero() {
  return (
    <section className="home-hero" aria-labelledby="hero-heading">
      <div className="hero-copy">
        <span className="eyebrow">The SDU student community</span>
        <h1 id="hero-heading">Your campus.<br /><em>Your next find.</em></h1>
        <p className="hero-description">From your first textbook to your next upgrade. Buy, sell and find something good around SDU.</p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#/discover">Explore finds<span aria-hidden="true">↗</span></a>
          <a className="btn btn-quiet" href="#/sell">Sell something</a>
        </div>
        <p className="hero-note">SDU spirit. Student-to-student.</p>
      </div>
      <div className="hero-visual" aria-hidden="true">
        <div className="hero-tile hero-tile-laptop"><Artwork type="Electronics" /><span className="hero-tile-label">Upgrade your everyday</span></div>
        <div className="hero-tile hero-tile-audio"><Artwork type="Audio" /><span className="hero-tile-label">Find your next favourite</span></div>
        <div className="hero-tile hero-tile-books"><Artwork type="Books & Study" /><span className="hero-tile-label">Pass it on</span></div>
        <span className="hero-sticker">Campus life.<br />Second stories.</span>
      </div>
    </section>
  );
}

function Filters({ f }) {
  const { meta } = useSession();
  // Uncontrolled inputs; the form is re-keyed whenever the URL filters change.
  const apply = (form) => {
    const d = Object.fromEntries(new FormData(form));
    navigate(filtersToHash({ ...f, city: d.city, min: d.min, max: d.max, condition: d.condition, sort: d.sort }));
  };
  const onNumberBlur = (e) => {
    if (e.target.value !== (f[e.target.name] || '')) apply(e.currentTarget.form);
  };
  const sorts = [['', 'Newest first'], ['price_asc', 'Price, low to high'], ['price_desc', 'Price, high to low'], ['popular', 'Most viewed']];
  return (
    <details className="filters" open={window.matchMedia('(min-width: 900px)').matches}>
      <summary>Filters</summary>
      <form className="filters-form" key={FILTER_KEYS.map((k) => f[k]).join('|')}
        onSubmit={(e) => { e.preventDefault(); apply(e.currentTarget); }}>
        <Field label="City">
          <CitySelect cities={meta.cities} blankLabel="All of Kazakhstan" defaultValue={f.city} onChange={(e) => apply(e.currentTarget.form)} />
        </Field>
        <div className="field-row">
          <Field label="Price from"><input name="min" type="number" min="0" inputMode="numeric" placeholder="0" defaultValue={f.min} onBlur={onNumberBlur} /></Field>
          <Field label="Price to"><input name="max" type="number" min="0" inputMode="numeric" placeholder="Any" defaultValue={f.max} onBlur={onNumberBlur} /></Field>
        </div>
        <Field label="Condition">
          <select name="condition" defaultValue={f.condition} onChange={(e) => apply(e.currentTarget.form)}>
            <option value="">New and used</option>
            <option value="new">New</option>
            <option value="used">Used</option>
          </select>
        </Field>
        <Field label="Sort by">
          <select name="sort" defaultValue={f.sort} onChange={(e) => apply(e.currentTarget.form)}>
            {sorts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <div className="filters-actions">
          <button className="btn btn-primary" type="submit">Apply filters</button>
          <a className="btn btn-quiet" href={filtersToHash({ q: f.q })}>Clear filters</a>
        </div>
      </form>
    </details>
  );
}

export default function Home() {
  const { params } = useRoute();
  const { user, meta } = useSession();
  const f = readFilters(params);
  const isBrowse = FILTER_KEYS.every((k) => !f[k]) && f.page === 1;
  const query = new URLSearchParams({ limit: 24, page: f.page });
  for (const k of FILTER_KEYS) if (f[k]) query.set(k, f[k]);
  const qs = query.toString();

  useTitle(f.q ? `${f.q} - SduSell` : 'SduSell - buy and sell in Kazakhstan');
  const { data, error, loading, reload } = useFetch(() => api(`/listings?${qs}`), [qs, user?.id]);

  if (error) return <PageError error={error} onRetry={reload} />;
  if (!data) return null;

  let heading = 'Fresh listings';
  if (f.q) heading = `Results for “${f.q}”`;
  else if (f.seller) heading = 'Listings from this seller';
  else if (f.category) heading = f.category;
  const Heading = isBrowse ? 'h2' : 'h1';

  return (
    <div className={`page home-page${loading ? ' is-loading' : ''}`}>
      {isBrowse && <Hero />}
      <div className="market-section-label"><h2>Find your thing</h2><span>A little bit of everything.</span></div>
      <nav className="chips" aria-label="Categories">
        <a className="chip" href={filtersToHash({ ...f, category: '' })} aria-current={String(!f.category)}>All</a>
        {meta.categories.map((c) => (
          <a key={c} className="chip" href={filtersToHash({ ...f, category: c })} aria-current={String(f.category === c)}>
            <Artwork type={c} className="category-icon" />{c}
          </a>
        ))}
      </nav>
      <div className="home-layout">
        <Filters f={f} />
        <section className="results" aria-labelledby="results-h">
          <div className="results-head">
            <Heading id="results-h">{heading}</Heading>
            <p className="muted">{data.total === 1 ? '1 listing' : `${formatNumber(data.total)} listings`}</p>
          </div>
          {data.items.length ? (
            <div className="grid">{data.items.map((l) => <ListingCard key={l.id} listing={l} />)}</div>
          ) : (
            <EmptyState title="Nothing matches yet" text="Try a different word, remove a filter, or post the first listing yourself.">
              <a className="btn btn-quiet" href="#/">Show all listings</a>
            </EmptyState>
          )}
          {data.pages > 1 && (
            <nav className="pager" aria-label="Pages">
              {f.page > 1 ? <a className="btn btn-quiet" href={filtersToHash(f, f.page - 1)}>Previous</a> : <span />}
              <span className="muted">{`Page ${data.page} of ${data.pages}`}</span>
              {f.page < data.pages ? <a className="btn btn-quiet" href={filtersToHash(f, f.page + 1)}>Next</a> : <span />}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
