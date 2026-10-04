'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me', { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          return;
        }
      }
      setUser(null);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    checkAuth();
    const handleFocus = () => checkAuth();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    setUser(null);
    router.push('/');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 shadow-md">
      {/* 1. Top Utility Strip */}
      <div className="bg-[#041F1E] text-zinc-300 text-[11px] py-1.5 px-6 md:px-8 flex justify-between items-center border-b border-[#FFBD59]/15">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FFBD59]"></span>
          <span className="font-sans font-medium text-zinc-300">
            King's College London Mountaineering &amp; Climbing Club <span className="text-zinc-500 mx-1">|</span> KCLSU Accredited Society
          </span>
        </div>
        <div className="flex items-center gap-4 text-zinc-400">
          <a
            href="https://www.instagram.com/kclmc/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#FFBD59] transition-colors hidden sm:inline"
          >
            @kclmc Instagram ↗
          </a>
          <a
            href="https://www.kclsu.org/groups/sports/join/mountaineerclimbsoc/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#FFBD59] transition-colors hidden md:inline"
          >
            KCLSU Portal ↗
          </a>
          <Link
            href="/admin"
            className={`transition-colors ${
              pathname.startsWith('/admin')
                ? 'text-[#FFBD59] font-bold'
                : 'hover:text-[#FFBD59]'
            }`}
          >
            Admin
          </Link>
        </div>
      </div>

      {/* 2. Main Navigation Bar */}
      <nav className="bg-[#052322] text-white py-3 px-6 md:px-8 flex justify-between items-center border-b border-[#084746]">
        <div className="flex items-center gap-8">
          {/* Logo / Crest */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded bg-[#084746] border border-[#FFBD59]/50 flex items-center justify-center text-base shadow-sm group-hover:border-[#FFBD59] transition-colors">
              🏔️
            </div>
            <div>
              <div className="font-heading font-black text-xl tracking-wider text-[#FFBD59] group-hover:text-[#FFE0A3] transition-colors leading-none">
                KCLMC
              </div>
              <div className="text-[10px] font-sans uppercase tracking-widest text-zinc-400 leading-tight">
                Est. 1928
              </div>
            </div>
          </Link>

          {/* Club Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            {/* Trips & Meets temporarily disabled while schedule is being finalized in preview */}
            <Link 
              href="/guides" 
              className={`font-heading text-base uppercase tracking-wider font-bold transition-colors ${
                pathname.startsWith('/guides') ? 'text-[#FFBD59]' : 'text-zinc-200 hover:text-[#FFBD59]'
              }`}
            >
              Where We Climb
            </Link>
            <Link 
              href="/drops/kclmc" 
              className={`font-heading text-base uppercase tracking-wider font-bold transition-colors ${
                pathname.startsWith('/drops/kclmc') ? 'text-[#FFBD59]' : 'text-zinc-200 hover:text-[#FFBD59]'
              }`}
            >
              Club Merch
            </Link>
            <Link 
              href="/membership" 
              className={`font-heading text-base uppercase tracking-wider font-bold transition-colors ${
                pathname.startsWith('/membership') ? 'text-[#FFBD59]' : 'text-[#FFBD59]/90 hover:text-[#FFBD59]'
              }`}
            >
              ★ Membership
            </Link>
          </div>
        </div>

        {/* Right CTA / Auth Status */}
        <div className="flex items-center space-x-3">
          {user ? (
            <div className="flex items-center space-x-3">
              <Link
                href="/membership"
                className="text-xs font-mono px-3 py-1.5 rounded bg-[#084746] border border-[#FFBD59]/40 text-[#FFBD59] hover:bg-[#084746]/80 transition-colors"
              >
                {user.email?.split('@')[0]}
              </Link>
              <button
                onClick={handleSignOut}
                className="text-xs text-zinc-400 hover:text-red-400 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="hidden sm:inline-block text-xs font-heading uppercase tracking-wider font-bold text-zinc-300 hover:text-white px-3 py-1.5 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/membership"
                className="kclmc-btn-primary text-xs py-2 px-4 font-bold"
              >
                <span>Get Pass</span>
                <span>→</span>
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
