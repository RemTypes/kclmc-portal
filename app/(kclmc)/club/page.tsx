import Link from 'next/link';

export default function ClubHome() {
  return (
    <div className="min-h-screen bg-[#041F1E] text-[#F7F7F7] p-6 md:p-12 relative overflow-hidden topo-pattern">
      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Top Header Badge & Field Coordinates */}
        <div className="flex flex-wrap justify-between items-center gap-4 mb-8 pb-4 border-b border-[#FFBD59]/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#084746] border border-[#FFBD59]/50 flex items-center justify-center text-lg shadow-sm">
              🏔️
            </div>
            <div>
              <div className="text-[10px] font-mono tracking-widest text-[#FFBD59] uppercase">King's College London</div>
              <div className="text-sm font-serif font-bold text-white tracking-wide">Mountaineering &amp; Climbing Club</div>
            </div>
          </div>
          <div className="text-xs font-mono text-[#FFBD59]/80 flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full bg-[#FFBD59] animate-pulse"></span>
            <span>STRAND CAMPUS: 51.5115° N, 0.1160° W</span>
            <span className="hidden sm:inline text-zinc-500">|</span>
            <span className="hidden sm:inline">ELEV. 18M</span>
          </div>
        </div>

        {/* Hero Title with Serif Heading */}
        <div className="mb-12 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 mb-4 bg-[#084746] border border-[#FFBD59]/30 text-[#FFBD59] text-[11px] font-mono uppercase tracking-widest">
            Expedition Field Guide // Vol. 98
          </div>
          <h1 className="text-4xl sm:text-6xl font-serif font-black text-white mb-4 tracking-tight leading-tight">
            The Alpine Heritage <span className="text-[#FFBD59] italic">&amp; Outdoor Beta</span>
          </h1>
          <p className="text-base sm:text-lg text-zinc-300 font-sans leading-relaxed">
            From weekly training across London walls to wilderness trad, winter mountaineering in Scotland, and high-altitude European alpine routes.
          </p>
        </div>

        {/* Tactile Expedition Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Card 1: Sessions */}
          <div className="expedition-card p-6 flex flex-col justify-between group">
            <div className="flex justify-between items-start mb-4">
              <span className="brass-rivet"></span>
              <span className="text-[10px] font-mono text-[#FFBD59] uppercase tracking-widest bg-[#052322] px-2 py-0.5 border border-[#FFBD59]/20">01 / LOG</span>
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-white mb-1">Weekly Training</h2>
              <p className="text-zinc-300 text-xs font-sans mb-4">Central London climbing sessions.</p>
              <div className="space-y-2 text-xs font-mono border-t border-[#FFBD59]/20 pt-3">
                <div className="flex justify-between text-zinc-300">
                  <span>Mondays</span>
                  <span className="text-[#FFBD59] font-bold">VauxWall East</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Wednesdays</span>
                  <span className="text-[#FFBD59] font-bold">The Castle</span>
                </div>
                <div className="flex justify-between text-zinc-400 text-[11px] pt-1">
                  <span>Coaching</span>
                  <span className="text-emerald-400">@catalystclimbing</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Trips */}
          <Link href="/trips" className="expedition-card p-6 flex flex-col justify-between group hover:border-[#FFBD59] transition-all">
            <div className="flex justify-between items-start mb-4">
              <span className="brass-rivet"></span>
              <span className="text-[10px] font-mono text-[#FFBD59] uppercase tracking-widest bg-[#052322] px-2 py-0.5 border border-[#FFBD59]/20">02 / MEETS</span>
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-white mb-1 group-hover:text-[#FFBD59] transition-colors">Trips Calendar</h2>
              <p className="text-zinc-300 text-xs font-sans mb-4">Peak District, Highlands &amp; Font expeditions.</p>
              <div className="text-xs font-mono text-[#FFBD59] bg-[#052322]/80 p-2.5 border border-[#FFBD59]/20 rounded-sm">
                Next: Peak Trad Meet
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#FFBD59]/20 flex justify-between items-center text-xs font-mono text-[#FFBD59]">
              <span>OPEN CALENDAR</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>

          {/* Card 3: Guides */}
          <Link href="/guides" className="expedition-card p-6 flex flex-col justify-between group hover:border-[#FFBD59] transition-all">
            <div className="flex justify-between items-start mb-4">
              <span className="brass-rivet"></span>
              <span className="text-[10px] font-mono text-[#FFBD59] uppercase tracking-widest bg-[#052322] px-2 py-0.5 border border-[#FFBD59]/20">03 / BETA</span>
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-white mb-1 group-hover:text-[#FFBD59] transition-colors">Crags &amp; Walls</h2>
              <p className="text-zinc-300 text-xs font-sans mb-4">Student discounts and local sandstone beta.</p>
              <div className="text-xs font-mono text-zinc-300 bg-[#052322]/80 p-2.5 border border-[#FFBD59]/20 rounded-sm">
                Up to 30% off London entry
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#FFBD59]/20 flex justify-between items-center text-xs font-mono text-[#FFBD59]">
              <span>VIEW WALL BETA</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>

          {/* Card 4: Drops */}
          <Link href="/drops/kclmc" className="expedition-card p-6 flex flex-col justify-between group hover:border-[#FFBD59] transition-all">
            <div className="flex justify-between items-start mb-4">
              <span className="brass-rivet"></span>
              <span className="text-[10px] font-mono text-[#FFBD59] uppercase tracking-widest bg-[#052322] px-2 py-0.5 border border-[#FFBD59]/20">04 / GEAR</span>
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-white mb-1 group-hover:text-[#FFBD59] transition-colors">Club Merch</h2>
              <p className="text-zinc-300 text-xs font-sans mb-4">Official 2026 Gold &amp; Green apparel stash.</p>
              <div className="text-xs font-mono text-[#FFBD59] bg-[#052322]/80 p-2.5 border border-[#FFBD59]/20 rounded-sm">
                Group Buy MOQ Active
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#FFBD59]/20 flex justify-between items-center text-xs font-mono text-[#FFBD59]">
              <span>ORDER PASS</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>
        </div>

        {/* Field Notes Ticker */}
        <div className="p-4 bg-[#052322] border border-[#FFBD59]/30 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="text-[#FFBD59]">FIELD NOTE:</span>
            <span className="text-zinc-300">All equipment hire (helmets, harnesses, ropes) is free for club members on official meets.</span>
          </div>
          <a
            href="https://www.instagram.com/kclmc/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FFBD59] hover:underline underline-offset-4 flex-shrink-0"
          >
            @kclmc Instagram Dispatch ↗
          </a>
        </div>
      </div>
    </div>
  );
}
