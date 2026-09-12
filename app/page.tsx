import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-[calc(100vh-57px)] flex flex-col md:flex-row relative overflow-hidden bg-[#0A0A0A]">
      {/* =========================================================================
          LEFT PANEL: KCLMC — THE ALPINE EXPEDITION FIELD GUIDE
          ========================================================================= */}
      <section className="flex-1 bg-[#041F1E] text-[#F7F7F7] p-8 md:p-16 flex flex-col justify-between relative overflow-hidden group transition-all duration-500 topo-pattern">
        {/* Ambient Topo Glow */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#FFBD59]/15 rounded-full blur-3xl pointer-events-none group-hover:bg-[#FFBD59]/25 transition-all"></div>
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-[#084746]/40 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Field Badge & Coordinates */}
        <div className="relative z-10 flex flex-wrap justify-between items-center gap-4 text-xs">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded bg-[#084746]/80 border border-[#FFBD59]/30 text-[#FFBD59] font-mono tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#FFBD59] animate-pulse"></span>
            EXPEDITION LOG // EST. 1928
          </div>
          <div className="text-[11px] font-mono text-[#FFBD59]/80 hidden sm:block tracking-widest">
            51.5115° N, 0.1160° W • ELEV. 18M
          </div>
        </div>

        {/* Center Hero Block */}
        <div className="relative z-10 my-12 md:my-16 max-w-lg">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🏔️</span>
            <span className="text-xs uppercase font-mono tracking-widest text-[#FFBD59] bg-[#084746] px-2 py-0.5 border border-[#FFBD59]/30">
              Alpine Heritage
            </span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-serif font-black tracking-tight text-white mb-4 leading-none">
            KCL<span className="text-[#FFBD59]">MC</span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-300 font-sans leading-relaxed mb-8">
            The Alpine Expedition Field Guide. Join us for weekend Peak District trad, sandstone boulders in Fontainebleau, and Scottish winter mountaineering.
          </p>

          {/* Expedition Pass Button */}
          <div>
            <Link href="/club" className="btn-expedition-tag">
              <span>Enter Club Field Guide</span>
              <span>↗</span>
            </Link>
          </div>
        </div>

        {/* Bottom Beta Ticker */}
        <div className="relative z-10 pt-4 border-t border-[#FFBD59]/20 flex flex-wrap justify-between items-center text-[11px] font-mono text-zinc-400 gap-2">
          <span>WEEKLY: MON @ VAUXWALL • WED @ THE CASTLE</span>
          <span className="text-[#FFBD59] font-bold">NEXT MEET: PEAK DISTRICT TRAD</span>
        </div>
      </section>

      {/* =========================================================================
          CENTER SEAM: BRAIDED CLIMBING ROPE DIVIDER
          ========================================================================= */}
      <div className="w-full h-2.5 md:w-3 md:h-auto rope-seam relative z-20 flex-shrink-0"></div>

      {/* =========================================================================
          RIGHT PANEL: LUBE — THE UNDERGROUND LONDON CHALK ZINE
          ========================================================================= */}
      <section className="flex-1 bg-[#0A0A0A] text-[#F5F5F0] p-8 md:p-16 flex flex-col justify-between relative overflow-hidden group transition-all duration-500 chalk-texture">
        {/* Route Setter's Tape Accents (Top Right) */}
        <div className="relative z-10 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="route-tape tape-start">START HOLD</span>
            <span className="route-tape tape-top">TOP // 25 PTS</span>
          </div>
          <div className="text-[11px] font-mono text-zinc-500 tracking-widest hidden sm:block">
            ||||||||||||| LUBE-SERIES-26
          </div>
        </div>

        {/* Center Hero Block */}
        <div className="relative z-10 my-12 md:my-16 max-w-lg">
          <div className="flex items-center gap-4 mb-4">
            <img src="/images/lube-logo.png" alt="LUBE" className="h-16 brightness-0 invert object-contain" />
            <span className="route-tape tape-chalk text-[10px]">
              CIRCUIT 25/26
            </span>
          </div>

          <h2 className="text-5xl sm:text-6xl md:text-7xl font-mono font-black tracking-tighter uppercase text-white mb-4 leading-none">
            LUBE<span className="text-[#00FF66]">.</span>
          </h2>

          <p className="text-base sm:text-lg text-zinc-300 font-sans leading-relaxed mb-8">
            London University Bouldering Events. The underground chalk aesthetic uniting inter-collegiate climbing crews in packed railway arches across the city.
          </p>

          {/* Comp Wristband Button */}
          <div>
            <Link href="/lube" className="btn-wristband">
              <span>Enter Bouldering Circuit</span>
              <span className="text-[#00FF66] font-mono">[ 02 ]</span>
            </Link>
          </div>
        </div>

        {/* Bottom Status Ticker */}
        <div className="relative z-10 pt-4 border-t border-zinc-800 flex flex-wrap justify-between items-center text-[11px] font-mono text-zinc-400 gap-2">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00FF66] animate-ping"></span>
            BOULDERING COMP SERIES
          </span>
          <span className="text-zinc-300 font-bold">ROUND 01 • VAUXWALL</span>
        </div>
      </section>
    </main>
  );
}
