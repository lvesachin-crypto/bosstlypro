import { createContext, useContext, ReactNode, useEffect, useState, useCallback } from 'react';
import { useUser, useClerk, useSession } from '@clerk/react';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { signOut: clerkSignOut, openSignIn, openSignUp } = useClerk();
  const { session: clerkSession } = useSession();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [dbLoading, setDbLoading] = useState(true);

  // We map clerk user to the shape the app expects
  const user = clerkUser ? {
    id: clerkUser.id,
    email: clerkUser.primaryEmailAddress?.emailAddress
  } : null;

  const fetchUserData = useCallback(async () => {
    try {
      const data = await api.getDashboard();
       if (data.profile) {
         setProfile({
           ...data.profile,
           full_name: data.profile.full_name ?? data.profile.fullName ?? null,
         });
       }
      if (data.wallet) setWallet(data.wallet);
      setRole(data.role === 'admin' ? 'admin' : 'user');
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }, []);

  useEffect(() => {
    if (clerkLoaded) {
      if (clerkUser) {
        fetchUserData().finally(() => setDbLoading(false));
      } else {
        setProfile(null);
        setWallet(null);
        setRole(null);
        setDbLoading(false);
      }
    }
  }, [clerkUser, clerkLoaded, fetchUserData]);

  const signIn = async () => {
    openSignIn();
    return { error: null };
  };

  const signUp = async () => {
    openSignUp();
    return { error: null };
  };

  const signOut = async () => {
    await clerkSignOut();
    setProfile(null);
    setWallet(null);
    setRole(null);
  };

  const refreshProfile = async () => {
    if (user) {
      try {
        const profile = await api.getSettings();
        if (profile) setProfile(profile);
      } catch (e) {}
    }
  };

  const refreshWallet = async () => {
    if (user) {
      try {
        const { wallet } = await api.getWallet();
        if (wallet) setWallet(wallet);
      } catch (e) {}
    }
  };

  const value = {
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
