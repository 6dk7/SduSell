import { useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { CitySelect, Field } from '../components/Field.jsx';
import { EmptyState } from '../components/States.jsx';
import { useSession } from '../context/Session.jsx';
import { useUI } from '../context/UI.jsx';
import { useTitle } from '../lib/hooks.js';
import { useOpenAuth } from '../components/AuthDialog.jsx';

async function resizePhoto(file) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG or WebP image.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.84);
}

export default function Profile() {
  const { user, meta, updateUser } = useSession();
  const { toast } = useUI();
  const openAuth = useOpenAuth();
  const fileRef = useRef(null);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [city, setCity] = useState(user?.city || '');
  const [avatar, setAvatar] = useState(user?.avatar_url || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationError, setVerificationError] = useState(false);
  useTitle('Your profile - SduSell');

  if (!user) return <div className="page narrow"><EmptyState title="Log in to view your profile" text="Your profile details and verification settings are here."><button className="btn btn-primary" type="button" onClick={() => openAuth('login')}>Log in</button></EmptyState></div>;

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter your name.'); return; }
    setBusy(true); setError('');
    try {
      const result = await api('/auth/me', { method: 'PUT', body: { name: name.trim(), phone, city, avatar } });
      updateUser(result.user);
      setAvatar(result.user.avatar_url || '');
      toast('Profile saved');
    } catch (ex) { setError(ex.message); }
    finally { setBusy(false); }
  };

  const requestVerification = (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@stu\.sdu\.edu\.kz$/i.test(studentEmail.trim())) {
      setVerificationError(true);
      setVerificationMessage('Enter an SDU student email ending in @stu.sdu.edu.kz.');
      return;
    }
    setVerificationError(false);
    setVerificationMessage('Email verification is not connected yet. No email was sent and your status has not changed.');
  };

  return (
    <div className="page narrow profile-page">
      <header className="profile-heading"><span className="eyebrow">YOUR ACCOUNT</span><h1 className="page-title">Your profile</h1><p className="muted">Manage your account details and student status.</p></header>
      <section className="profile-card" aria-labelledby="profile-info-heading">
        <h2 id="profile-info-heading">Profile information</h2>
        <p className="muted">These details help other students recognize and contact you.</p>
        <form className="form profile-form" onSubmit={save}>
          <div className="profile-photo-row">
            {avatar ? <img className="profile-avatar" src={avatar} alt="Profile preview" /> : <span className="profile-avatar profile-avatar-fallback" aria-hidden="true">{name.trim().charAt(0).toUpperCase() || '?'}</span>}
            <div className="profile-photo-controls">
              <input ref={fileRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Choose profile photo" onChange={async (e) => {
                const file = e.target.files?.[0]; e.target.value = '';
                if (!file) return;
                try { setAvatar(await resizePhoto(file)); } catch (ex) { setError(ex.message); }
              }} />
              <button className="btn btn-quiet" type="button" onClick={() => fileRef.current?.click()}>Choose photo</button>
              {avatar && <button className="btn btn-quiet" type="button" onClick={() => setAvatar('')}>Remove</button>}
              <p className="hint">PNG, JPEG or WebP. The image is resized before upload.</p>
            </div>
          </div>
          <Field label="Full name"><input name="name" autoComplete="name" maxLength={60} required value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Account email" hint="Changing your sign-in email is managed separately."><input type="email" value={user.email} readOnly autoComplete="email" /></Field>
          <Field label="Phone number" hint="Optional. Buyers can use this to contact you."><input name="phone" type="tel" autoComplete="tel" value={phone || ''} onChange={(e) => setPhone(e.target.value)} placeholder="+7 701 123 45 67" /></Field>
          <Field label="City"><CitySelect cities={meta.cities} value={city || ''} onChange={(e) => setCity(e.target.value)} /></Field>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions"><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div>
        </form>
      </section>
      <section className="profile-card verification-card" aria-labelledby="verification-heading">
        <div className="verification-heading"><div><h2 id="verification-heading">University email</h2><p className="muted">Confirm your student affiliation with an official SDU address.</p></div><span className="status-pill">NOT VERIFIED</span></div>
        <form className="form verify-form" onSubmit={requestVerification}>
          <Field label="University email" hint="Use your official address ending in @stu.sdu.edu.kz."><input type="email" autoComplete="email" placeholder="student ID@stu.sdu.edu.kz" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} required /></Field>
          {verificationMessage && <p className={verificationError ? 'form-error' : 'verify-message'} role={verificationError ? 'alert' : 'status'} aria-live="polite">{verificationMessage}</p>}
          <button className="btn btn-primary" type="submit">Request verification email</button>
        </form>
        <p className="hint">Preview only. Email delivery and verified status are not connected yet.</p>
      </section>
    </div>
  );
}
