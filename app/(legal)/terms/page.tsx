import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: "Terms & Conditions",
  description: "Official Terms of Service, Membership Rules, Merch Drop Policies, and Trip Regulations for KCLMC.",
};

export default function TermsPage() {
  const lastUpdated = "September 30, 2026";

  return (
    <div className="min-h-screen bg-[#041F1E] text-slate-100 py-12 px-6 md:px-12 font-sans topo-pattern">
      <div className="max-w-4xl mx-auto bg-[#052322] border-2 border-[#FFBD59]/35 rounded-3xl p-6 sm:p-12 shadow-2xl relative z-10 space-y-10">
        
        {/* Header */}
        <div className="border-b border-[#084746] pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#084746] border border-[#FFBD59]/30 text-[#FFBD59] font-heading font-bold text-xs uppercase tracking-wider mb-4">
            Society Agreement // 2026/27
          </div>
          <h1 className="text-3xl sm:text-5xl font-black font-heading uppercase tracking-tight text-[#FFBD59]">
            Terms &amp; Conditions
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 font-mono mt-2">
            Last Updated: {lastUpdated} • Version 2.2
          </p>
          <p className="text-sm text-zinc-300 font-sans mt-4 leading-relaxed">
            Welcome to the official King&apos;s College London Mountaineering Club (&ldquo;KCLMC&rdquo;) web portal. By accessing this platform, creating a member account, purchasing club stash, or participating in club climbing activities, you agree to be legally bound by these Terms of Service.
          </p>
        </div>

        {/* Section 1: Membership & Eligibility */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">1.</span> Membership Eligibility &amp; Tiers
          </h2>
          <div className="space-y-3 text-xs sm:text-sm text-zinc-300 leading-relaxed">
            <p>
              KCLMC is an accredited student society of the <strong>King&apos;s College London Students&apos; Union (KCLSU)</strong>. Official membership must be purchased via the KCLSU portal and reconciled with this platform:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-[#041F1E] rounded-xl border border-[#084746] space-y-1.5">
                <div className="font-heading font-bold text-[#FFBD59] uppercase text-sm">Social Membership</div>
                <p>Grants access to socials, pub meets, training seminars, online community channels, and apparel pre-orders. Does <em>not</em> include outdoor climbing meets or gear hire.</p>
              </div>
              <div className="p-4 bg-[#041F1E] rounded-xl border border-[#084746] space-y-1.5">
                <div className="font-heading font-bold text-[#FFBD59] uppercase text-sm">Recreational Membership</div>
                <p>Full society membership granting priority access to outdoor weekend meets, Scottish winter trips, subsidised wall sessions, and club technical gear hire.</p>
              </div>
            </div>
            <p className="text-[11px] text-zinc-400">
              <strong>Non-Transferability:</strong> All membership passes and QR credentials are strictly non-transferable and bound to your personal KCL Student ID. Sharing or allowing another individual to use your pass is grounds for immediate membership revocation.
            </p>
          </div>
        </section>

        {/* Section 2: Code of Conduct */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">2.</span> Member Code of Conduct &amp; Safety
          </h2>
          <div className="space-y-3 text-xs sm:text-sm text-zinc-300 leading-relaxed">
            <p>
              All members, committee officers, and trip participants are bound by the <strong>KCLSU Student Code of Conduct</strong> and KCLMC Safe Space Policy:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-zinc-300">
              <li><strong>Zero Tolerance:</strong> Harassment, bullying, discrimination, sexual misconduct, and hazing of any kind will result in immediate suspension, expulsion, and escalation to KCL Student Conduct.</li>
              <li><strong>Crag &amp; Environmental Stewardship:</strong> We uphold the <em>Leave No Trace</em> ethic. Members must adhere to local access restrictions, respect crag closures, pack out all waste, and avoid damaging sandstone/limestone ecosystems.</li>
              <li><strong>Equality &amp; Disability Inclusion:</strong> We are committed to barrier-free access under the <strong>Equality Act 2010</strong>. Discrimination or harassment on grounds of disability, gender, race, or sexual orientation is strictly prohibited. For sensory or physical accommodations, refer to our <Link href="/accessibility" className="text-[#FFBD59] underline">Accessibility &amp; Paraclimbing Policy</Link>.</li>
              <li><strong>Substance Policy:</strong> Consumption of alcohol or recreational substances immediately before or during any climbing, belaying, or scrambling activity is strictly prohibited.</li>
            </ul>
          </div>
        </section>

        {/* Section 3: Merch Drops */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">3.</span> Apparel Drops &amp; Pre-Orders (Consumer Rights Act 2015)
          </h2>
          <div className="space-y-3 text-xs sm:text-sm text-zinc-300 leading-relaxed">
            <p>
              Club apparel (hoodies, fleeces, tees) is offered on a pre-order campaign basis to provide high-spec technical garments at cost price:
            </p>
            <div className="p-4 bg-[#041F1E] rounded-xl border border-[#084746] space-y-2 text-xs">
              <div>
                <strong className="text-white">Minimum Order Quantity (MOQ) Guarantee:</strong> If a drop fails to meet factory MOQ by the closing deadline, all pre-orders are cancelled and members receive a <strong>100% full refund</strong> within 7 business days.
              </div>
              <div>
                <strong className="text-white">Cancellation &amp; Statutory Rights:</strong> In accordance with the Consumer Contracts Regulations 2013, you may cancel your pre-order for a full refund at any time prior to the drop deadline. Once the campaign closes and custom embroidery/manufacturing commences, cancellations cannot be accepted.
              </div>
              <div>
                <strong className="text-white">Faulty Goods:</strong> In accordance with the Consumer Rights Act 2015, any item received with manufacturing defects or damage will be replaced or fully refunded.
              </div>
              <div>
                <strong className="text-white">Collection:</strong> Apparel must be collected in person at designated campus meets within 90 days of arrival. Unclaimed items will be recycled into club loaner stash.
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Trips & Expeditions */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">4.</span> Trips, Meets &amp; Weather Contingency
          </h2>
          <div className="space-y-3 text-xs sm:text-sm text-zinc-300 leading-relaxed">
            <ul className="list-disc list-inside space-y-1.5 text-xs text-zinc-300">
              <li><strong>Deposits &amp; Cancellations:</strong> Deposits for external bunkhouses, cottage bookings, or transport hire are strictly non-refundable once committed to third-party vendors. If you can no longer attend, you may find an eligible substitute member subject to trip leader approval.</li>
              <li><strong>Leader Discretion &amp; Authority:</strong> Designated trip leaders, climbing guides, and safety officers hold absolute authority to modify routes, postpone climbs, or turn back any participant on grounds of weather, insufficient fitness, missing technical gear, or safety concerns.</li>
              <li><strong>Weather &amp; Force Majeure:</strong> British mountain weather is notoriously unpredictable. Meets will not be refunded solely due to wet weather; alternative wet-weather cragging or training itineraries will be provided.</li>
              <li><strong>Safeguarding &amp; Under-18 Members:</strong> In accordance with KCLSU Safeguarding and the Protection of Freedoms Act 2012, student members aged 16–17 must have a parent or legal guardian execute the official KCLSU Parental Consent Form before attending any overnight, residential, or multi-day mountain meet.</li>
            </ul>
          </div>
        </section>

        {/* Section 5: Technical Gear */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">5.</span> Technical Equipment Hire &amp; Responsibility
          </h2>
          <div className="space-y-3 text-xs sm:text-sm text-zinc-300 leading-relaxed">
            <p>
              Club gear (ropes, helmets, belay devices, boulder pads, trad protection) is loaned under the following strict conditions:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs text-zinc-300">
              <li>Borrowers must inspect all equipment before use and satisfy themselves of its sound physical condition.</li>
              <li>Any high-impact falls, rockfall strikes, chemical contamination, or drop damage <strong>must be reported immediately</strong> to the Gear Secretary so the item can be quarantined and retired.</li>
              <li>Borrowers are financially responsible for negligent loss or destruction of club equipment.</li>
            </ul>
          </div>
        </section>

        {/* Section 6: Statutory Liability & Inherent Hazards */}
        <section className="space-y-3 border-t border-[#084746] pt-6">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">6.</span> Limitation of Liability &amp; Statutory Rights (UCTA &amp; CRA)
          </h2>
          <div className="space-y-3 text-xs sm:text-sm text-zinc-300 leading-relaxed">
            <div className="p-4 bg-[#041F1E] border border-amber-500/30 rounded-2xl space-y-2">
              <p>
                <strong className="text-white">Statutory Non-Exclusion:</strong> Nothing in these Terms shall limit or exclude KCLMC&apos;s liability for death or personal injury resulting from negligence, or for fraud or fraudulent misrepresentation, where prohibited by <strong>Section 2(1) of the Unfair Contract Terms Act 1977 (UCTA)</strong> and <strong>Section 65 of the Consumer Rights Act 2015 (CRA)</strong>.
              </p>
              <p>
                <strong className="text-white">Voluntary Assumption of Inherent Hazards (Volenti Non Fit Injuria):</strong> In the absence of negligence, members freely acknowledge that climbing, mountaineering, and hill activities carry unavoidable objective risks of personal injury or death. In accordance with the <strong>BMC Participation Statement</strong>, participants are responsible for their own actions and involvement.
              </p>
            </div>
          </div>
        </section>

        {/* Section 7: Jurisdiction */}
        <section className="space-y-3 border-t border-[#084746] pt-6">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">7.</span> Governing Law &amp; Jurisdiction
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            These terms are governed by and construed in accordance with the laws of <strong>England and Wales</strong>. Any disputes arising in connection with these terms shall be subject to the exclusive jurisdiction of the English courts.
          </p>
        </section>

        {/* Footer Navigation */}
        <div className="border-t border-[#084746] pt-6 flex flex-col sm:flex-row justify-between items-center text-xs text-zinc-400 font-heading uppercase tracking-wider gap-4">
          <Link href="/accessibility" className="text-emerald-400 hover:underline flex items-center gap-1">
            <span>♿ Accessibility Policy</span>
            <span>→</span>
          </Link>
          <Link href="/privacy" className="text-[#FFBD59] hover:underline flex items-center gap-1">
            <span>Read Privacy Policy</span>
            <span>→</span>
          </Link>
          <Link href="/safety" className="text-amber-400 hover:underline flex items-center gap-1">
            <span>BMC Safety &amp; Risk Statement</span>
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
