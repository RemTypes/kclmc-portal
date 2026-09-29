'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function ForbiddenContent() {
  const searchParams = useSearchParams();
  const fromPath = searchParams.get('from') || '/admin';
  const req = searchParams.get('req') || 'committee';

  return (
    <div className="min-h-screen bg-[#041F1E] text-slate-100 flex items-center justify-center p-6 font-sans relative overflow-hidden topo-pattern">
      <div className="max-w-lg w-full bg-[#052322] border-2 border-red-900/60 rounded-3xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center gap-3 mb-6">
          <span className="px-2.5 py-1 bg-red-950/90 border border-red-700 text-red-400 text-xs font-mono font-bold uppercase rounded">
            HTTP 403 Forbidden
          </span>
          <span className="text-xs text-zinc-400 font-mono">RBAC Security Guard</span>
        </div>

        <h1 className="text-3xl font-black text-white font-heading uppercase tracking-wide mb-3">
          Restricted Access Area
        </h1>

        <p className="text-sm text-zinc-300 mb-6 leading-relaxed">
          {req === 'superadmin' ? (
            <>
              The requested route (<code className="text-red-400 font-mono text-xs">{fromPath}</code>) contains proprietary analytics and is restricted to the club lead whitelist.
            </>
          ) : (
            <>
              The route (<code className="text-[#FFBD59] font-mono text-xs">{fromPath}</code>) is restricted to King&apos;s College London Mountaineering Club Committee officers.
            </>
          )}
        </p>

        {/* Access Level Badge */}
        <div className="p-4 bg-[#084746]/60 border border-[#0D5F5E] rounded-2xl mb-8 text-xs space-y-2.5 font-mono">
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Target Resource:</span>
            <span className="font-bold text-white bg-black/30 px-2 py-0.5 rounded">{fromPath}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Required Clearance:</span>
            <span className="font-bold text-[#FFBD59] uppercase">
              {req === 'superadmin' ? 'Tier 2 (SuperAdmin)' : 'Tier 1 (Committee Officer)'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mb-6">
          <Link
            href={`/login?next=${encodeURIComponent(fromPath)}`}
            className="w-full block text-center bg-[#FFBD59] hover:bg-[#FFE0A3] text-[#052322] font-heading font-black text-sm uppercase tracking-wider py-3 rounded-xl transition-colors shadow-md"
          >
            Sign In with Committee Account →
          </Link>
          <Link
            href="/"
            className="w-full block text-center bg-[#084746] hover:bg-[#0D5F5E] border border-white/10 text-white font-heading font-bold text-sm uppercase tracking-wider py-2.5 rounded-xl transition-colors"
          >
            Return to Public Hub
          </Link>
        </div>

        <div className="flex justify-between items-center text-xs text-zinc-400 pt-4 border-t border-white/10 font-mono">
          <span>Need access? Contact Committee</span>
          <a
            href="https://www.instagram.com/kclmc/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FFBD59] hover:underline"
          >
            @kclmc Instagram ↗
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ForbiddenPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#041F1E] text-slate-100 p-8 font-mono">Loading security guard...</div>}>
      <ForbiddenContent />
    </Suspense>
  );
}
