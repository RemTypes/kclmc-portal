'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log sanitized error info for operational debugging without leaking user data
    console.error('[KCLMC Runtime Error Boundary]:', error?.message || error);
  }, [error]);

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-6 py-20 bg-[#052322] text-white">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-4xl shadow-xl shadow-black/40">
          ⚠️
        </div>

        <div className="space-y-2">
          <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs uppercase tracking-widest">
            Application Error
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-black text-white tracking-wide">
            A HOLD SLIPPED
          </h1>
          <p className="text-sm text-zinc-300 font-sans leading-relaxed">
            An unexpected error occurred while loading this page. Don&apos;t worry — your session and climbing data remain safe.
          </p>
          {error?.digest && (
            <p className="text-[11px] font-mono text-zinc-500 pt-1">
              Error Digest: {error.digest}
            </p>
          )}
        </div>

        <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="kclmc-btn-primary py-3 px-6 text-sm font-bold flex items-center justify-center gap-2"
          >
            <span>Try Again</span>
            <span>↺</span>
          </button>
          <Link
            href="/"
            className="py-3 px-5 rounded bg-[#084746] border border-[#FFBD59]/30 text-white hover:text-[#FFBD59] hover:border-[#FFBD59] transition-colors text-sm font-heading uppercase tracking-wider font-semibold flex items-center justify-center"
          >
            Return to Club Hub
          </Link>
        </div>

        <div className="pt-8 border-t border-[#084746]/60 text-xs text-zinc-400 font-sans">
          If this issue persists, please report it to{' '}
          <a
            href="mailto:kclmc.committee@gmail.com"
            className="text-[#FFBD59] hover:underline"
          >
            kclmc.committee@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}
