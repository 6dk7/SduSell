import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useSession } from '../context/Session.jsx';
import { useUI } from '../context/UI.jsx';
import { CitySelect, Field } from './Field.jsx';

function AuthForm({ initialMode, reason }) {
  const { meta, setSession } = useSession();
  const { toast, closeDialog } = useUI();
  const [mode, setMode] = useState(initialMode);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);
  const isLogin = mode === 'login';

  useEffect(() => { formRef.current?.querySelector('input')?.focus(); }, [mode]);

  const switchMode = (m) => { setMode(m); setError(''); };

  const submit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError('');
    try {
      const res = await api(isLogin ? '/auth/login' : '/auth/register', { method: 'POST', body: data });
      setSession(res.token, res.user);
      closeDialog();
      toast(isLogin ? `Welcome back, ${res.user.name}` : 'Account created');
    } catch (ex) {
      setError(ex.message);
      setBusy(false);
    }
  };

  return (
    <div className="dialog-body">
      <h2 className="dialog-title">{reason || 'Welcome to SduSell'}</h2>
      <div className="tabs" role="tablist">
        {[['login', 'Log in'], ['register', 'Create account']].map(([m, label]) => (
          <button key={m} type="button" role="tab" className="tab" aria-selected={String(mode === m)} onClick={() => switchMode(m)}>{label}</button>
        ))}
      </div>
      <form className="form" noValidate onSubmit={submit} ref={formRef} key={mode}>
        {!isLogin && <Field label="Your name"><input name="name" autoComplete="name" required maxLength={60} /></Field>}
        <Field label="Email"><input name="email" type="email" autoComplete="email" required /></Field>
        {!isLogin && (
          <Field label="Phone number" hint="Optional. Buyers can call or message you on WhatsApp.">
            <input name="phone" type="tel" autoComplete="tel" placeholder="+7 701 123 45 67" />
          </Field>
        )}
        {!isLogin && <Field label="City"><CitySelect cities={meta.cities} defaultValue="" /></Field>}
        <Field label="Password" hint={isLogin ? null : 'At least 8 characters.'}>
          <input name="password" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} required minLength={8} />
        </Field>
        <p className="form-error" role="alert">{error}</p>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{isLogin ? 'Log in' : 'Create account'}</button>
      </form>
    </div>
  );
}

// const openAuth = useOpenAuth(); openAuth('login', 'Log in to save favorites')
export function useOpenAuth() {
  const { openDialog } = useUI();
  return (mode = 'login', reason) => openDialog(<AuthForm initialMode={mode} reason={reason} />);
}
