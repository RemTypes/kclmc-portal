'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    setMobileMenuOpen(false); // Close mobile menu when navigating
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
    setMobileMenuOpen(false);
    router.push('/');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 shadow-md">
      {/* 1. Top Utility Strip */}
      <div className="bg-[#041F1E] text-zinc-300 text-[11px] py-1.5 px-4 sm:px-6 md:px-8 flex justify-between items-center border-b border-[#FFBD59]/15">
        <div className="flex items-center gap-2 truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FFBD59] shrink-0"></span>
          <span className="font-sans font-medium text-zinc-300 truncate">
            King's College London Mountaineering &amp; Climbing Club <span className="text-zinc-500 mx-1 hidden sm:inline">|</span> <span className="hidden sm:inline">KCLSU Accredited Society</span>
          </span>
        </div>
        <div className="flex items-center gap-4 text-zinc-400 shrink-0">
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
      <nav className="bg-[#052322] text-white py-3 px-4 sm:px-6 md:px-8 flex justify-between items-center border-b border-[#084746]">
        <div className="flex items-center gap-8">
          {/* Logo / Crest */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg bg-[#084746] border border-[#FFBD59]/50 overflow-hidden flex items-center justify-center shadow-sm group-hover:border-[#FFBD59] transition-all p-1">
              <Image
                src="/images/kclmc-logo.png"
                alt="KCLMC Logo"
                width={36}
                height={36}
                priority
                className="w-full h-full object-contain"
              />
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

          {/* Desktop Club Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
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
              href="/trips" 
              className={`font-heading text-base uppercase tracking-wider font-bold transition-colors ${
                pathname.startsWith('/trips') ? 'text-[#FFBD59]' : 'text-zinc-200 hover:text-[#FFBD59]'
              }`}
            >
              Trips
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
        <div className="flex items-center space-x-2 sm:space-x-3">
          {user ? (
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Link
                href="/membership"
                className="text-xs font-mono px-2.5 sm:px-3 py-1.5 rounded bg-[#084746] border border-[#FFBD59]/40 text-[#FFBD59] hover:bg-[#084746]/80 transition-colors truncate max-w-[120px] sm:max-w-[180px]"
              >
                {user.email?.split('@')[0]}
              </Link>
              <button
                onClick={handleSignOut}
                className="hidden sm:inline-block text-xs text-zinc-400 hover:text-red-400 transition-colors"
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
                className="kclmc-btn-primary text-xs py-2 px-3 sm:px-4 font-bold"
              >
                <span>Get Pass</span>
                <span>→</span>
              </Link>
            </div>
          )}

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-[#084746]/60 border border-[#FFBD59]/30 text-[#FFBD59] hover:bg-[#084746] transition-colors focus:outline-none focus:ring-2 focus:ring-[#FFBD59]/50"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* 3. Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#041F1E] border-b border-[#084746] px-6 py-5 space-y-4 shadow-2xl animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-1">
            <Link
              href="/guides"
              className={`flex items-center justify-between py-2.5 px-3 rounded-lg text-sm font-heading uppercase tracking-wider font-bold transition-colors ${
                pathname.startsWith('/guides')
                  ? 'bg-[#084746] text-[#FFBD59]'
                  : 'text-zinc-200 hover:bg-[#052322] hover:text-[#FFBD59]'
              }`}
            >
              <span>Where We Climb</span>
              <span className="text-xs font-mono text-zinc-500">Guides →</span>
            </Link>
            <Link
              href="/drops/kclmc"
              className={`flex items-center justify-between py-2.5 px-3 rounded-lg text-sm font-heading uppercase tracking-wider font-bold transition-colors ${
                pathname.startsWith('/drops/kclmc')
                  ? 'bg-[#084746] text-[#FFBD59]'
                  : 'text-zinc-200 hover:bg-[#052322] hover:text-[#FFBD59]'
              }`}
            >
              <span>Club Merch</span>
              <span className="text-xs font-mono text-zinc-500">Stash →</span>
            </Link>
            <Link
              href="/trips"
              className={`flex items-center justify-between py-2.5 px-3 rounded-lg text-sm font-heading uppercase tracking-wider font-bold transition-colors ${
                pathname.startsWith('/trips')
                  ? 'bg-[#084746] text-[#FFBD59]'
                  : 'text-zinc-200 hover:bg-[#052322] hover:text-[#FFBD59]'
              }`}
            >
              <span>Trips &amp; Meets</span>
              <span className="text-xs font-mono text-[#FFBD59]/80">Calendar →</span>
            </Link>
            <Link
              href="/membership"
              className={`flex items-center justify-between py-2.5 px-3 rounded-lg text-sm font-heading uppercase tracking-wider font-bold transition-colors ${
                pathname.startsWith('/membership')
                  ? 'bg-[#084746] text-[#FFBD59]'
                  : 'text-[#FFBD59] hover:bg-[#052322]'
              }`}
            >
              <span>★ My Membership Pass</span>
              <span className="text-xs font-mono text-[#FFBD59]">View Pass →</span>
            </Link>
          </div>

          <div className="pt-3 border-t border-[#084746] space-y-2">
            {user ? (
              <div className="flex items-center justify-between py-2 px-1">
                <span className="text-xs font-mono text-zinc-400 truncate max-w-[200px]">
                  Logged in: <strong className="text-[#FFBD59]">{user.email}</strong>
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-xs font-heading uppercase font-bold text-red-400 hover:text-red-300 py-1.5 px-3 rounded bg-red-950/30 border border-red-800/40"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  href="/login"
                  className="py-2.5 px-4 rounded bg-[#084746] border border-[#FFBD59]/30 text-white hover:text-[#FFBD59] text-center text-xs font-heading uppercase tracking-wider font-bold transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/membership"
                  className="kclmc-btn-primary py-2.5 px-4 text-center text-xs font-heading uppercase tracking-wider font-bold"
                >
                  Get Pass →
                </Link>
              </div>
            )}

            <div className="pt-2 flex justify-between items-center text-[11px] text-zinc-400 px-1">
              <Link href="/admin" className="hover:text-[#FFBD59] transition-colors">
                Committee Admin Portal ↗
              </Link>
              <a
                href="https://www.instagram.com/kclmc/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#FFBD59] transition-colors"
              >
                @kclmc Instagram ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
