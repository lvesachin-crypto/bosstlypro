import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { SignIn, SignUp, useUser } from '@clerk/react';
import logo from '@/assets/logo.png';
import { PageMeta } from '@/components/seo/PageMeta';
import { ArrowLeft } from 'lucide-react';
import { dark } from '@clerk/themes';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Auth() {
  const { isSignedIn, isLoaded } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const isSignUp = location.pathname.includes('/sign-up');

  useEffect(() => {
    if (isLoaded && isSignedIn) navigate('/dashboard');
  }, [isSignedIn, isLoaded, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: 'linear-gradient(180deg, #EAF1FF 0%, #F4F7FF 60%, #DCE7FF 100%)' }}>
      <PageMeta
        title={!isSignUp ? 'Sign in — Boostly Pro' : 'Create your account — Boostly Pro'}
        description="Sign in or create your free Boostly Pro account to launch organic Instagram, YouTube and TikTok growth campaigns. No credit card required."
        canonicalPath={isSignUp ? "/sign-up" : "/sign-in"}
      />
      <div className="w-full max-w-[400px]">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2.5 mb-10">
            <img src={logo} alt="Boostly Pro platform logo" className="w-10 h-10 rounded-xl object-cover shadow-sm" />
            <div className="flex flex-col">
              <span className="text-[16px] font-bold tracking-tight" style={{ color: '#111827' }}>Boostly Pro</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: '#111827' }}>✦ Updated Version</span>
            </div>
          </div>

          <Link to="/" className="inline-flex items-center gap-1.5 text-[12px] font-medium mb-8" style={{ color: '#999' }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back to home
          </Link>

          <div className="flex justify-center">
            {isSignUp ? (
              <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} appearance={{
                elements: {
                  formButtonPrimary: "bg-[#2563EB] hover:bg-[#1d4ed8] text-white",
                  card: "bg-white shadow-xl border border-gray-100"
                }
              }} />
            ) : (
              <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} appearance={{
                elements: {
                  formButtonPrimary: "bg-[#2563EB] hover:bg-[#1d4ed8] text-white",
                  card: "bg-white shadow-xl border border-gray-100"
                }
              }} />
            )}
          </div>

          {/* Telegram */}
          <a href="https://t.me/boostlypro" target="_blank" rel="noopener noreferrer" className="mt-8 flex items-center gap-3 p-3.5 rounded-xl transition-colors" style={{ border: '1px solid rgba(0,0,0,.06)', background: 'white' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#0088cc15' }}>
              <svg className="w-4 h-4 fill-[#0088cc]" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.52-.46-.01-1.33-.26-1.98-.48-.8-.27-1.43-.42-1.37-.89.03-.25.38-.51 1.03-.78 4.04-1.76 6.74-2.92 8.09-3.48 3.85-1.61.8-1.88 1.77-1.88.21 0 .69.05.99.23.32.19.43.46.46.72.02.16.01.32-.01.48z" /></svg>
            </div>
            <div>
              <p className="text-[12px] font-semibold" style={{ color: '#111827' }}>Join our Telegram</p>
              <p className="text-[11px]" style={{ color: '#999' }}>Updates & support</p>
            </div>
          </a>
      </div>
    </div>
  );
}
