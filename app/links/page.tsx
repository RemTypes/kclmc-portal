'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PortalLink, DEFAULT_PORTAL_LINKS } from '@/lib/links';

export default function LinksPage() {
  const [links, setLinks] = useState<PortalLink[]>(DEFAULT_PORTAL_LINKS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLinks() {
      try {
        const res = await fetch('/api/links');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.links) && data.links.length > 0) {
            setLinks(data.links);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch live bio links, using fallback:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLinks();
  }, []);

  return (
    <div className="min-h-screen bg-[#041F1E] text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 font-sans relative overflow-x-hidden topo-pattern">
      {/* Background radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#FFBD59]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md mx-auto pt-8 pb-10 flex-1 flex flex-col items-center relative z-10">
        {/* Profile Avatar / Club Crest */}
        <div className="relative mb-4 group">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#052322] border-2 border-[#FFBD59] p-3 shadow-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
            <Image
              src="/images/kclmc-logo.png"
              alt="KCLMC Crest"
              width={100}
              height={100}
              priority
              className="w-full h-full object-contain"
            />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-emerald-500 w-5 h-5 rounded-full border-2 border-[#041F1E] flex items-center justify-center" title="Active 2026/27 Academic Season">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          </div>
        </div>

        {/* Club Heading */}
        <h1 className="text-2xl sm:text-3xl font-black font-heading uppercase tracking-wide text-white text-center">
          KCL Mountaineering
        </h1>
        <p className="text-xs font-mono uppercase tracking-widest text-[#FFBD59] mt-1 text-center">
          @kclmc • London, UK
        </p>
        <p className="text-xs text-zinc-300 text-center max-w-xs mt-2 leading-relaxed font-sans">
          Accredited society of King&apos;s College London Students&apos; Union (KCLSU). Indoor bouldering, crag trips, and social meets.
        </p>

        {/* Social Icons Row */}
        <div className="flex items-center justify-center gap-3 mt-4 mb-6">
          <a
            href="https://www.instagram.com/kclmc/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-xl bg-[#052322] border border-[#084746] hover:border-[#FFBD59] flex items-center justify-center text-lg text-zinc-200 hover:text-[#FFBD59] transition-all hover:scale-105 shadow-md"
            title="Follow us on Instagram @kclmc"
          >
            📸
          </a>
          <a
            href="https://www.kclsu.org/groups/sports/join/mountaineerclimbsoc/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-xl bg-[#052322] border border-[#084746] hover:border-[#FFBD59] flex items-center justify-center text-lg text-zinc-200 hover:text-[#FFBD59] transition-all hover:scale-105 shadow-md"
            title="Official KCLSU Society Page"
          >
            🏛️
          </a>
          <a
            href="mailto:kclmc.committee@gmail.com"
            className="w-10 h-10 rounded-xl bg-[#052322] border border-[#084746] hover:border-[#FFBD59] flex items-center justify-center text-lg text-zinc-200 hover:text-[#FFBD59] transition-all hover:scale-105 shadow-md"
            title="Email the Committee"
          >
            ✉️
          </a>
          <Link
            href="/"
            className="w-10 h-10 rounded-xl bg-[#052322] border border-[#084746] hover:border-[#FFBD59] flex items-center justify-center text-lg text-zinc-200 hover:text-[#FFBD59] transition-all hover:scale-105 shadow-md"
            title="Official Website Hub"
          >
            🌐
          </Link>
        </div>

        {/* Link Cards Stack */}
        <div className="w-full space-y-3.5 mt-2">
          {links.map((link) => {
            const isExternal = link.url.startsWith('http') || link.url.startsWith('mailto:');
            const cardClasses = `block w-full p-4 rounded-2xl transition-all duration-200 text-left select-none group relative overflow-hidden ${
              link.is_highlighted
                ? 'bg-gradient-to-r from-[#084746] to-[#052322] border-2 border-[#FFBD59] shadow-[0_0_20px_rgba(255,189,89,0.2)] hover:shadow-[0_0_25px_rgba(255,189,89,0.35)] hover:-translate-y-0.5'
                : 'bg-[#052322]/90 border border-[#084746] hover:border-[#FFBD59]/60 hover:bg-[#084746]/70 hover:-translate-y-0.5 shadow-md'
            }`;

            const cardContent = (
              <div className="flex items-center justify-between gap-3 relative z-10">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-transform group-hover:scale-110 ${
                    link.is_highlighted ? 'bg-[#FFBD59] text-[#052322]' : 'bg-[#041F1E] border border-[#084746] text-zinc-200'
                  }`}>
                    {link.icon || '🔗'}
                  </div>
                  <div className="truncate">
                    {link.is_highlighted && (
                      <span className="inline-block text-[9px] font-mono uppercase tracking-wider text-[#FFBD59] font-black mb-0.5">
                        ★ Recommended Action
                      </span>
                    )}
                    <h2 className={`font-heading font-black text-sm sm:text-base uppercase tracking-wide truncate ${
                      link.is_highlighted ? 'text-white group-hover:text-[#FFBD59]' : 'text-zinc-100 group-hover:text-white'
                    }`}>
                      {link.title}
                    </h2>
                    {link.subtitle && (
                      <p className="text-[11px] text-zinc-300 font-sans truncate mt-0.5">
                        {link.subtitle}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-zinc-400 group-hover:text-[#FFBD59] group-hover:translate-x-0.5 transition-all text-sm shrink-0 pr-1">
                  {isExternal ? '↗' : '→'}
                </div>
              </div>
            );

            return isExternal ? (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cardClasses}
              >
                {cardContent}
              </a>
            ) : (
              <Link key={link.id} href={link.url} className={cardClasses}>
                {cardContent}
              </Link>
            );
          })}
        </div>

        {/* Quick KCLSU Membership Guidance Badge */}
        <div className="mt-8 p-3.5 bg-[#052322]/70 border border-[#084746] rounded-2xl w-full text-center">
          <p className="text-[11px] text-zinc-300 font-sans leading-relaxed">
            Already purchased your membership on KCLSU?{' '}
            <Link href="/login?view=sign_up" className="text-[#FFBD59] font-bold hover:underline">
              Create your portal account
            </Link>{' '}
            to unlock your climbing pass.
          </p>
        </div>
      </div>

      {/* Minimal Footer */}
      <footer className="w-full max-w-md mx-auto text-center py-4 border-t border-[#084746]/60 text-[11px] font-mono text-zinc-400 space-y-1 relative z-10">
        <div>
          King&apos;s College London Mountaineering Club
        </div>
        <div className="text-[10px] text-zinc-400">
          KCLSU Registered Charity No. <strong className="text-zinc-300">1136729</strong>
        </div>
        <div className="pt-2">
          <Link href="/" className="text-[#FFBD59] hover:underline text-[11px] font-sans inline-flex items-center gap-1">
            <span>← Go to main website (kclmc.org)</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
