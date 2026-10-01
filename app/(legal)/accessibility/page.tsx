import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: "Accessibility & Disability Inclusion Policy | King's College London Mountaineering Club",
  description: "Equality Act 2010 compliance, paraclimbing protocols for blind, deaf, and mute climbers, and WCAG 2.2 AA digital accessibility statement.",
};

export default function AccessibilityPolicyPage() {
  const lastUpdated = "October 1, 2026";

  return (
    <div className="min-h-screen bg-[#041F1E] text-slate-100 py-12 px-6 md:px-12 font-sans topo-pattern">
      <div className="max-w-4xl mx-auto bg-[#052322] border-2 border-[#FFBD59]/35 rounded-3xl p-6 sm:p-12 shadow-2xl relative z-10 space-y-10">
        
        {/* Header */}
        <div className="border-b border-[#084746] pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#084746] border border-[#FFBD59]/30 text-[#FFBD59] font-heading font-bold text-xs uppercase tracking-wider mb-4">
            Equality Act 2010 // Paraclimbing &amp; Digital Inclusion
          </div>
          <h1 className="text-3xl sm:text-5xl font-black font-heading uppercase tracking-tight text-[#FFBD59]">
            Accessibility &amp; Disability Policy
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 font-mono mt-2">
            Last Updated: {lastUpdated} • Version 1.0 (Statutory Compliance Notice)
          </p>
          <p className="text-sm text-zinc-300 font-sans mt-4 leading-relaxed">
            King&apos;s College London Mountaineering Club (&ldquo;KCLMC&rdquo;) is committed to fostering an inclusive, welcoming, and barrier-free community for all climbers. In accordance with the <strong>Equality Act 2010</strong> and <strong>British Mountaineering Council (BMC) Paraclimbing Guidelines</strong>, we take proactive steps to ensure that students with sensory, physical, cognitive, or neurodivergent disabilities can participate fully and safely in our climbing sessions, social activities, and digital platforms.
          </p>
        </div>

        {/* Section 1: Statutory Framework */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">1.</span> Equality Act 2010 Commitment &amp; Reasonable Adjustments
          </h2>
          <div className="space-y-3 text-xs sm:text-sm text-zinc-300 leading-relaxed">
            <p>
              Under Part 2, Part 7, and Section 101 of the <strong>Equality Act 2010</strong>, associations and sports clubs have a positive legal duty to provide <strong>Reasonable Adjustments</strong> to prevent disabled members from being placed at a substantial disadvantage compared to non-disabled members.
            </p>
            <div className="bg-[#041F1E] border border-[#FFBD59]/20 rounded-2xl p-4 text-xs font-mono text-zinc-300 space-y-2">
              <div><strong className="text-white">Protected Scope:</strong> Physical disabilities, visual impairments (blind / low vision), hearing impairments (deaf / hard-of-hearing), speech impairments (mute / non-verbal), neurodiversity, and long-term health conditions.</div>
              <div><strong className="text-white">Three Core Pillars:</strong> (1) Provisions, criteria, and practices; (2) Auxiliary aids and services; (3) Physical access and environmental adaptations.</div>
            </div>
          </div>
        </section>

        {/* Section 2: Sensory Climbing Protocols (Blind, Deaf, Mute) */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">2.</span> Paraclimbing &amp; Sensory Impairment Field Protocols
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            Climbing is inherently a sensory and communicative discipline. To ensure total safety and autonomy, KCLMC adheres to the following codified protocols at all indoor walls and outdoor crag meets:
          </p>

          <div className="space-y-4 text-xs">
            {/* Blind / Visually Impaired */}
            <div className="bg-[#041F1E] border border-[#084746] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold uppercase text-[#FFBD59] text-base flex items-center gap-2">
                  <span>👁️</span> Blind &amp; Visually Impaired (VI) Climbers
                </h3>
                <span className="px-2 py-0.5 rounded bg-[#084746] text-[#FFBD59] font-mono text-[10px] uppercase font-bold">
                  Sight-Guiding &amp; Clockface Beta
                </span>
              </div>
              <ul className="list-disc list-inside text-zinc-300 space-y-1.5 leading-relaxed">
                <li>
                  <strong className="text-white">The Clockface Direction System:</strong> Sight guides (&ldquo;callers&rdquo;) provide standardized verbal cues referenced to a 12-hour clock relative to the climber&apos;s torso (e.g. <em>&ldquo;Right foot 2 o&apos;clock, 20 centimetres; left hand crimp at 11 o&apos;clock, positive hold&rdquo;</em>).
                </li>
                <li>
                  <strong className="text-white">Two-Way Bluetooth Audio Headsets:</strong> Available for club meets to eliminate ambient noise in crowded climbing gyms and allow low-latency, clear communication between caller and climber.
                </li>
                <li>
                  <strong className="text-white">Tactile Route Exploration:</strong> Climbers are provided dedicated orientation time to touch and explore start holds, wall topography, and bouldering pad boundaries prior to leaving the ground.
                </li>
                <li>
                  <strong className="text-white">Top-Rope Prioritization:</strong> Indoor top-roping and outdoor bottom-fed top-ropes are prioritized to minimize swing vectors and ensure continuous rope tension.
                </li>
              </ul>
            </div>

            {/* Deaf / Hard of Hearing */}
            <div className="bg-[#041F1E] border border-[#084746] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold uppercase text-[#FFBD59] text-base flex items-center gap-2">
                  <span>👂</span> Deaf &amp; Hard-of-Hearing (HoH) Climbers
                </h3>
                <span className="px-2 py-0.5 rounded bg-[#084746] text-[#FFBD59] font-mono text-[10px] uppercase font-bold">
                  Tactile Rope &amp; Visual Beta
                </span>
              </div>
              <ul className="list-disc list-inside text-zinc-300 space-y-1.5 leading-relaxed">
                <li>
                  <strong className="text-white">Standardized Tactile Rope-Tug System:</strong> In high mountain winds or when out of direct sight, climbers and belayers agree on mandatory rope-tug commands:
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px] text-zinc-200">
                    <div className="p-2 bg-[#052322] border border-[#084746] rounded-lg">
                      <strong className="text-emerald-400">3 Sharp Tugs:</strong> &ldquo;Safe / At Anchor / Off Belay&rdquo;
                    </div>
                    <div className="p-2 bg-[#052322] border border-[#084746] rounded-lg">
                      <strong className="text-[#FFBD59]">2 Sharp Tugs:</strong> &ldquo;Slack Required&rdquo;
                    </div>
                    <div className="p-2 bg-[#052322] border border-[#084746] rounded-lg">
                      <strong className="text-amber-400">4 Sharp Tugs:</strong> &ldquo;Take / Full Tension&rdquo;
                    </div>
                  </div>
                </li>
                <li>
                  <strong className="text-white">Universal Visual Hand Signals:</strong> Standardized British Mountain Training hand signals used when belayer and climber are in visual range.
                </li>
                <li>
                  <strong className="text-white">Visual &amp; Written Briefings:</strong> Safety briefings, route descriptions, and meet itineraries are provided in written digital formats (WhatsApp/Email) rather than spoken announcements alone.
                </li>
              </ul>
            </div>

            {/* Mute / Non-Verbal */}
            <div className="bg-[#041F1E] border border-[#084746] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold uppercase text-[#FFBD59] text-base flex items-center gap-2">
                  <span>🗣️</span> Mute &amp; Non-Verbal Climbers
                </h3>
                <span className="px-2 py-0.5 rounded bg-[#084746] text-[#FFBD59] font-mono text-[10px] uppercase font-bold">
                  Whistle &amp; Mentor Pairing
                </span>
              </div>
              <ul className="list-disc list-inside text-zinc-300 space-y-1.5 leading-relaxed">
                <li>
                  <strong className="text-white">Mountaineering Whistle Codes:</strong> Where verbal calls are not possible, standard alpine whistle signaling is established: <em>1 blast = &ldquo;Stop / Attention&rdquo;</em>, <em>3 blasts = &ldquo;Emergency / Assistance required&rdquo;</em>.
                </li>
                <li>
                  <strong className="text-white">Dedicated Buddy Mentorship:</strong> Non-verbal climbers are paired with an experienced committee member or trained partner who is thoroughly briefed on the climber&apos;s pre-agreed signals.
                </li>
                <li>
                  <strong className="text-white">Laminated Emergency Beta Cards:</strong> Climbers may carry a weatherproof emergency card attached to their harness detailing communication preferences and medical considerations for first aiders.
                </li>
              </ul>
            </div>

            {/* Physical & Mobility */}
            <div className="bg-[#041F1E] border border-[#084746] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold uppercase text-[#FFBD59] text-base flex items-center gap-2">
                  <span>♿</span> Physical Disabilities &amp; Paraclimbing
                </h3>
                <span className="px-2 py-0.5 rounded bg-[#084746] text-[#FFBD59] font-mono text-[10px] uppercase font-bold">
                  Adaptive Equipment &amp; Anchors
                </span>
              </div>
              <ul className="list-disc list-inside text-zinc-300 space-y-1.5 leading-relaxed">
                <li>
                  <strong className="text-white">Adaptive Harness Compatibility:</strong> We support full-body, chest, and seated adaptive paraclimbing harnesses.
                </li>
                <li>
                  <strong className="text-white">Mandatory Assisted-Braking Belaying:</strong> We utilize assisted-braking devices (e.g. Petzl Grigri, Beal Birdie) across all society sessions to provide redundant camming protection.
                </li>
                <li>
                  <strong className="text-white">Ballast &amp; Floor Anchors:</strong> Sandbags and floor anchors are deployed at climbing centres to ensure seamless belaying regardless of weight disparity or wheelchair positioning.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 3: Safety Boundaries */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">3.</span> Objective Safety Boundaries &amp; Collaborative Assessment
          </h2>
          <div className="p-4 bg-[#041F1E] border border-amber-500/30 rounded-2xl text-xs sm:text-sm text-zinc-300 leading-relaxed space-y-2">
            <p>
              Under Section 20(3) of the Equality Act 2010 and mountaineering case law, reasonable adjustments do not require compromising fundamental life safety or placing the climber, belayer, or third parties in lethal hazard.
            </p>
            <p>
              High-consequence mountain environments (such as Scottish winter gullies or remote multi-pitch alpine routes) present objective hazards where specific sensory feedback or rapid unassisted movement may be essential to survival. In all cases, KCLMC does <strong>not</strong> make assumptions based on disability. Instead, our Safety Officer conducts a <strong>collaborative, individualized assessment</strong> with the member to identify appropriate venues, crags, and mitigations.
            </p>
          </div>
        </section>

        {/* Section 4: Requesting Adjustments */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">4.</span> How to Request Accommodations &amp; Adjustments
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            Prospective and current members requiring accommodations are encouraged to reach out before sessions or trips so we can ensure suitable gear, callers, and ratios are in place:
          </p>
          <div className="bg-[#041F1E] border border-[#084746] rounded-2xl p-4 text-xs font-mono text-zinc-300 space-y-2">
            <div><strong className="text-white">Email Contact:</strong> <a href="mailto:portal@kclmc.org" className="text-[#FFBD59] underline">portal@kclmc.org</a> / <a href="mailto:committee@kclmc.org" className="text-[#FFBD59] underline">committee@kclmc.org</a></div>
            <div><strong className="text-white">Confidentiality:</strong> Medical and disability disclosures are treated as Special Category Data under UK GDPR Article 9 and shared strictly on a need-to-know basis with your designated trip leader.</div>
            <div><strong className="text-white">KCLSU Disability Officer:</strong> We liaise directly with the KCLSU Student Societies Inclusion team to fund specialized equipment where required.</div>
          </div>
        </section>

        {/* Section 5: Web Content Accessibility Guidelines (WCAG 2.2 AA) */}
        <section className="space-y-3 border-t border-[#084746] pt-6">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">5.</span> Digital Accessibility Statement (WCAG 2.2 Level AA)
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            The KCLMC web portal is designed and maintained in conformance with the <strong>Web Content Accessibility Guidelines (WCAG) 2.2 at Level AA</strong>:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-300">
            <div className="p-3 bg-[#041F1E] rounded-xl border border-[#084746]">
              <strong className="text-[#FFBD59]">High Contrast &amp; Typography:</strong> Text meets or exceeds the 4.5:1 contrast ratio against dark backgrounds.
            </div>
            <div className="p-3 bg-[#041F1E] rounded-xl border border-[#084746]">
              <strong className="text-[#FFBD59]">Keyboard Navigation:</strong> All links, buttons, and interactive modals can be navigated fully using keyboard controls (`Tab`, `Enter`, `Escape`).
            </div>
            <div className="p-3 bg-[#041F1E] rounded-xl border border-[#084746]">
              <strong className="text-[#FFBD59]">Screen Reader Optimization:</strong> Semantic HTML landmarks (<code>&lt;nav&gt;</code>, <code>&lt;header&gt;</code>, <code>&lt;main&gt;</code>, <code>&lt;footer&gt;</code>), structured heading hierarchies, and descriptive <code>aria-label</code> tags.
            </div>
            <div className="p-3 bg-[#041F1E] rounded-xl border border-[#084746]">
              <strong className="text-[#FFBD59]">Alternative Text:</strong> Images, crag diagrams, and topo beta include informative alternative text.
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-2">
            If you encounter any accessibility barriers on our digital platform or require documents in an alternative format (large print, audio transcript, plain text), please contact <a href="mailto:portal@kclmc.org" className="text-[#FFBD59] underline">portal@kclmc.org</a>.
          </p>
        </section>

        {/* Footer Navigation */}
        <div className="border-t border-[#084746] pt-6 flex flex-col sm:flex-row justify-between items-center text-xs text-zinc-400 font-heading uppercase tracking-wider gap-4">
          <Link href="/safety" className="text-amber-400 hover:underline flex items-center gap-1">
            <span>BMC Safety Notice</span>
            <span>→</span>
          </Link>
          <Link href="/terms" className="text-[#FFBD59] hover:underline flex items-center gap-1">
            <span>Terms of Service</span>
            <span>→</span>
          </Link>
          <Link href="/privacy" className="text-[#FFBD59] hover:underline flex items-center gap-1">
            <span>Privacy Policy</span>
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
