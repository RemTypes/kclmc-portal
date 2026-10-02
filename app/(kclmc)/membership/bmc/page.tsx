'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function BmcMembershipGuidePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: 'Why does the BMC portal say "Email not found" or "No active record"?',
      a: 'This usually occurs for one of two reasons: (1) The committee uploads member rosters to the BMC in periodic batch cycles (typically weekly during term or prior to outdoor trips). If you purchased your pass in the last few days, your details will be synchronized in the next batch. (2) You entered a personal email (e.g. Gmail) instead of the exact King\'s student email associated with your KCLSU account. Always use your King\'s email format.'
    },
    {
      q: 'Can I use my personal email instead of my King\'s student email?',
      a: 'Your initial BMC club affiliation is created using the King\'s email address on file with KCLSU. Once your account is claimed and active on thebmc.co.uk, you can add or change your primary contact email address within your BMC profile settings.'
    },
    {
      q: 'Does the £15 Social Pass include BMC membership?',
      a: 'No. The £15 Social Pass covers indoor London wall sessions only. The £45 Recreational Pass includes the mandatory BMC Club Affiliation fee, which covers £15M third-party liability insurance for outdoor rock and mountaineering. You can upgrade on the KCLSU website by paying the difference.'
    },
    {
      q: 'How do I claim my 15% discount at Cotswold Outdoor and Snow+Rock?',
      a: 'Log into your BMC portal on your smartphone and open "Digital Membership Card", or save the card to your Apple/Google Wallet. Present this digital card showing "Affiliated Club: King\'s College London MC" along with the club discount code at checkout.'
    },
    {
      q: 'I need immediate proof of BMC membership for an upcoming meet. What should I do?',
      a: 'If you have purchased a Recreational pass and require expedited verification before the next automated batch cycle, contact the committee via Instagram DM (@kclmc) or email portal@kclmc.org with your KCLSU order receipt.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#041F1E] text-[#F7F7F7] p-6 md:p-12 relative overflow-hidden font-sans topo-pattern">
      <div className="max-w-5xl mx-auto relative z-10 py-8">
        
        {/* Breadcrumb / Top Navigation */}
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mb-6">
          <Link href="/membership" className="hover:text-[#FFBD59] transition-colors">
            ← Membership Passes
          </Link>
          <span>/</span>
          <span className="text-[#FFBD59]">BMC Affiliation &amp; Insurance</span>
        </div>

        {/* Hero Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#084746] border border-[#FFBD59]/40 text-[#FFBD59] text-xs font-mono uppercase tracking-widest mb-4">
            <span>🏔️</span>
            <span>Official Society Affiliation</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-black font-heading uppercase tracking-tight text-[#FFBD59] mb-4">
            BMC Club Membership &amp; Insurance Guide
          </h1>

          <p className="text-zinc-300 text-base md:text-lg max-w-3xl leading-relaxed">
            Every King&apos;s student holding an active <strong>KCLSU Recreational Pass</strong> is affiliated with the <strong>British Mountaineering Council (BMC)</strong>. Here is how your membership works, how to claim your digital card, and why we recommend the <strong>Austrian Alpine Club (AAC)</strong> for student mountain travel insurance.
          </p>
        </div>

        {/* 3-Step Activation Timeline */}
        <div className="mb-14">
          <h2 className="text-2xl font-bold font-heading uppercase tracking-wide text-white mb-6 flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-[#084746] border border-[#FFBD59]/40 flex items-center justify-center text-[#FFBD59] text-sm">
              01
            </span>
            <span>How to Claim Your BMC Account in 3 Steps</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="bg-[#052322] border border-[#FFBD59]/25 rounded-2xl p-6 relative flex flex-col justify-between shadow-xl">
              <div>
                <div className="text-xs font-mono uppercase text-[#FFBD59] font-bold mb-2">
                  Step 1 • Purchase
                </div>
                <h3 className="text-lg font-bold font-heading uppercase text-white mb-3">
                  Hold a Recreational Pass
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-4">
                  Only the <strong>£45 Recreational Pass</strong> includes BMC Club Affiliation. If you currently hold the £15 Social pass, upgrade via KCLSU before attending outdoor trips.
                </p>
              </div>
              <div className="pt-4 border-t border-[#084746]">
                <Link
                  href="/membership"
                  className="text-xs font-mono text-[#FFBD59] hover:underline inline-flex items-center gap-1 font-bold"
                >
                  <span>Check Your Pass Status</span>
                  <span>→</span>
                </Link>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-[#052322] border border-[#FFBD59]/25 rounded-2xl p-6 relative flex flex-col justify-between shadow-xl">
              <div>
                <div className="text-xs font-mono uppercase text-[#FFBD59] font-bold mb-2">
                  Step 2 • Committee Upload
                </div>
                <h3 className="text-lg font-bold font-heading uppercase text-white mb-3">
                  Roster Batch Sync
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-4">
                  The committee reconciles the official KCLSU membership roster and uploads active members in weekly batch cycles directly into the national BMC database.
                </p>
              </div>
              <div className="pt-4 border-t border-[#084746] text-xs font-mono text-zinc-400">
                <span>⏱ Processed every week in term</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-[#052322] border border-[#FFBD59]/25 rounded-2xl p-6 relative flex flex-col justify-between shadow-xl">
              <div>
                <div className="text-xs font-mono uppercase text-[#FFBD59] font-bold mb-2">
                  Step 3 • Claim Digital Card
                </div>
                <h3 className="text-lg font-bold font-heading uppercase text-white mb-3">
                  Log in on thebmc.co.uk
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-4">
                  Visit the BMC portal, click <strong>Create Account / Claim Account</strong>, and enter your <strong>King&apos;s student email</strong>. Your club affiliation will be recognized immediately.
                </p>
              </div>
              <div className="pt-4 border-t border-[#084746]">
                <a
                  href="https://www.thebmc.co.uk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-[#FFBD59] hover:underline inline-flex items-center gap-1 font-bold"
                >
                  <span>Open BMC Portal (thebmc.co.uk)</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Core Benefits Breakdown */}
        <div className="mb-14 bg-[#052322] border border-[#084746] rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold font-heading uppercase tracking-wide text-white mb-2 flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-[#084746] border border-[#FFBD59]/40 flex items-center justify-center text-[#FFBD59] text-sm">
              02
            </span>
            <span>Your BMC Club Affiliation Benefits</span>
          </h2>
          <p className="text-xs font-sans text-zinc-300 mb-6">
            Included automatically as part of your KCLSU Recreational membership fee:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-[#041F1E] border border-[#FFBD59]/20">
              <div className="text-2xl mb-2">🛡️</div>
              <h3 className="font-heading font-bold text-base uppercase text-emerald-400 mb-2">
                £15M Civil Liability
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Protects you worldwide (excluding USA/Canada) against third-party bodily injury and property damage claims caused during recognized club mountaineering and climbing activities.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#041F1E] border border-[#FFBD59]/20">
              <div className="text-2xl mb-2">🏷️</div>
              <h3 className="font-heading font-bold text-base uppercase text-[#FFBD59] mb-2">
                15% Retail Discounts
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Access 15% off outdoor gear, footwear, and climbing hardware at Cotswold Outdoor, Snow+Rock, Runners Need, Ellis Brigham, and Montane.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#041F1E] border border-[#FFBD59]/20">
              <div className="text-2xl mb-2">📖</div>
              <h3 className="font-heading font-bold text-base uppercase text-white mb-2">
                Summit &amp; Club Huts
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Enjoy free digital access to the quarterly <em>Summit</em> magazine, reduced rates at national mountain centres (Plas y Brenin), and access to BMC club huts across the UK.
              </p>
            </div>
          </div>
        </div>

        {/* Travel & Rescue Insurance Spotlight: AAC vs BMC */}
        <div className="mb-14">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
            <h2 className="text-2xl font-bold font-heading uppercase tracking-wide text-white flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-[#084746] border border-[#FFBD59]/40 flex items-center justify-center text-[#FFBD59] text-sm">
                03
              </span>
              <span>Mountain Travel &amp; Rescue Insurance</span>
            </h2>
            <span className="text-xs font-mono uppercase bg-amber-950 text-amber-300 px-3 py-1 rounded-full border border-amber-600/40 font-bold">
              Essential for Scottish Winter &amp; Alps
            </span>
          </div>

          {/* Important Distinction Banner */}
          <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-5 mb-8 text-xs font-sans text-amber-200/90 leading-relaxed">
            <strong className="text-amber-300 font-bold font-mono uppercase block mb-1">
              ⚠️ Important Insurance Distinction:
            </strong>
            The BMC combined liability cover included with your pass is <em>third-party liability only</em>. It <strong>does not cover personal search &amp; rescue, helicopter evacuation, medical expenses, or repatriation</strong>. For Scottish winter mountaineering, alpine expeditions, and European climbing trips, you must hold personal rescue/travel insurance.
          </div>

          {/* Comparison Cards: AAC (Recommended) vs BMC */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* AAC Card (RECOMMENDED) */}
            <div className="bg-[#052322] border-2 border-[#FFBD59] rounded-3xl p-6 sm:p-8 relative shadow-2xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="px-3 py-1 rounded-full bg-[#FFBD59] text-[#052322] font-mono text-xs font-bold uppercase tracking-wider">
                    ★ KCLMC Recommended for Students
                  </span>
                  <span className="text-xs font-mono text-[#FFBD59] font-bold">Best Value</span>
                </div>

                <h3 className="text-2xl font-bold font-heading uppercase text-white mb-2">
                  Austrian Alpine Club (AAC UK)
                </h3>
                <p className="text-xs text-zinc-300 mb-6 leading-relaxed">
                  The Österreichischer Alpenverein (OeAV) UK Section. Highly popular among UK university mountaineering clubs because of its exceptional value for students.
                </p>

                <div className="space-y-3 text-xs text-zinc-300 mb-6">
                  <div className="flex items-start gap-2.5">
                    <span className="text-emerald-400 font-bold text-sm">✔</span>
                    <div>
                      <strong className="text-white">Significantly Lower Student Cost:</strong>
                      <p className="text-zinc-400">Around £30–£50/year for juniors and students under 25, covering an entire 12 months worldwide.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-emerald-400 font-bold text-sm">✔</span>
                    <div>
                      <strong className="text-white">Worldwide Mountain Rescue:</strong>
                      <p className="text-zinc-400">Up to €25,000 search &amp; rescue cover per person, plus medical repatriation costs without financial limit.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-emerald-400 font-bold text-sm">✔</span>
                    <div>
                      <strong className="text-white">Alpine Hut Reciprocal Rights:</strong>
                      <p className="text-zinc-400">Up to 50% discount on overnight hut fees across Austria, France (CAF), Switzerland (SAC), and Italy (CAI).</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-zinc-400 font-bold text-sm">ℹ</span>
                    <div>
                      <strong className="text-zinc-300">Coverage Scope:</strong>
                      <p className="text-zinc-400">Focuses strictly on search, rescue, and emergency medical treatment. Does not cover baggage or flight cancellations.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-[#084746] flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="text-xs font-mono">
                  <span className="text-zinc-400 block">Student Price:</span>
                  <span className="text-[#FFBD59] font-bold text-base">~£35–£48 / year</span>
                </div>
                <a
                  href="https://aacuk.org.uk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#FFBD59] hover:bg-[#FFE0A3] text-[#052322] font-mono text-xs font-bold uppercase rounded-xl transition-colors shadow text-center"
                >
                  Join AAC UK ↗
                </a>
              </div>
            </div>

            {/* BMC Travel Insurance Card */}
            <div className="bg-[#052322] border border-[#084746] rounded-3xl p-6 sm:p-8 relative shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="px-3 py-1 rounded-full bg-[#084746] text-zinc-300 font-mono text-xs uppercase tracking-wider">
                    Comprehensive Option
                  </span>
                  <span className="text-xs font-mono text-zinc-400">Club Discounted</span>
                </div>

                <h3 className="text-2xl font-bold font-heading uppercase text-white mb-2">
                  BMC Travel Insurance
                </h3>
                <p className="text-xs text-zinc-300 mb-6 leading-relaxed">
                  Specialized climbing, trekking, and alpine travel insurance policies provided directly by the British Mountaineering Council.
                </p>

                <div className="space-y-3 text-xs text-zinc-300 mb-6">
                  <div className="flex items-start gap-2.5">
                    <span className="text-emerald-400 font-bold text-sm">✔</span>
                    <div>
                      <strong className="text-white">Full Travel &amp; Gear Protection:</strong>
                      <p className="text-zinc-400">Covers climbing equipment loss/damage, baggage delays, trip cancellation, and full emergency medical expenses up to £10M.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-emerald-400 font-bold text-sm">✔</span>
                    <div>
                      <strong className="text-white">Tailored Climbing Policies:</strong>
                      <p className="text-zinc-400">Tiered policies specifically designed for rock climbing, ice climbing, high alpine, and expeditions.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-emerald-400 font-bold text-sm">✔</span>
                    <div>
                      <strong className="text-white">Single-Trip Options:</strong>
                      <p className="text-zinc-400">Can be purchased for short weekend crag trips (e.g. 3-day Fontainebleau trip) or as an annual multi-trip policy.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-zinc-400 font-bold text-sm">ℹ</span>
                    <div>
                      <strong className="text-zinc-300">Cost Consideration:</strong>
                      <p className="text-zinc-400">Annual policies can be significantly more expensive than AAC for students, but single-trip cover is flexible.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-[#084746] flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="text-xs font-mono">
                  <span className="text-zinc-400 block">Pricing:</span>
                  <span className="text-white font-bold text-base">From £35 (Single Trip)</span>
                </div>
                <a
                  href="https://www.thebmc.co.uk/insurance"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#084746] hover:bg-[#0b5c5b] text-[#FFBD59] font-mono text-xs font-bold uppercase rounded-xl border border-[#FFBD59]/40 transition-colors text-center"
                >
                  Explore BMC Insurance ↗
                </a>
              </div>
            </div>
          </div>

          {/* Quick Comparison Matrix */}
          <div className="bg-[#052322] border border-[#084746] rounded-2xl overflow-hidden shadow-lg">
            <div className="px-6 py-4 bg-[#041F1E] border-b border-[#084746] font-mono text-xs font-bold text-[#FFBD59] uppercase tracking-wider">
              Quick Comparison: Insurance for King&apos;s Climbers
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-sans text-left">
                <thead className="bg-[#084746]/40 text-zinc-300 font-mono uppercase text-[11px] border-b border-[#084746]">
                  <tr>
                    <th className="p-3.5">Cover Type</th>
                    <th className="p-3.5">KCLSU Pass (BMC Club)</th>
                    <th className="p-3.5 text-[#FFBD59]">Austrian Alpine Club (AAC)</th>
                    <th className="p-3.5">BMC Travel Insurance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#084746] text-zinc-300">
                  <tr>
                    <td className="p-3.5 font-bold text-white">Third-Party Civil Liability</td>
                    <td className="p-3.5 text-emerald-400 font-bold">✔ £15 Million</td>
                    <td className="p-3.5 text-emerald-400">✔ €3 Million</td>
                    <td className="p-3.5 text-emerald-400">✔ Included in policy</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-bold text-white">Mountain Search &amp; Rescue</td>
                    <td className="p-3.5 text-red-400">✘ Not Covered</td>
                    <td className="p-3.5 text-emerald-400 font-bold">✔ Up to €25,000</td>
                    <td className="p-3.5 text-emerald-400 font-bold">✔ Up to policy limits</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-bold text-white">Medical Repatriation</td>
                    <td className="p-3.5 text-red-400">✘ Not Covered</td>
                    <td className="p-3.5 text-emerald-400 font-bold">✔ Unlimited worldwide</td>
                    <td className="p-3.5 text-emerald-400 font-bold">✔ Up to £10 Million</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-bold text-white">Baggage / Gear Protection</td>
                    <td className="p-3.5 text-zinc-500">✘ None</td>
                    <td className="p-3.5 text-zinc-500">✘ None</td>
                    <td className="p-3.5 text-emerald-400 font-bold">✔ Up to £2,500+</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-bold text-white">Best Suited For</td>
                    <td className="p-3.5">UK crags &amp; wall sessions</td>
                    <td className="p-3.5 text-[#FFBD59] font-bold">Annual student mountain rescue (Best Value)</td>
                    <td className="p-3.5">Single-trip full travel + gear cover</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Troubleshooting & FAQ Accordion */}
        <div className="mb-14">
          <h2 className="text-2xl font-bold font-heading uppercase tracking-wide text-white mb-6 flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-[#084746] border border-[#FFBD59]/40 flex items-center justify-center text-[#FFBD59] text-sm">
              04
            </span>
            <span>Frequently Asked Questions &amp; Troubleshooting</span>
          </h2>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-[#052322] border border-[#084746] rounded-2xl overflow-hidden transition-colors"
              >
                <button
                  onClick={() => toggleFaq(i)}
                  className="w-full text-left p-5 flex justify-between items-center gap-4 text-sm font-heading font-bold uppercase tracking-wide text-white hover:text-[#FFBD59] transition-colors"
                >
                  <span>{faq.q}</span>
                  <span className="text-[#FFBD59] font-mono text-base shrink-0">
                    {openFaq === i ? '−' : '+'}
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-xs text-zinc-300 font-sans leading-relaxed border-t border-[#084746]/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Contact & Action Bar */}
        <div className="bg-[#084746]/60 border border-[#FFBD59]/30 rounded-3xl p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl">
          <div>
            <h3 className="text-xl font-bold font-heading uppercase text-white mb-1">
              Still Need Help Claiming Your Affiliation?
            </h3>
            <p className="text-xs text-zinc-300 font-sans">
              Our committee secretaries can check your KCLSU roster record or reissue verification immediately.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:portal@kclmc.org?subject=BMC%20Club%20Membership%20Inquiry"
              className="px-5 py-2.5 bg-[#FFBD59] hover:bg-[#FFE0A3] text-[#052322] font-mono text-xs font-bold uppercase rounded-xl transition-colors shadow"
            >
              Email Committee →
            </a>
            <Link
              href="/trips"
              className="px-5 py-2.5 bg-[#041F1E] hover:bg-[#052322] text-[#FFBD59] font-mono text-xs font-bold uppercase rounded-xl border border-[#FFBD59]/40 transition-colors"
            >
              View Meets Calendar ↗
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
