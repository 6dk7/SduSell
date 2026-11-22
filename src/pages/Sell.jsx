import { useState } from 'react';
import { api } from '../lib/api.js';
import { useOpenAuth } from '../components/AuthDialog.jsx';
import { CitySelect, Field } from '../components/Field.jsx';
import { EmptyState, PageError } from '../components/States.jsx';
import { useSession } from '../context/Session.jsx';
import { useUI } from '../context/UI.jsx';
import { readImage } from '../lib/format.js';
import { useFetch, useTitle } from '../lib/hooks.js';
import { navigate } from '../lib/router.js';

const MAX_PHOTOS = 8;

function SellForm({ listing: l }) {
  const { user, meta } = useSession();
  const { toast } = useUI();
  const [images, setImages] = useState(() => (l ? [...l.images] : []));
  const [photoErr, setPhotoErr] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: l ? l.title : '',
    category: l ? l.category : '',
    city: l ? l.city : user.city || '',
    price: l ? String(l.price) : '',
    condition: l ? l.condition : 'used',
    negotiable: !!l && !!l.negotiable,
    description: l ? l.description || '' : '',
  });
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const addPhotos = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    setPhotoErr('');
    let next = images;
    for (const file of files) {
      if (next.length >= MAX_PHOTOS) { setPhotoErr('You can add up to 8 photos.'); break; }
      try { next = [...next, await readImage(file)]; } catch (ex) { setPhotoErr(ex.message); }
    }
    setImages(next);
  };
  const makeCover = (i) => setImages((list) => [list[i], ...list.filter((_, j) => j !== i)]);
  const removePhoto = (i) => setImages((list) => list.filter((_, j) => j !== i));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.title.trim().length < 3) return setError('Add a title with at least 3 characters.');
    if (!form.category) return setError('Choose a category.');
    if (!form.city) return setError('Choose a city.');
    if (form.price === '' || Number(form.price) < 0) return setError('Enter a price in tenge, or 0 for free.');
    setSaving(true);
    try {
      const saved = await api(l ? `/listings/${l.id}` : '/listings', {
        method: l ? 'PUT' : 'POST',
        body: { ...form, price: Number(form.price), negotiable: !!form.negotiable, images },
      });
      toast(l ? 'Changes saved' : 'Listing published');
      navigate(`#/listing/${saved.id}`);
    } catch (ex) {
      setError(ex.message);
      setSaving(false);
    }
  };

  return (
    <form className="form sell-form" noValidate onSubmit={submit}>
      <fieldset className="photos-field">
        <legend>Photos</legend>
        <p className="hint">Add up to 8 photos. The first one is the cover. Listings with photos sell faster.</p>
        <ul className="photos">
          {images.map((src, i) => (
            <li className="photo" key={src.length + ':' + src.slice(-40) + i}>
              <img src={src} alt={`Photo ${i + 1}`} />
              {i === 0
                ? <span className="badge badge-cover">Cover</span>
                : <button className="photo-btn photo-cover" type="button" onClick={() => makeCover(i)}>Make cover</button>}
              <button className="photo-btn photo-remove" type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => removePhoto(i)}>Remove</button>
            </li>
          ))}
        </ul>
        <label className="btn btn-quiet" htmlFor="photo-input">Add photos</label>
        <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="visually-hidden" id="photo-input" onChange={addPhotos} />
        <p className="form-error" role="alert">{photoErr}</p>
      </fieldset>

      <Field label="Title">
        <input name="title" required minLength={3} maxLength={100} value={form.title} onChange={set('title')} placeholder="For example: Lenovo IdeaPad 3, 16 GB RAM" />
      </Field>
      <div className="field-row">
        <Field label="Category">
          <select name="category" required value={form.category} onChange={set('category')}>
            <option value="">Choose a category</option>
            {meta.categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="City"><CitySelect cities={meta.cities} required value={form.city} onChange={set('city')} /></Field>
      </div>
      <div className="field-row">
        <Field label="Price in tenge" hint="Enter 0 for a free item.">
          <input name="price" type="number" min="0" step="1" inputMode="numeric" required value={form.price} onChange={set('price')} placeholder="0" />
        </Field>
        <fieldset className="field radios">
          <legend>Condition</legend>
          <label><input type="radio" name="condition" value="used" checked={form.condition === 'used'} onChange={set('condition')} />Used</label>
          <label><input type="radio" name="condition" value="new" checked={form.condition === 'new'} onChange={set('condition')} />New</label>
        </fieldset>
      </div>
      <label className="check"><input type="checkbox" name="negotiable" checked={form.negotiable} onChange={set('negotiable')} />Price is negotiable</label>
      <Field label="Description">
        <textarea name="description" rows={6} maxLength={4000} value={form.description} onChange={set('description')} placeholder="Condition, what is included, where you can meet" />
      </Field>
      <p className="form-error" role="alert">{error}</p>
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : l ? 'Save changes' : 'Publish listing'}</button>
        <a className="btn btn-quiet" href={l ? `#/listing/${l.id}` : '#/'}>Cancel</a>
      </div>
    </form>
  );
}

function EditLoader({ id }) {
  const { user } = useSession();
  const { data, error, reload } = useFetch(() => api(`/listings/${id}`), [id]);
  useTitle('Edit listing - SduSell');
  if (error) return <PageError error={error} onRetry={reload} />;
  if (!data) return null;
  if (data.user_id !== user.id) return <PageError error={{ status: 403, message: 'You can only edit your own listings.' }} onRetry={reload} />;
  return <div className="page narrow"><h1 className="page-title">Edit listing</h1><SellForm listing={data} /></div>;
}

// /sell posts a new listing; /edit/:id edits one of your own.
export default function Sell({ editId }) {
  const { user } = useSession();
  const openAuth = useOpenAuth();
  useTitle(`${editId ? 'Edit listing' : 'Post a listing'} - SduSell`);

  if (!user) {
    return (
      <div className="page narrow">
        <EmptyState title="Log in to post a listing" text="It takes a minute: add photos, a price and your city.">
          <button className="btn btn-primary" type="button" onClick={() => openAuth('login', 'Log in to post a listing')}>Log in or create an account</button>
        </EmptyState>
      </div>
    );
  }
  if (editId) return <EditLoader id={editId} />;
  return <div className="page narrow"><h1 className="page-title">Post a listing</h1><SellForm listing={null} /></div>;
}
