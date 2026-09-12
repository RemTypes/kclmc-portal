'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROLE_NAMES, Role } from '@/lib/auth';

export default function Navigation() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role>(0);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  useEffect(() => {
    const cookies = document.cookie.split(';').reduce((acc, c) => {
      const [k, v] = c.trim().split('=');
      if (k && v) acc[k] = decodeURIComponent(v);
      return acc;
    }, {} as Record<string, string>);

    if (cookies['user_role_override']) {
      const parsed = parseInt(cookies['user_role_override'], 10);
      if (parsed === 0 || parsed === 1 || parsed === 2) setRole(parsed as Role);
    }
  }, [pathname]);

  const handleSwitchRole = (newRole: Role) => {
    setRole(newRole);
    document.cookie = `user_role_override=${newRole}; path=/; max-age=86400`;
    setShowRoleMenu(false);
    window.location.reload();
  };

  const isLube = pathname.startsWith('/lube') || pathname.startsWith('/scoring') || pathname.startsWith('/comps') || pathname.startsWith('/leaderboard') || pathname.startsWith('/drops/lube');

  return (
    <nav className="bg-[#0D0F14] text-white py-3 px-6 md:px-8 flex flex-wrap justify-between items-center border-b border-white/10 sticky top-0 z-40 backdrop-blur-md bg-opacity-95">
      <div className="flex flex-wrap space-x-4 md:space-x-6 items-center">
        <Link href="/" className="font-black text-sm tracking-wider hover:opacity-80 transition-opacity">
          HUB
        </Link>
        
        <div className="w-px h-4 bg-white/20"></div>

        {/* KCLMC Group */}
        <Link 
          href="/club" 
          className={`font-bold text-sm transition-colors ${
            pathname.startsWith('/club') || pathname.startsWith('/kclmc') || pathname.startsWith('/trips') || pathname.startsWith('/guides')
              ? 'text-[#FFBD59]'
              : 'text-zinc-300 hover:text-[#FFBD59]'
          }`}
        >
          CLUB
        </Link>
        <Link href="/trips" className={`text-xs transition-colors ${pathname.startsWith('/trips') ? 'text-[#FFBD59]' : 'text-zinc-400 hover:text-[#FFBD59]'}`}>
          Trips
        </Link>
        <Link href="/guides" className={`text-xs transition-colors ${pathname.startsWith('/guides') ? 'text-[#FFBD59]' : 'text-zinc-400 hover:text-[#FFBD59]'}`}>
          Guides
        </Link>
        <Link href="/drops/kclmc" className={`text-xs transition-colors ${pathname.startsWith('/drops/kclmc') ? 'text-[#FFBD59]' : 'text-zinc-400 hover:text-[#FFBD59]'}`}>
          Club Drops
        </Link>

        <div className="w-px h-4 bg-white/20"></div>

        {/* LUBE Group */}
        <Link 
          href="/lube" 
          className={`font-bold text-sm tracking-wide transition-colors ${
            isLube ? 'text-[#F5F5F0]' : 'text-zinc-400 hover:text-[#F5F5F0]'
          }`}
        >
          LUBE
        </Link>
        <Link href="/comps" className="text-xs text-zinc-400 hover:text-[#F5F5F0] transition-colors">
          Comps
        </Link>
        <Link href="/leaderboard" className="text-xs text-zinc-400 hover:text-[#F5F5F0] transition-colors">
          Rankings
        </Link>
        <Link href="/drops/lube" className="text-xs text-zinc-400 hover:text-[#F5F5F0] transition-colors">
          Chalk Drop
        </Link>
      </div>

      {/* Admin & RBAC Identity Pill */}
      <div className="flex items-center space-x-3 mt-2 sm:mt-0">
        <Link 
          href="/admin" 
          className={`text-xs font-bold px-2.5 py-1 rounded transition-colors ${
            pathname.startsWith('/admin')
              ? 'bg-blue-600 text-white'
              : 'text-blue-400 hover:bg-blue-950/60 border border-blue-800/60'
          }`}
        >
          ADMIN
        </Link>

        {/* Identity Badge with Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className={`text-[11px] font-mono px-2 py-0.5 rounded border flex items-center gap-1.5 transition-colors ${
              role === 2
                ? 'bg-red-950/80 border-red-700 text-red-300'
                : role === 1
                ? 'bg-blue-950/80 border-blue-700 text-blue-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
          >
            <span>{ROLE_NAMES[role]}</span>
            <span className="text-[9px]">▾</span>
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-1 z-50 text-xs font-sans">
              <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                Simulate Role
              </div>
              {([0, 1, 2] as Role[]).map(r => (
                <button
                  key={r}
                  onClick={() => handleSwitchRole(r)}
                  className={`w-full text-left px-2 py-1.5 rounded hover:bg-zinc-800 flex justify-between items-center ${
                    role === r ? 'font-bold text-white bg-zinc-800/80' : 'text-zinc-400'
                  }`}
                >
                  <span>{ROLE_NAMES[r]}</span>
                  {role === r && <span className="text-emerald-400">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
