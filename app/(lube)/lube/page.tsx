import Link from 'next/link';

export default function LUBEHome() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F0] p-6 md:p-12 font-mono relative overflow-hidden chalk-texture">
      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Top Zine Barcode & Header Bar */}
        <div className="flex flex-wrap justify-between items-center gap-4 mb-8 pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            <img src="/images/lube-logo.png" alt="LUBE" className="h-16 brightness-0 invert object-contain" />
            <div>
              <div className="text-[10px] tracking-widest text-[#00FF66] uppercase font-bold">Official Comp Series</div>
              <div className="text-sm font-black uppercase text-white tracking-tight">London University Bouldering Events</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="route-tape tape-chalk text-[10px]">2025/2026 SEASON</span>
            <span className="text-[11px] text-zinc-500 hidden sm:inline">||||||||||||| LUBE-SERIES-26</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="mb-12 max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="route-tape tape-start">ROUND 01 ACTIVE</span>
            <span className="route-tape tape-top">FLASH // 25 PTS</span>
          </div>
          <h1 className="text-5xl sm:text-7xl font-black uppercase mb-4 tracking-tighter text-white leading-none">
            The Underground <span className="text-[#00FF66]">Chalk Aesthetic.</span>
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 font-sans leading-relaxed">
            Inter-collegiate bouldering competition series uniting university climbing crews across London. High-octane rounds, flash bonuses, and university team rivalries.
          </p>
        </div>

        {/* Tactile Zine Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Card 1: Comps */}
          <Link href="/comps" className="group border-2 border-zinc-800 hover:border-white p-6 bg-zinc-950/60 hover:bg-[#F5F5F0] hover:text-[#0A0A0A] transition-all relative flex flex-col justify-between">
            <div className="absolute top-2 right-2">
              <span className="text-[10px] text-zinc-500 group-hover:text-zinc-700">01 // SCHED</span>
            </div>
            <div>
              <span className="route-tape tape-chalk text-[9px] mb-3">5 ROUNDS</span>
              <h2 className="text-2xl font-black uppercase mt-3 mb-2 tracking-tight">Schedule</h2>
              <p className="text-zinc-400 group-hover:text-[#0A0A0A] text-xs font-sans">
                Host climbing walls, venue addresses, and round dates across London.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-zinc-800 group-hover:border-zinc-300 flex justify-between items-center text-xs font-bold uppercase">
              <span>View Wall Dates</span>
              <span>→</span>
            </div>
          </Link>

          {/* Card 2: Standings */}
          <Link href="/leaderboard" className="group border-2 border-zinc-800 hover:border-white p-6 bg-zinc-950/60 hover:bg-[#F5F5F0] hover:text-[#0A0A0A] transition-all relative flex flex-col justify-between">
            <div className="absolute top-2 right-2">
              <span className="text-[10px] text-zinc-500 group-hover:text-zinc-700">02 // RANKS</span>
            </div>
            <div>
              <span className="route-tape tape-zone text-[9px] mb-3">LEADERBOARD</span>
              <h2 className="text-2xl font-black uppercase mt-3 mb-2 tracking-tight">Rankings</h2>
              <p className="text-zinc-400 group-hover:text-[#0A0A0A] text-xs font-sans">
                Live university team standings, individual men/women/non-binary tables.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-zinc-800 group-hover:border-zinc-300 flex justify-between items-center text-xs font-bold uppercase">
              <span>View Standings</span>
              <span>→</span>
            </div>
          </Link>

          {/* Card 3: Chalk Merch Drop */}
          <Link href="/drops/lube" className="group border-2 border-zinc-800 hover:border-white p-6 bg-zinc-950/60 hover:bg-[#F5F5F0] hover:text-[#0A0A0A] transition-all relative flex flex-col justify-between">
            <div className="absolute top-2 right-2">
              <span className="text-[10px] text-zinc-500 group-hover:text-zinc-700">03 // DROP</span>
            </div>
            <div>
              <span className="route-tape tape-start text-[9px] mb-3">SERIES GEAR</span>
              <h2 className="text-2xl font-black uppercase mt-3 mb-2 tracking-tight">Chalk Drop</h2>
              <p className="text-zinc-400 group-hover:text-[#0A0A0A] text-xs font-sans">
                Official high-contrast chalk monochrome apparel pre-orders with live MOQ.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-zinc-800 group-hover:border-zinc-300 flex justify-between items-center text-xs font-bold uppercase">
              <span>Shop Apparel</span>
              <span>→</span>
            </div>
          </Link>
        </div>

        {/* Chalk Zine Stencil Banner */}
        <div className="p-4 border border-zinc-800 bg-zinc-950/80 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-[#00FF66] font-bold">COMP NOTICE:</span>
            <span className="text-zinc-400">Competition registration and check-in details are verified at host gym reception.</span>
          </div>
          <span className="text-zinc-500 font-mono tracking-widest text-[11px]">
            CIRCUIT // LUBE 2026
          </span>
        </div>
      </div>
    </div>
  );
}
