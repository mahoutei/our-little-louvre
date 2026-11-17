import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { MemberView } from '../../shared/types';
import { safeReturnTo } from '../../shared/validation';
import { api, ApiError } from '../api/client';
import { demoMember } from '../api/demo';
import { RETURN_TO_KEY, demoMode, supabase, supabaseConfigured } from './supabase';

type AuthContextValue = {
  demo: boolean;
  configured: boolean;
  loading: boolean;
  session: Session | null;
  member: MemberView | null;
  pauseMessage: string | null;
  accessError: string | null;
  signIn: (email: string) => Promise<'sent' | 'not-allowed'>;
  signOut: () => Promise<void>;
  token: () => Promise<string | null>;
  refreshMember: () => Promise<MemberView | null>;
  updateMember: (member: MemberView) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<MemberView | null>(demoMode ? demoMember : null);
  const [pauseMessage, setPauseMessage] = useState<string | null>(null);
  const [configured, setConfigured] = useState(demoMode || supabaseConfigured);
  const [loading, setLoading] = useState(!demoMode);
  const [accessError, setAccessError] = useState<string | null>(null);
  const refreshing = useRef<Promise<MemberView | null> | null>(null);

  const refreshMember = useCallback(async (): Promise<MemberView | null> => {
    if (demoMode) return demoMember;
    if (!supabase) return null;
    if (refreshing.current) return refreshing.current;

    const run = (async () => {
      const { data } = await supabase.auth.getSession();
      const current = data.session;
      if (!current) {
        setSession(null);
        setMember(null);
        setPauseMessage(null);
        return null;
      }
      setSession(current);
      try {
        const result = await api.me(current.access_token);
        setMember(result.member);
        setPauseMessage(result.pause?.message ?? null);
        setAccessError(null);
        return result.member;
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          await supabase.auth.signOut();
          setSession(null);
          setMember(null);
          setPauseMessage(null);
          setAccessError(error.status === 403 ? error.message : null);
          return null;
        }
        setMember(null);
        setPauseMessage(null);
        setAccessError(error instanceof Error ? error.message : 'The museum office could not be reached.');
        return null;
      }
    })();

    refreshing.current = run;
    try {
      return await run;
    } finally {
      refreshing.current = null;
    }
  }, []);

  useEffect(() => {
    if (demoMode) return;
    if (!supabase) {
      setConfigured(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      if (cancelled) return;
      setSession(next);
      if (event === 'SIGNED_OUT') {
        setMember(null);
        setPauseMessage(null);
        setAccessError(null);
        setLoading(false);
      }
      if (event === 'SIGNED_IN' && next) {
        // Supabase asks callbacks not to await its own auth methods. Defer the
        // profile fetch until the auth lock has been released.
        window.setTimeout(() => {
          if (cancelled) return;
          void refreshMember().finally(() => {
            if (!cancelled) setLoading(false);
          });
        }, 0);
      }
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session) await refreshMember();
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [refreshMember]);

  const signIn = useCallback(async (email: string): Promise<'sent' | 'not-allowed'> => {
    if (!supabase) throw new Error('The private entrance is not configured yet.');
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Enter a complete email address.');

    const allowed = await api.allowed(normalized);
    setConfigured(allowed.configured);
    if (!allowed.configured) throw new Error('The guest list has not been set up yet. Add OWNER_EMAIL and PARTNER_EMAIL.');
    if (!allowed.allowed) return 'not-allowed';

    const returnTo = safeReturnTo(`${window.location.pathname}${window.location.search}`);
    if (returnTo !== '/auth/callback') localStorage.setItem(RETURN_TO_KEY, returnTo);

    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: true },
    });
    if (error) throw new Error(error.message);
    return 'sent';
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setSession(null);
    setMember(null);
    setPauseMessage(null);
    setAccessError(null);
    if (window.location.pathname !== '/') window.location.assign('/');
  }, []);

  const token = useCallback(async () => {
    if (demoMode || !supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const updateMember = useCallback((next: MemberView) => setMember(next), []);

  const value = useMemo<AuthContextValue>(() => ({
    demo: demoMode,
    configured,
    loading,
    session,
    member,
    pauseMessage,
    accessError,
    signIn,
    signOut,
    token,
    refreshMember,
    updateMember,
  }), [accessError, configured, loading, member, pauseMessage, refreshMember, session, signIn, signOut, token, updateMember]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
