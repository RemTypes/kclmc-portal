import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#052322] text-white pt-14 pb-10 px-6 md:px-12 border-t border-[#084746] font-sans">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-[#084746]">
        {/* Col 1: Club Identity & Affiliation */}
        <div className="md:col-span-1 space-y-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-[#084746] border border-[#FFBD59]/50 overflow-hidden flex items-center justify-center shadow-sm group-hover:border-[#FFBD59] transition-all p-1">
              <Image
                src="/images/kclmc-logo.png"
                alt="KCLMC Logo"
                width={36}
                height={36}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="font-heading font-black text-xl tracking-wider text-[#FFBD59] group-hover:text-[#FFE0A3] transition-colors leading-none">
                KCLMC
              </div>
              <div className="text-[10px] font-sans uppercase tracking-widest text-zinc-400 mt-1">
                Est. 1928 // London
              </div>
            </div>
          </Link>
          <p className="text-xs text-zinc-300 leading-relaxed font-sans">
            King&apos;s College London Mountaineering &amp; Climbing Club. Accredited society of the King&apos;s College London Students&apos; Union (KCLSU).
          </p>
          <div className="pt-2 text-[11px] text-zinc-400 font-mono">
            KCLSU Registered Charity No. <strong className="text-zinc-300">1136043</strong>
          </div>
        </div>

        {/* Col 2: Navigation Links */}
        <div className="space-y-3">
          <div className="font-heading font-bold text-xs uppercase tracking-wider text-[#FFBD59]">
            Club Hub
          </div>
          <ul className="space-y-2 text-xs text-zinc-300">
            <li>
              <Link href="/trips" className="hover:text-[#FFBD59] transition-colors">
                Trips &amp; Meets <span className="text-[10px] text-[#FFBD59]/80 font-mono">(Coming Soon)</span>
              </Link>
            </li>
            <li>
              <Link href="/guides" className="hover:text-[#FFBD59] transition-colors">
                Where We Climb (Beta)
              </Link>
            </li>
            <li>
              <Link href="/drops/kclmc" className="hover:text-[#FFBD59] transition-colors">
                Apparel Drops &amp; Stash
              </Link>
            </li>
            <li>
              <Link href="/membership" className="hover:text-[#FFBD59] transition-colors">
                Digital Climbing Pass
              </Link>
            </li>
            <li>
              <Link href="/admin" className="hover:text-[#FFBD59] transition-colors text-zinc-400">
                Committee Portal
              </Link>
            </li>
          </ul>
        </div>

        {/* Col 3: Legal & Governance */}
        <div className="space-y-3">
          <div className="font-heading font-bold text-xs uppercase tracking-wider text-[#FFBD59]">
            Legal &amp; Safety
          </div>
          <ul className="space-y-2 text-xs text-zinc-300">
            <li>
              <Link href="/privacy" className="hover:text-[#FFBD59] transition-colors font-medium">
                Privacy &amp; Cookie Policy (UK GDPR)
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-[#FFBD59] transition-colors font-medium">
                Terms of Service &amp; Membership
              </Link>
            </li>
            <li>
              <Link href="/safety" className="hover:text-[#FFBD59] transition-colors font-medium text-amber-300/90 hover:text-amber-200">
                ⚠️ BMC Safety &amp; Risk Notice
              </Link>
            </li>
            <li>
              <Link href="/accessibility" className="hover:text-[#FFBD59] transition-colors font-medium text-emerald-300/90 hover:text-emerald-200">
                ♿ Accessibility &amp; Inclusion (Equality Act)
              </Link>
            </li>
            <li>
              <a 
                href="https://www.kclsu.org/policyzone/"
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-[#FFBD59] transition-colors text-zinc-400 inline-flex items-center gap-1"
              >
                <span>KCLSU Policy Zone &amp; Code of Conduct</span>
                <span className="text-[10px]">↗</span>
              </a>
            </li>
            <li>
              <a
                href="https://www.thebmc.co.uk/en/bmc-participation-statement"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#FFBD59] transition-colors text-zinc-400 inline-flex items-center gap-1"
              >
                <span>BMC Participation Statement</span>
                <span className="text-[10px]">↗</span>
              </a>
            </li>
          </ul>
        </div>

        {/* Col 4: Contact & Dispatches */}
        <div className="space-y-3">
          <div className="font-heading font-bold text-xs uppercase tracking-wider text-[#FFBD59]">
            Connect &amp; Support
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed font-sans">
            Inquiries, emergency contact verification, or data subject requests:
          </p>
          <a
            href="mailto:kclmc.committee@gmail.com"
            className="inline-block text-xs font-mono text-[#FFBD59] hover:underline"
          >
            kclmc.committee@gmail.com
          </a>
          <div className="pt-2 flex flex-col gap-2">
            <a
              href="https://www.instagram.com/kclmc/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-300 hover:text-[#FFBD59] transition-colors inline-flex items-center gap-1.5"
            >
              <span>📸</span>
              <span>@kclmc Instagram Dispatches ↗</span>
            </a>
            <a
              href="https://www.kclsu.org/groups/sports/join/mountaineerclimbsoc/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-300 hover:text-[#FFBD59] transition-colors inline-flex items-center gap-1.5"
            >
              <span>🏛️</span>
              <span>Official KCLSU Society Page ↗</span>
            </a>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Address, BMC Statement, Copyright */}
      <div className="max-w-6xl mx-auto pt-8 flex flex-col md:flex-row justify-between items-start md:items-center text-[11px] text-zinc-400 font-sans gap-4 leading-relaxed">
        <div className="space-y-1">
          <div>
            &copy; {currentYear} King&apos;s College London Mountaineering Club. All rights reserved.
          </div>
          <div className="text-zinc-300">
            King&apos;s College London Students&apos; Union, Macadam Building, Surrey Street, London WC2R 2NS.
          </div>
        </div>
        <div className="text-zinc-300 text-left md:text-right max-w-md">
          Climbing and mountaineering are activities with a danger of personal injury or death. Participants should be aware of and accept these risks.
        </div>
      </div>
    </footer>
  );
}
