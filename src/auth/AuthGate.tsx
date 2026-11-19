import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { safeReturnTo } from '../../shared/validation';
import { Icon } from '../Icons';
import { useAuth } from './AuthProvider';
import { RETURN_TO_KEY, supabaseConfigured } from './supabase';
import './auth.css';

function GateScene({ children, quiet = false }: { children: ReactNode; quiet?: boolean }) {
  return <main className={`gate-scene${quiet ? ' gate-scene--quiet' : ''}`}>
    <img className="gate-background" src="/media/invitation-desk.webp" alt="" width="1536" height="1024" fetchPriority="high" />
    <div className="gate-stage">
      <a className="gate-brand" href="/" aria-label="Our Little Louvre">
        <img src="/pyramid.svg" alt="" width="34" height="34" />
        <span>Our Little Louvre</span>
      </a>
      <section className="gate-card" aria-labelledby="gate-heading">{children}</section>
    </div>
    <p className="gate-footer">A private collection for two.</p>
  </main>;
}

function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => { document.title = previous; };
  }, [title]);
}

function LoadingGate() {
  useDocumentTitle('One moment');
  return <main className="gate-scene pause-scene gate-scene--quiet">
    <div className="gate-stage pause-stage">
      <section className="gate-card pause-card" aria-labelledby="gate-heading">
        <p className="eyebrow">One moment</p>
        <h1 id="gate-heading" className="gate-title">Just a moment</h1>
        <p className="gate-copy">We’re checking your key.</p>
        <span className="loading-ring gate-ring" role="status" aria-label="Opening" />
      </section>
    </div>
  </main>;
}

function PauseGate({ message }: { message: string }) {
  useDocumentTitle(message);
  return <main className="gate-scene pause-scene">
    <div className="gate-stage pause-stage">
      <section className="gate-card pause-card" aria-labelledby="pause-heading">
        <p className="eyebrow">From the kitchen</p>
        <h1 id="pause-heading" className="gate-title">{message}</h1>
        <p className="gate-copy">Something good is on the stove. Dinner isn’t ready yet.</p>
        <p className="gate-note">No peeking. — D.</p>
      </section>
    </div>
  </main>;
}

function SetupGate({ live }: { live: boolean }) {
  return <GateScene quiet>
    <p className="eyebrow">Almost open</p>
    <h1 id="gate-heading" className="gate-title">The private entrance is not connected yet</h1>
    <p className="gate-copy">Add the museum’s Supabase values and the two guest addresses to <code>.env.local</code>, then restart the studio.</p>
    <div className="gate-checklist">
      <p><span>1</span><code>VITE_SUPABASE_URL</code></p>
      <p><span>2</span><code>VITE_SUPABASE_PUBLISHABLE_KEY</code></p>
      <p><span>3</span><code>OWNER_EMAIL</code> and <code>PARTNER_EMAIL</code></p>
    </div>
    {!live && <p className="gate-copy gate-copy--small">The browser copy of Supabase is missing. Run <code>npm run dev</code> after saving the file.</p>}
  </GateScene>;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [step, setStep] = useState<'email' | 'sent'>('email');
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const description = search.get('error_description') ?? hash.get('error_description');
    if (!description) return;
    setError(description.replace(/\+/g, ' '));
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  useEffect(() => {
    if (!auth.member || auth.pauseMessage || window.location.pathname !== '/auth/callback') return;
    const returnTo = safeReturnTo(localStorage.getItem(RETURN_TO_KEY));
    localStorage.removeItem(RETURN_TO_KEY);
    window.location.replace(returnTo);
  }, [auth.member, auth.pauseMessage]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!auth.loading && !auth.member) heading.current?.focus({ preventScroll: true });
  }, [auth.loading, auth.member, step]);

  useEffect(() => {
    if (!auth.loading && !auth.member && step === 'email') emailInput.current?.focus({ preventScroll: true });
  }, [auth.loading, auth.member, step]);

  async function send(target: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await auth.signIn(target);
      if (result === 'not-allowed') {
        setError('That address is not on the guest list. This museum is kept for two people.');
        setStep('email');
        return;
      }
      setSentTo(target);
      setStep('sent');
      setCooldown(30);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The key could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!busy && cooldown === 0) void send(email);
  }

  if (auth.demo) return <>{children}</>;
  if (auth.pauseMessage) return <PauseGate message={auth.pauseMessage} />;
  if (auth.member) return <>{children}</>;
  if (auth.loading) return <LoadingGate />;
  if (!supabaseConfigured) return <SetupGate live={false} />;
  if (!auth.configured) return <SetupGate live />;

  if (auth.session && auth.accessError) {
    return <GateScene>
      <p className="eyebrow">Members only</p>
      <h1 id="gate-heading" ref={heading} tabIndex={-1} className="gate-title">This museum is kept for two people</h1>
      <p className="gate-copy" role="alert">{auth.accessError}</p>
      <div className="gate-actions">
        <button className="button button--gold" onClick={() => void auth.refreshMember()}><Icon name="key" /> Try my key again</button>
        <button className="button button--outline" onClick={() => void auth.signOut()}>Sign out</button>
      </div>
    </GateScene>;
  }

  if (step === 'sent') {
    return <GateScene>
      <p className="eyebrow">A key is on its way</p>
      <h1 id="gate-heading" ref={heading} tabIndex={-1} className="gate-title">Check your inbox</h1>
      <p className="gate-copy">We sent a private key to <strong>{sentTo}</strong>. Open the email and follow the link in this browser.</p>
      <div className="gate-actions">
        <button className="button button--gold" disabled={busy || cooldown > 0} onClick={() => void send(sentTo)}>
          <Icon name="letter" /> {cooldown > 0 ? `Send another in ${cooldown}s` : 'Send another key'}
        </button>
        <button className="button button--outline" onClick={() => { setStep('email'); setError(null); setSentTo(''); }}>
          Use a different address
        </button>
      </div>
      {error && <p className="gate-error" role="alert">{error}</p>}
      <p className="gate-note">The key can only open the museum in the browser where it was requested.</p>
    </GateScene>;
  }

  return <GateScene>
    <p className="eyebrow">Private collection</p>
    <h1 id="gate-heading" ref={heading} tabIndex={-1} className="gate-title">A museum for two</h1>
    <p className="gate-copy">Enter the email on the guest list and we’ll send you a key. There are only two keys, one for each of us.</p>
    <form className="gate-form" onSubmit={submit}>
      <label htmlFor="gate-email">Email address</label>
      <input id="gate-email" ref={emailInput} type="email" name="email" autoComplete="email" inputMode="email"
        value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
      <button className="button button--gold" type="submit" disabled={busy}>
        <Icon name="key" /> {busy ? 'Sending your key…' : 'Send my key'}
      </button>
    </form>
    {(error || auth.accessError) && <p className="gate-error" role="alert">{error ?? auth.accessError}</p>}
    <p className="gate-note">No password, no guestbook, no strangers. Just us.</p>
  </GateScene>;
}
