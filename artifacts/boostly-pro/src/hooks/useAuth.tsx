import { createContext, useContext, ReactNode, useEffect, useMemo, useState, useCallback } from 'react';
import { apiUrl } from '@/lib/apiBase';
import { api } from '@/lib/api';

type AppRole = 'admin' | 'moderator' | 'user';
type Profile = {
  id: string;
  userId: string;
  email: string;
  full_name?: string | null;
  fullName?: string | null;
  currency?: string;
  api_key?: string | null;
};
type Wallet = {
  id: string;
  userId: string;
  balance: number;
  totalDeposited?: number;
  totalSpent?: number;
};

interface AuthContextType {
  user: { id: string; email?: string } | null;
  session: any | null;
  profile: Profile | null;
  wallet: Wallet | null;
  role: AppRole | null;
  isLoading: boolean;
  isAdmin: boolean;
  signIn: () => Promise<{ error: Error | null }>;
  signUp: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshWallet: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Display-only fields remembered between page loads so the dashboard shell
// can render before the session round trip completes. Deliberately excludes
// credentials (api_key) and balances; it lives in sessionStorage (per tab,
// gone when the tab closes), is keyed by user id, and is cleared on sign-out.
type SessionSnapshot = {
  profile: Pick<Profile, 'id' | 'userId' | 'email' | 'full_name' | 'currency'> | null;
  role: AppRole;
};
const SNAPSHOT_KEY = 'boostly.session.v2';

function toSnapshot(profile: Profile | null, role: AppRole): SessionSnapshot {
  return {
    profile: profile
      ? { id: profile.id, userId: profile.userId, email: profile.email, full_name: profile.full_name ?? null, currency: profile.currency }
      : null,
    role,
  };
}

function readSnapshot(userId: string): SessionSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string; data?: SessionSnapshot };
    return parsed.userId === userId && parsed.data ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeSnapshot(userId: string, data: SessionSnapshot): void {
  try {
    window.sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ userId, data }));
  } catch {
    // Storage may be full or disabled; the snapshot is only an accelerator.
  }
}

function clearSnapshot(): void {
  try {
    window.sessionStorage.removeItem(SNAPSHOT_KEY);
    window.localStorage.removeItem('boostly.session.v1'); // pre-release key
  } catch {
    // ignore
  }
}

function normalizeProfile(profile: any): Profile {
  return { ...profile, full_name: profile.full_name ?? profile.fullName ?? null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<{ id: string; email: string } | null>(null);
  const [clerkLoaded, setClerkLoaded] = useState(false);
  const clerkSession = authUser ? { access_token: 'legacy-cookie' } : null;
  const clerkUser = authUser ? { id: authUser.id, primaryEmailAddress: { emailAddress: authUser.email } } : null;
  const loadMe = useCallback(async () => {
    try {
      const r = await fetch(apiUrl('/auth/me'), { credentials: 'same-origin' });
      const b = r.ok ? await r.json() : null;
      setAuthUser(b?.user ?? null);
    } catch { setAuthUser(null); }
    finally { setClerkLoaded(true); }
  }, []);
  useEffect(() => {
    void loadMe();
    const h = () => void loadMe();
    window.addEventListener('boostly:auth-changed', h);
    return () => window.removeEventListener('boostly:auth-changed', h);
  }, [loadMe]);
  const openSignIn = useCallback(() => { window.location.href = '/sign-in'; }, []);
  const openSignUp = useCallback(() => { window.location.href = '/sign-up'; }, []);
  const clerkSignOut = useCallback(async () => {
    await fetch(apiUrl('/auth/logout'), { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
    setAuthUser(null);
  }, []);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [dbLoading, setDbLoading] = useState(true);

  const clerkUserId = clerkUser?.id ?? null;
  const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress;

  // Stable identity: consumers key effects on this object, so it must only
  // change when the underlying user actually changes.
  const user = useMemo(
    () => (clerkUserId ? { id: clerkUserId, email: clerkEmail } : null),
    [clerkUserId, clerkEmail],
  );

  const fetchUserData = useCallback(async (userId: string, isStale: () => boolean) => {
    try {
      const data = await api.getSession.scoped(userId);
      if (isStale()) return; // the signed-in user changed while this was in flight
      const nextProfile: Profile | null = data.profile ? normalizeProfile(data.profile) : null;
      const nextRole: AppRole = data.role === 'admin' ? 'admin' : 'user';
      if (nextProfile) setProfile(nextProfile);
      if (data.wallet) setWallet(data.wallet);
      setRole(nextRole);
      writeSnapshot(userId, toSnapshot(nextProfile, nextRole));
    } catch (error) {
      if (!isStale()) console.error('Error fetching user data:', error);
    }
  }, []);

  useEffect(() => {
    if (!clerkLoaded) return;
    // Any cached responses belong to whoever was signed in before.
    api.clearCaches();
    if (!clerkUserId) {
      setProfile(null);
      setWallet(null);
      setRole(null);
      setDbLoading(false);
      return;
    }
    let stale = false;
    const snapshot = readSnapshot(clerkUserId);
    // Never keep the previous account's data on screen while the new one loads.
    setProfile(snapshot?.profile ? { ...snapshot.profile } : null);
    setWallet(null);
    setRole(snapshot?.role ?? null);
    setDbLoading(!snapshot);
    void fetchUserData(clerkUserId, () => stale).finally(() => {
      if (!stale) setDbLoading(false);
    });
    return () => {
      stale = true;
    };
  }, [clerkUserId, clerkLoaded, fetchUserData]);

  // Keep the snapshot in step with profile edits.
  useEffect(() => {
    if (clerkUserId && role && profile) {
      writeSnapshot(clerkUserId, toSnapshot(profile, role));
    }
  }, [clerkUserId, profile, role]);

  const signIn = useCallback(async () => {
    openSignIn();
    return { error: null };
  }, [openSignIn]);

  const signUp = useCallback(async () => {
    openSignUp();
    return { error: null };
  }, [openSignUp]);

  const signOut = useCallback(async () => {
    clearSnapshot();
    api.clearCaches();
    await clerkSignOut();
    setProfile(null);
    setWallet(null);
    setRole(null);
  }, [clerkSignOut]);

  const refreshProfile = useCallback(async () => {
    if (!clerkUserId) return;
    try {
      const profile = await api.getSettings();
      if (profile) setProfile(normalizeProfile(profile));
    } catch (e) {}
  }, [clerkUserId]);

  const refreshWallet = useCallback(async () => {
    if (!clerkUserId) return;
    try {
      const { wallet } = await api.getWallet();
      if (wallet) setWallet(wallet);
    } catch (e) {}
  }, [clerkUserId]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session: clerkSession,
      profile,
      wallet,
      role,
      isLoading: !clerkLoaded || dbLoading,
      isAdmin: role === 'admin',
      signIn,
      signUp,
      signOut,
      refreshProfile,
      refreshWallet,
    }),
    [user, clerkSession, profile, wallet, role, clerkLoaded, dbLoading, signIn, signUp, signOut, refreshProfile, refreshWallet],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
