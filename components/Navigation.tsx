'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
    router.refresh();
  };

  return (
    <nav className="bg-[#041F1E] text-white py-3 px-6 md:px-8 flex flex-wrap justify-between items-center border-b border-[#FFBD59]/20 sticky top-0 z-40 backdrop-blur-md bg-opacity-95 font-sans">
      <div className="flex flex-wrap space-x-4 md:space-x-6 items-center">
        <Link href="/" className="font-serif font-black text-sm tracking-wider text-[#FFBD59] hover:opacity-80 transition-opacity">
          KCLMC
        </Link>
        
        <div className="w-px h-4 bg-[#FFBD59]/30"></div>

        {/* Club Navigation Links */}
        <Link 
          href="/trips" 
          className={`text-xs transition-colors ${pathname.startsWith('/trips') ? 'text-[#FFBD59]' : 'text-zinc-400 hover:text-[#FFBD59]'}`}
        >
          Trips
        </Link>
        <Link 
          href="/guides" 
          className={`text-xs transition-colors ${pathname.startsWith('/guides') ? 'text-[#FFBD59]' : 'text-zinc-400 hover:text-[#FFBD59]'}`}
        >
          Guides
        </Link>
        <Link 
          href="/drops/kclmc" 
          className={`text-xs transition-colors ${pathname.startsWith('/drops/kclmc') ? 'text-[#FFBD59]' : 'text-zinc-400 hover:text-[#FFBD59]'}`}
        >
          Merch Drops
        </Link>
        <Link 
          href="/membership" 
          className={`text-xs transition-colors font-semibold ${pathname.startsWith('/membership') ? 'text-[#FFBD59]' : 'text-emerald-400 hover:text-emerald-300'}`}
        >
          ★ Membership
        </Link>
      </div>

      {/* Auth & Admin Controls */}
      <div className="flex items-center space-x-3 mt-2 sm:mt-0 font-mono text-xs">
        <Link 
          href="/admin" 
          className={`px-2.5 py-1 rounded transition-colors ${
            pathname.startsWith('/admin')
              ? 'bg-blue-600 text-white font-bold'
              : 'text-blue-400 hover:bg-blue-950/60 border border-blue-800/60'
          }`}
        >
          Admin
        </Link>

        {user ? (
          <div className="flex items-center space-x-2">
            <Link
              href="/membership"
              className="text-[11px] px-2.5 py-1 rounded bg-[#084746] border border-[#FFBD59]/40 text-[#FFBD59] hover:bg-[#084746]/80 transition-colors"
            >
              {user.email?.split('@')[0]}
            </Link>
            <button
              onClick={handleSignOut}
              className="text-[11px] text-zinc-400 hover:text-red-400 transition-colors"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="px-3 py-1 bg-[#FFBD59] text-[#052322] font-bold rounded hover:bg-[#FFE0A3] transition-colors shadow"
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
