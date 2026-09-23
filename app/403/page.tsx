'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ROLE_NAMES, Role } from '@/lib/auth';

function ForbiddenContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const fromPath = searchParams.get('from') || '/admin';
  const req = searchParams.get('req') || 'superadmin';

  const handleSwitchRole = (role: Role) => {
    document.cookie = `user_role_override=${role}; path=/; max-age=86400`;
    // If setting superadmin and route was requested, navigate back
    if (role === 2 && req === 'superadmin') {
      router.push(fromPath);
    } else if (role >= 1 && req === 'committee') {
      router.push(fromPath);
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-black text-gray-200 flex items-center justify-center p-6 font-mono">
      <div className="max-w-lg w-full bg-zinc-950 border border-red-900/60 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center gap-3 mb-6">
          <span className="px-2.5 py-1 bg-red-950/80 border border-red-800 text-red-400 text-xs font-bold uppercase rounded">
            HTTP 403 Forbidden
          </span>
          <span className="text-xs text-zinc-500">RBAC Security Guard</span>
        </div>

        <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
          Restricted Access Area
        </h1>

        <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
          {req === 'superadmin' ? (
            <>
              The requested route (<code className="text-red-400">{fromPath}</code>) contains proprietary ML telemetry models and is locked down strictly to the club lead&apos;s personal whitelist.
            </>
          ) : (
            <>
              The route (<code className="text-amber-400">{fromPath}</code>) is restricted to King&apos;s College London Mountaineering Club Committee officers.
            </>
          )}
        </p>

        {/* Access Level Badge */}
        <div className="p-4 bg-zinc-900/90 border border-zinc-800 rounded-xl mb-6 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-zinc-500">Target Resource:</span>
            <span className="font-bold text-zinc-300">{fromPath}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Required Clearance:</span>
            <span className="font-bold text-red-400">
              {req === 'superadmin' ? 'Tier 2 (SuperAdmin Only)' : 'Tier 1 (Committee)'}
            </span>
          </div>
        </div>

        {/* Development Auth Switcher */}
        <div className="border-t border-zinc-800 pt-5 mb-6">
          <p className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">
            Development Simulation: Switch Identity
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleSwitchRole(0)}
              className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded text-[11px] font-bold text-zinc-300"
            >
              Public
            </button>
            <button
              onClick={() => handleSwitchRole(1)}
              className="px-3 py-2 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800 rounded text-[11px] font-bold text-blue-300"
            >
              Committee
            </button>
            <button
              onClick={() => handleSwitchRole(2)}
              className="px-3 py-2 bg-red-950/80 hover:bg-red-900/80 border border-red-700 rounded text-[11px] font-bold text-red-300"
            >
              SuperAdmin
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 mt-2">
            Clicking SuperAdmin sets the session cookie and grants immediate access to the ML Telemetry suite.
          </p>
        </div>

        <div className="flex justify-between items-center text-xs">
          <Link href="/" className="text-zinc-400 hover:text-white underline">
            Return to Public Hub
          </Link>
          <Link href="/admin" className="text-zinc-400 hover:text-white underline">
            Committee Admin
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ForbiddenPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-gray-200 p-8">Loading...</div>}>
      <ForbiddenContent />
    </Suspense>
  );
}
