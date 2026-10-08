'use client';

import React, { useEffect } from 'react';
import { captureException } from '@/lib/monitoring';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report unhandled root-level crash to monitoring gateway
    captureException(error, { digest: error?.digest });
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#052322] text-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-4xl shadow-xl">
            ⚠️
          </div>
          <div className="space-y-2">
            <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs uppercase tracking-widest">
              Critical Platform Error
            </div>
            <h1 className="text-3xl font-black uppercase tracking-wide">
              SYSTEM RECOVERY
            </h1>
            <p className="text-sm text-zinc-300">
              A critical runtime error was intercepted by the root platform boundary. The incident has been logged for committee review.
            </p>
            {error?.digest && (
              <p className="text-[11px] font-mono text-zinc-500">
                Digest: {error.digest}
              </p>
            )}
          </div>
          <div className="pt-4 flex gap-3 justify-center">
            <button
              onClick={() => reset()}
              className="px-6 py-3 bg-[#FFBD59] text-[#052322] font-bold rounded-xl hover:bg-[#FFE0A3] transition-all text-sm uppercase tracking-wider"
            >
              Restart Platform ↺
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
