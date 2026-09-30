import React from 'react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* =====================================================================
          1. HERO SECTION (Alpine Forest Green with Summit Gold Accents)
          ===================================================================== */}
      <section className="bg-[#052322] text-white pt-16 pb-20 px-6 md:px-12 relative overflow-hidden topo-pattern border-b border-[#084746]">
        <div className="relative z-10 max-w-5xl mx-auto">
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-[#084746] border border-[#FFBD59]/40 text-[#FFBD59] text-xs font-heading font-bold uppercase tracking-wider">
            <span>Est. 1928</span>
            <span className="text-zinc-500">•</span>
            <span>King's College London</span>
          </div>

          {/* Main Headline */}
          <h1 className="font-heading font-black text-5xl sm:text-7xl md:text-8xl uppercase tracking-tight text-white leading-[0.95] mb-6">
            Climbing &amp; Mountaineering <br className="hidden sm:inline" />
            <span className="text-[#FFBD59]">At King's</span>
          </h1>

          <p className="text-base sm:text-xl text-zinc-300 font-sans max-w-2xl leading-relaxed mb-8">
            From weekly social bouldering sessions across central London walls to gritstone trad in the Peak District and winter gullies in the Scottish Highlands. Open to all students.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap gap-4 items-center">
            <Link href="/trips" className="kclmc-btn-primary">
              <span>Explore 2026 Meets</span>
              <span className="text-lg">→</span>
            </Link>
            <a href="#beginners" className="kclmc-btn-outline">
              First Time Climbing?
            </a>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. SOCIETY TRUST BAR (KCLSU Accredited, Free Gear, Wall Discounts)
          ===================================================================== */}
      <section className="bg-[#041F1E] border-b border-[#084746] text-zinc-200 py-6 px-6 md:px-12">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center md:text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#084746] border border-[#FFBD59]/30 flex items-center justify-center text-lg shrink-0">
              🎓
            </div>
            <div>
              <div className="font-heading font-bold text-sm uppercase tracking-wide text-white">KCLSU Accredited</div>
              <div className="text-xs text-zinc-400 font-sans">Official Union Society</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#084746] border border-[#FFBD59]/30 flex items-center justify-center text-lg shrink-0">
              🧗
            </div>
            <div>
              <div className="font-heading font-bold text-sm uppercase tracking-wide text-white">100% Free Gear Hire</div>
              <div className="text-xs text-zinc-400 font-sans">Ropes, helmets &amp; harnesses</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#084746] border border-[#FFBD59]/30 flex items-center justify-center text-lg shrink-0">
              📍
            </div>
            <div>
              <div className="font-heading font-bold text-sm uppercase tracking-wide text-white">London Discounts</div>
              <div className="text-xs text-zinc-400 font-sans">The Castle, VauxWall &amp; more</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#084746] border border-[#FFBD59]/30 flex items-center justify-center text-lg shrink-0">
              🤝
            </div>
            <div>
              <div className="font-heading font-bold text-sm uppercase tracking-wide text-white">All Abilities Welcome</div>
              <div className="text-xs text-zinc-400 font-sans">Zero experience required</div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. CORE CLUB DISCIPLINES (Clean Editorial 4-Card Grid)
          ===================================================================== */}
      <section className="bg-slate-50 py-16 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10 text-center md:text-left">
            <div className="inline-block px-3 py-1 mb-2 rounded bg-emerald-100 text-[#052322] font-heading font-bold text-xs uppercase tracking-wider">
              Club Activities
            </div>
            <h2 className="font-heading font-black text-3xl sm:text-5xl uppercase tracking-tight text-slate-900">
              What We Do
            </h2>
            <p className="text-slate-600 font-sans text-sm sm:text-base max-w-xl mt-2">
              Whether you want to climb indoors after lectures or belay on classic British sea cliffs, our club covers every discipline.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1: Bouldering */}
            <div className="kclmc-card p-6 flex flex-col justify-between">
              <div>
                <span className="kclmc-badge-pine mb-4">Indoor Climbing</span>
                <h3 className="font-heading font-bold text-2xl uppercase tracking-wide text-slate-900 mb-2">
                  Social Bouldering
                </h3>
                <p className="text-slate-600 text-xs font-sans leading-relaxed mb-4">
                  Weekly drop-in sessions at VauxWall East and The Castle. Meet fellow King's students, learn beta, and join pub socials afterwards.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 text-xs font-mono text-slate-500 flex justify-between items-center">
                <span>Mondays &amp; Wednesdays</span>
                <span className="text-[#052322] font-bold">Central London</span>
              </div>
            </div>

            {/* Card 2: Trad Climbing */}
            <div className="kclmc-card p-6 flex flex-col justify-between">
              <div>
                <span className="kclmc-badge-pine mb-4">Outdoor Rock</span>
                <h3 className="font-heading font-bold text-2xl uppercase tracking-wide text-slate-900 mb-2">
                  Trad &amp; Sport Meets
                </h3>
                <p className="text-slate-600 text-xs font-sans leading-relaxed mb-4">
                  Weekend trips to Harrison's Rocks sandstone, Portland sport cliffs, and Peak District gritstone classics. All club rack &amp; safety kit provided.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 text-xs font-mono text-slate-500 flex justify-between items-center">
                <span>Weekend Excursions</span>
                <Link href="/trips" className="text-[#052322] font-bold hover:underline">
                  View Crags →
                </Link>
              </div>
            </div>

            {/* Card 3: Scrambling */}
            <div className="kclmc-card p-6 flex flex-col justify-between">
              <div>
                <span className="kclmc-badge-pine mb-4">Mountain Days</span>
                <h3 className="font-heading font-bold text-2xl uppercase tracking-wide text-slate-900 mb-2">
                  Hillwalking &amp; Ridges
                </h3>
                <p className="text-slate-600 text-xs font-sans leading-relaxed mb-4">
                  Scrambling traverses and wilderness summits across Snowdonia and the Lake District. Build mountain navigation and leadership confidence.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 text-xs font-mono text-slate-500 flex justify-between items-center">
                <span>Term-time Meets</span>
                <span className="text-[#052322] font-bold">UK Peaks</span>
              </div>
            </div>

            {/* Card 4: Winter */}
            <div className="kclmc-card p-6 flex flex-col justify-between">
              <div>
                <span className="kclmc-badge-pine mb-4">Alpine Expedition</span>
                <h3 className="font-heading font-bold text-2xl uppercase tracking-wide text-slate-900 mb-2">
                  Scottish Winter
                </h3>
                <p className="text-slate-600 text-xs font-sans leading-relaxed mb-4">
                  Our flagship winter trip to Glencoe and the Cairngorms. Learn crampon technique, ice axe arrest, and snowpack assessment with senior members.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 text-xs font-mono text-slate-500 flex justify-between items-center">
                <span>December / January</span>
                <span className="text-[#052322] font-bold">Scottish Highlands</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. CHECKERBOARD FEATURE: "NEW TO CLIMBING?" (Beginners Welcome)
          ===================================================================== */}
      <section id="beginners" className="bg-white py-16 px-6 md:px-12 border-y border-slate-200">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block px-3 py-1 mb-3 rounded bg-amber-100 text-amber-900 font-heading font-bold text-xs uppercase tracking-wider">
              Beginners &amp; Freshers
            </div>
            <h2 className="font-heading font-black text-3xl sm:text-5xl uppercase tracking-tight text-slate-900 mb-6 leading-tight">
              Never Climbed Before? <br />
              <span className="text-[#052322]">You're in the Right Place.</span>
            </h2>
            <div className="space-y-4 text-slate-700 font-sans text-sm sm:text-base leading-relaxed">
              <p>
                More than half of our active members joined KCLMC having never touched a climbing wall or placed a carabiner. We welcome total beginners from all campuses and courses.
              </p>
              <ul className="space-y-3 font-sans text-sm pt-2">
                <li className="flex items-start gap-3">
                  <span className="text-[#052322] font-bold text-base mt-0.5">✔</span>
                  <span><strong>Zero Equipment Needed:</strong> You don't need to buy expensive gear. The club owns helmets, harnesses, ropes, and belay devices for all members to use for free.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#052322] font-bold text-base mt-0.5">✔</span>
                  <span><strong>Drop-in Social Sessions:</strong> Simply turn up to one of our weekly wall sessions at VauxWall East or The Castle. We have committee members ready to help you get started.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#052322] font-bold text-base mt-0.5">✔</span>
                  <span><strong>Student Union Affiliation:</strong> You can join via the official KCLSU portal and claim your digital membership pass right here.</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/membership" className="kclmc-btn-forest">
                <span>Join via KCLSU</span>
                <span>→</span>
              </Link>
              <Link href="/guides" className="px-5 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-heading text-base uppercase tracking-wider font-bold transition-colors">
                View London Walls Beta
              </Link>
            </div>
          </div>

          {/* Information Dossier Box */}
          <div className="bg-[#052322] text-white p-8 rounded-2xl border border-[#FFBD59]/30 relative shadow-xl">
            <div className="flex justify-between items-center pb-4 border-b border-[#084746] mb-6">
              <span className="font-heading font-bold text-sm uppercase tracking-wider text-[#FFBD59]">
                Club Weekly Schedule
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                Semester 1 &amp; 2
              </span>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#084746]/60 border border-[#FFBD59]/20">
                <div className="flex justify-between text-sm font-heading font-bold uppercase tracking-wide text-white">
                  <span>Monday Evening Social</span>
                  <span className="text-[#FFBD59]">18:30 — 21:00</span>
                </div>
                <div className="text-xs font-sans text-zinc-300 mt-1">
                  VauxWall East (Vauxhall railway arches). Bouldering, social climbing, and drinks.
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#084746]/60 border border-[#FFBD59]/20">
                <div className="flex justify-between text-sm font-heading font-bold uppercase tracking-wide text-white">
                  <span>Wednesday Roped Session</span>
                  <span className="text-[#FFBD59]">17:30 — 20:30</span>
                </div>
                <div className="text-xs font-sans text-zinc-300 mt-1">
                  The Castle Climbing Centre (Manor House). Top-roping, lead climbing, and auto-belays.
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#084746]/60 border border-[#FFBD59]/20">
                <div className="flex justify-between text-sm font-heading font-bold uppercase tracking-wide text-white">
                  <span>Weekend Outdoor Meets</span>
                  <span className="text-[#FFBD59]">Monthly</span>
                </div>
                <div className="text-xs font-sans text-zinc-300 mt-1">
                  Southern Sandstone day trips &amp; Peak District bunkhouse weekends.
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#084746] flex justify-between items-center text-xs font-mono text-[#FFBD59]">
              <span>QUESTIONS?</span>
              <a
                href="https://www.instagram.com/kclmc/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline flex items-center gap-1"
              >
                <span>DM us @kclmc</span>
                <span>↗</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. UPCOMING MEETS PREVIEW (Expedition Ledger)
          ===================================================================== */}
      <section className="bg-slate-50 py-16 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-8">
            <div>
              <div className="inline-block px-3 py-1 mb-2 rounded bg-amber-100 text-amber-900 font-heading font-bold text-xs uppercase tracking-wider">
                Expeditions &amp; Calendar
              </div>
              <h2 className="font-heading font-black text-3xl sm:text-5xl uppercase tracking-tight text-slate-900">
                Upcoming Meets
              </h2>
            </div>
            <Link href="/trips" className="kclmc-btn-forest text-xs py-2.5 px-4 font-bold self-start sm:self-auto">
              <span>View Full Calendar</span>
              <span>→</span>
            </Link>
          </div>

          <div className="grid gap-4">
            {/* Meet 1 */}
            <div className="kclmc-card p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-heading uppercase font-bold tracking-wider bg-emerald-100 text-emerald-800">
                    Social Wall
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    All levels welcome
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-600">
                    FREE
                  </span>
                </div>
                <h3 className="font-heading font-bold text-2xl uppercase tracking-wide text-slate-900">
                  Weekly Social Wall — Mile End
                </h3>
                <p className="text-slate-600 text-xs font-sans mt-1">
                  Drop-in Tuesday evening session. Meet at reception foyer for circuits and warm-up.
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs font-mono text-slate-500">
                  <span>🗓️ 2026-10-01</span>
                  <span>📍 Mile End Climbing Wall, London E3</span>
                </div>
              </div>
              <Link href="/trips" className="kclmc-btn-primary text-xs py-2 px-4 self-start sm:self-auto">
                Details →
              </Link>
            </div>

            {/* Meet 2 */}
            <div className="kclmc-card p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-heading uppercase font-bold tracking-wider bg-[#FFBD59] text-[#052322]">
                    Trad Day Trip
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    VDiff to HVS
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-700">
                    £15.00
                  </span>
                </div>
                <h3 className="font-heading font-bold text-2xl uppercase tracking-wide text-slate-900">
                  Harrison's Rocks Day Trip
                </h3>
                <p className="text-slate-600 text-xs font-sans mt-1">
                  Southern Sandstone top-roping classic. Perfect intro to outdoor rock climbing 50 mins from London Bridge.
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs font-mono text-slate-500">
                  <span>🗓️ 2026-10-12</span>
                  <span>📍 Groombridge, Kent</span>
                </div>
              </div>
              <Link href="/trips" className="kclmc-btn-primary text-xs py-2 px-4 self-start sm:self-auto">
                Details →
              </Link>
            </div>

            {/* Meet 3 */}
            <div className="kclmc-card p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-heading uppercase font-bold tracking-wider bg-slate-900 text-[#FFBD59]">
                    Weekend Expedition
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    Severe to E1
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-700">
                    £45.00
                  </span>
                </div>
                <h3 className="font-heading font-bold text-2xl uppercase tracking-wide text-slate-900">
                  Peak District Weekend Trad
                </h3>
                <p className="text-slate-600 text-xs font-sans mt-1">
                  Two full days on world-famous gritstone: Stanage Edge and Burbage South. Wild camping and bunkhouse options.
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs font-mono text-slate-500">
                  <span>🗓️ 2026-10-25 → 2026-10-26</span>
                  <span>📍 Hathersage, Peak District</span>
                </div>
              </div>
              <Link href="/trips" className="kclmc-btn-primary text-xs py-2 px-4 self-start sm:self-auto">
                Details →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
