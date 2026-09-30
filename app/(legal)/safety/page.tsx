import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: "Climbing Safety & BMC Risk Notice | King's College London Mountaineering Club",
  description: "Official BMC Participation Statement, Mountaineering Risk Acknowledgment, and Climbing Liability Notice.",
};

export default function SafetyPage() {
  const lastUpdated = "September 30, 2026";

  return (
    <div className="min-h-screen bg-[#041F1E] text-slate-100 py-12 px-6 md:px-12 font-sans topo-pattern">
      <div className="max-w-4xl mx-auto bg-[#052322] border-2 border-amber-500/40 rounded-3xl p-6 sm:p-12 shadow-2xl relative z-10 space-y-10">
        
        {/* Header */}
        <div className="border-b border-[#084746] pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-heading font-bold text-xs uppercase tracking-wider mb-4">
            ⚠️ British Mountaineering Council (BMC) Policy
          </div>
          <h1 className="text-3xl sm:text-5xl font-black font-heading uppercase tracking-tight text-[#FFBD59]">
            Climbing Safety &amp; Risk Notice
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 font-mono mt-2">
            Last Updated: {lastUpdated} • Formal Safety Contract
          </p>
        </div>

        {/* BMC Statement Highlight Box */}
        <div className="p-6 sm:p-8 bg-[#041F1E] border-2 border-amber-500/50 rounded-2xl shadow-xl space-y-4">
          <div className="font-heading font-black text-xl uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <span>🧗</span> The BMC Participation Statement
          </div>
          <blockquote className="text-sm sm:text-base text-white font-sans italic leading-relaxed pl-4 border-l-4 border-amber-500">
            &ldquo;The British Mountaineering Council (BMC) recognises that climbing and mountaineering are activities with a danger of personal injury or death. Participants in these activities should be aware of and accept these risks and be responsible for their own actions and involvement.&rdquo;
          </blockquote>
          <p className="text-xs text-zinc-400 font-sans">
            By participating in any KCLMC climbing wall meet, bouldering session, outdoor crag day, or mountain expedition, you formally acknowledge and accept this fundamental statement.
          </p>
        </div>

        {/* Section 1: Inherent Hazards */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">1.</span> Inherent Hazards of the Sport
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            Climbing in all forms—including indoor bouldering, sport leading, traditional gritstone cragging, sea cliff climbing, and Scottish winter mountaineering—involves unavoidable risks that no amount of care, equipment, or supervision can completely eliminate:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-zinc-300">
            <div className="p-4 bg-[#041F1E] rounded-xl border border-[#084746] space-y-1">
              <strong className="text-white">Falls &amp; Impact Hazards:</strong>
              <p>Ground falls, ledge falls, swinging impact into rock faces, bouldering pad misses, and finger tendon or ligament injuries.</p>
            </div>
            <div className="p-4 bg-[#041F1E] rounded-xl border border-[#084746] space-y-1">
              <strong className="text-white">Objective Mountain Dangers:</strong>
              <p>Spontaneous rockfall, loose holds, crumbling vegetation, tidal cutoffs, icefall, cornice collapse, and snowpack avalanches.</p>
            </div>
            <div className="p-4 bg-[#041F1E] rounded-xl border border-[#084746] space-y-1">
              <strong className="text-white">Severe Mountain Weather:</strong>
              <p>Sudden temperature drops, high winds, hypothermia, lightning strikes, disorienting fog/whiteouts, and rapid nightfall.</p>
            </div>
            <div className="p-4 bg-[#041F1E] rounded-xl border border-[#084746] space-y-1">
              <strong className="text-white">Human &amp; Equipment Factors:</strong>
              <p>Belayer distraction, knot errors, marginal gear placements, edge abrasion on ropes, or anchor misconfiguration.</p>
            </div>
          </div>
        </section>

        {/* Section 2: Topo Guides Disclaimer */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">2.</span> Disclaimer of Route Guides &amp; Topos (&ldquo;Beta&rdquo;)
          </h2>
          <div className="p-4 bg-[#041F1E] rounded-xl border border-[#084746] text-xs sm:text-sm text-zinc-300 leading-relaxed space-y-2">
            <p>
              All crag information, route descriptions, topo diagrams, grade assessments, and access information provided on this platform (including <Link href="/guides" className="text-[#FFBD59] underline">Where We Climb</Link>) are for <strong>informational and educational guidance only</strong>.
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Grades are subjective opinions and vary widely based on individual morphology, climbing style, and seasonal humidity.</li>
              <li>Crags are dynamic natural environments: key holds snap, fixed gear rusts, abseil tat degrades, and access agreements change.</li>
              <li>You must always carry up-to-date definitive paper guidebooks (e.g. BMC, CC, or Rockfax guides) and conduct your own dynamic on-site risk assessment before committing to a route.</li>
            </ul>
          </div>
        </section>

        {/* Section 3: Safety Gear */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">3.</span> Helmets &amp; Protective Equipment
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            KCLMC <strong>strongly advocates the use of climbing helmets</strong> on all outdoor trad crags, sea cliffs, scrambles, and mountain routes. While senior members and committee officers are available to mentor and offer advice, each climber remains personally responsible for inspecting and verifying their own tie-in knots, harness buckles, and belay systems.
          </p>
        </section>

        {/* Section 4: Insurance */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">4.</span> Personal Insurance Notice
          </h2>
          <div className="p-4 bg-[#041F1E] border border-amber-500/30 rounded-2xl text-xs space-y-2 text-zinc-300">
            <p>
              While KCLSU holds standard student society public liability insurance, this does <strong>NOT</strong> provide comprehensive personal accident coverage, emergency dental repair, private repatriation, or equipment damage coverage.
            </p>
            <p className="text-white font-medium">
              We strongly advise all recreational climbers to maintain personal sports insurance through the <strong>British Mountaineering Council (BMC)</strong> or the <strong>Austrian Alpine Club (AAC/OeAV)</strong>, particularly when travelling on multi-day meets to Scotland, North Wales, or overseas.
            </p>
          </div>
        </section>

        {/* Footer Navigation */}
        <div className="border-t border-[#084746] pt-6 flex flex-col sm:flex-row justify-between items-center text-xs text-zinc-400 font-heading uppercase tracking-wider gap-4">
          <Link href="/terms" className="text-[#FFBD59] hover:underline flex items-center gap-1">
            <span>Read Terms of Service</span>
            <span>→</span>
          </Link>
          <Link href="/privacy" className="text-[#FFBD59] hover:underline flex items-center gap-1">
            <span>Read Privacy Policy</span>
            <span>→</span>
          </Link>
          <Link href="/" className="hover:text-white transition-colors">
            ← Return to Club Hub
          </Link>
        </div>

      </div>
    </div>
  );
}
