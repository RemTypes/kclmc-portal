'use client';

import React from 'react';
import Link from 'next/link';

export default function TripsPage() {
  return (
    <div className="min-h-screen bg-[#041F1E] text-[#F7F7F7] p-6 md:p-12 relative overflow-hidden font-sans topo-pattern">
      <div className="max-w-4xl mx-auto relative z-10 py-12">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#084746] border border-[#FFBD59]/40 text-[#FFBD59] text-xs font-mono uppercase tracking-widest mb-6">
          <span>🏔️</span>
          <span>2026/27 Outdoor Programme</span>
        </div>

        {/* Main Heading */}
        <h1 className="text-4xl md:text-6xl font-black font-heading uppercase tracking-tight text-[#FFBD59] mb-4">
          Meets &amp; Expeditions
        </h1>

        <p className="text-zinc-300 text-base md:text-lg mb-8 max-w-2xl leading-relaxed">
          Our weekend outdoor meets, Southern Sandstone day trips, Scottish Winter, and Summer Alpine expeditions are currently being finalized with KCLSU and qualified mountain guides.
        </p>

        {/* Status Callout Box */}
        <div className="bg-[#052322] border border-[#FFBD59]/30 rounded-3xl p-8 mb-10 shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-3 h-3 rounded-full bg-[#FFBD59] animate-pulse"></span>
            <span className="font-heading font-bold text-sm uppercase tracking-wider text-[#FFBD59]">
              Schedule Launching Soon
            </span>
          </div>

          <p className="text-zinc-300 text-sm leading-relaxed mb-6 font-sans">
            Full trip dates, bunkhouse bookings, transport details, and online registration forms will open right here for the new term. In the meantime, get your membership pass ready and join our active weekly wall sessions!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-[#084746] text-xs font-mono">
            <div className="p-4 rounded-xl bg-[#084746]/50 border border-[#FFBD59]/20">
              <span className="text-[#FFBD59] font-bold block mb-1 uppercase">🧗 Weekly Wall Sessions Active</span>
              <span className="text-zinc-300">
                Monday VauxWall East (16:00–20:00) and Wednesday The Castle (15:00–19:00) require no advance booking. Just drop in!
              </span>
            </div>
            <div className="p-4 rounded-xl bg-[#084746]/50 border border-[#FFBD59]/20">
              <span className="text-emerald-400 font-bold block mb-1 uppercase">🎫 Get Your Pass First</span>
              <span className="text-zinc-300">
                You must hold an active KCLSU Recreational membership pass to attend outdoor rock climbing meets.
              </span>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/membership"
              className="px-6 py-3 bg-[#FFBD59] hover:bg-[#FFE0A3] text-[#052322] font-mono text-xs font-bold uppercase rounded-xl transition-colors shadow"
            >
              Get Membership Pass →
            </Link>
            <Link
              href="/guides"
              className="px-6 py-3 bg-[#084746] hover:bg-[#0b5c5b] text-[#FFBD59] font-mono text-xs font-bold uppercase rounded-xl border border-[#FFBD59]/40 transition-colors"
            >
              London Walls Beta ↗
            </Link>
            <a
              href="https://www.instagram.com/kclmc/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-transparent hover:bg-white/5 text-zinc-300 hover:text-white font-mono text-xs font-bold uppercase rounded-xl border border-zinc-700 transition-colors inline-flex items-center gap-1.5"
            >
              <span>📸</span>
              <span>Follow @kclmc Dispatches ↗</span>
            </a>
          </div>
        </div>

        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-[#FFBD59] transition-colors"
        >
          <span>←</span>
          <span>Back to Home</span>
        </Link>
      </div>
    </div>
  );
}
