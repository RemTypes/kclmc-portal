import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-6 py-20 bg-[#052322] text-white">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-[#084746] border border-[#FFBD59]/40 overflow-hidden flex items-center justify-center p-2.5 shadow-xl shadow-black/40">
          <Image
            src="/images/kclmc-logo.png"
            alt="KCLMC Logo"
            width={72}
            height={72}
            className="w-full h-full object-contain"
          />
        </div>

        <div className="space-y-2">
          <div className="inline-block px-3 py-1 rounded-full bg-[#FFBD59]/10 border border-[#FFBD59]/30 text-[#FFBD59] font-mono text-xs uppercase tracking-widest">
            Error 404 // Off Route
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-black text-white tracking-wide">
            PITCH NOT FOUND
          </h1>
          <p className="text-sm text-zinc-300 font-sans leading-relaxed">
            Looks like you&apos;ve traversed into uncharted terrain. The page or route you were looking for doesn&apos;t exist or has moved.
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="kclmc-btn-primary py-3 px-6 text-sm font-bold flex items-center justify-center gap-2"
          >
            <span>Return to Club Hub</span>
            <span>→</span>
          </Link>
          <Link
            href="/membership"
            className="py-3 px-5 rounded bg-[#084746] border border-[#FFBD59]/30 text-white hover:text-[#FFBD59] hover:border-[#FFBD59] transition-colors text-sm font-heading uppercase tracking-wider font-semibold flex items-center justify-center"
          >
            My Digital Pass
          </Link>
        </div>

        <div className="pt-8 border-t border-[#084746]/60 text-xs text-zinc-400 font-sans">
          Need assistance? Contact the committee at{' '}
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
