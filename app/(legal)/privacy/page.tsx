import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: "Privacy & Cookie Policy | King's College London Mountaineering Club",
  description: "Official UK GDPR and Data Protection Act 2018 Privacy Notice for KCLMC members and visitors.",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "September 30, 2026";

  return (
    <div className="min-h-screen bg-[#041F1E] text-slate-100 py-12 px-6 md:px-12 font-sans topo-pattern">
      <div className="max-w-4xl mx-auto bg-[#052322] border-2 border-[#FFBD59]/35 rounded-3xl p-6 sm:p-12 shadow-2xl relative z-10 space-y-10">
        
        {/* Header */}
        <div className="border-b border-[#084746] pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#084746] border border-[#FFBD59]/30 text-[#FFBD59] font-heading font-bold text-xs uppercase tracking-wider mb-4">
            UK GDPR // DPA 2018 Compliance
          </div>
          <h1 className="text-3xl sm:text-5xl font-black font-heading uppercase tracking-tight text-[#FFBD59]">
            Privacy &amp; Cookie Policy
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 font-mono mt-2">
            Last Updated: {lastUpdated} • Version 2.4
          </p>
          <p className="text-sm text-zinc-300 font-sans mt-4 leading-relaxed">
            King&apos;s College London Mountaineering Club (&ldquo;KCLMC&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is committed to protecting the privacy, confidentiality, and security of our members&apos; personal data in strict compliance with the **UK General Data Protection Regulation (UK GDPR)** and the **Data Protection Act 2018 (DPA 2018)**.
          </p>
        </div>

        {/* Section 1: Data Controller */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">1.</span> Data Controller &amp; Contact Information
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            KCLMC operates as an accredited student society under the governance of the <strong>King&apos;s College London Students&apos; Union (KCLSU)</strong>, a registered charity in England and Wales (Charity No. 1136043).
          </p>
          <div className="bg-[#041F1E] border border-[#FFBD59]/20 rounded-2xl p-4 text-xs font-mono text-zinc-300 space-y-1.5">
            <div><strong className="text-white">Data Controller:</strong> KCL Mountaineering Club Committee</div>
            <div><strong className="text-white">Charity Umbrella:</strong> King&apos;s College London Students&apos; Union</div>
            <div><strong className="text-white">Registered Address:</strong> Student Centre, Macadam Building, Surrey Street, London WC2R 2NS, UK</div>
            <div><strong className="text-white">Data Protection Contact:</strong> <a href="mailto:portal@kclmc.org" className="text-[#FFBD59] underline">portal@kclmc.org</a></div>
          </div>
        </section>

        {/* Section 2: Data We Collect */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">2.</span> Information We Collect
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            We only collect personal information that is directly necessary to verify student memberships, administer climbing trips safely, and manage club operations:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-[#041F1E] border border-[#084746] rounded-xl p-4 space-y-2">
              <h3 className="font-heading font-bold uppercase text-[#FFBD59] text-sm">Account &amp; Student Identity</h3>
              <ul className="list-disc list-inside text-zinc-300 space-y-1">
                <li>Full name and preferred name</li>
                <li>King&apos;s College London Student ID (e.g. <code>K1234567</code>)</li>
                <li>University email address (<code>@kcl.ac.uk</code>)</li>
                <li>Hashed account passwords</li>
              </ul>
            </div>
            <div className="bg-[#041F1E] border border-[#084746] rounded-xl p-4 space-y-2">
              <h3 className="font-heading font-bold uppercase text-[#FFBD59] text-sm">Safety &amp; Emergency Beta</h3>
              <ul className="list-disc list-inside text-zinc-300 space-y-1">
                <li>Emergency contact (next-of-kin name and phone)</li>
                <li>Voluntarily declared medical notes (allergies, asthma)</li>
                <li>Climbing experience and belay competence self-rating</li>
              </ul>
            </div>
            <div className="bg-[#041F1E] border border-[#084746] rounded-xl p-4 space-y-2">
              <h3 className="font-heading font-bold uppercase text-[#FFBD59] text-sm">Membership &amp; Merch Orders</h3>
              <ul className="list-disc list-inside text-zinc-300 space-y-1">
                <li>Membership tier (Social vs. Recreational)</li>
                <li>KCLSU transaction IDs and purchase timestamps</li>
                <li>Apparel pre-orders, sizing selections, and order status</li>
                <li><em>(Note: Payment card details are processed by Stripe / KCLSU and never stored by KCLMC)</em></li>
              </ul>
            </div>
            <div className="bg-[#041F1E] border border-[#084746] rounded-xl p-4 space-y-2">
              <h3 className="font-heading font-bold uppercase text-[#FFBD59] text-sm">Technical &amp; Security Logs</h3>
              <ul className="list-disc list-inside text-zinc-300 space-y-1">
                <li>IP addresses and session timestamps</li>
                <li>Cloudflare DDoS and bot-mitigation challenge logs</li>
                <li>Failed authentication rate-limiting telemetry</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 3: Lawful Bases */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">3.</span> Lawful Bases for Processing (UK GDPR Art. 6 &amp; 9)
          </h2>
          <div className="space-y-3 text-xs sm:text-sm text-zinc-300">
            <div className="p-3.5 bg-[#041F1E] rounded-xl border border-[#084746]">
              <strong className="text-white">Contractual Necessity (Art. 6(1)(b)):</strong> Processing your membership pass, event signups, and club stash orders in fulfillment of your society membership contract.
            </div>
            <div className="p-3.5 bg-[#041F1E] rounded-xl border border-[#084746]">
              <strong className="text-white">Vital Interests (Art. 6(1)(d)):</strong> Holding emergency contact information and critical medical notes for handover to Mountain Rescue, emergency medical services, or NHS personnel during severe mountain or crag incidents.
            </div>
            <div className="p-3.5 bg-[#041F1E] rounded-xl border border-[#084746]">
              <strong className="text-white">Legitimate Interests (Art. 6(1)(f)):</strong> Verifying active student status with KCLSU, preventing fraudulent pass duplication, maintaining equipment loan safety logs, and securing the platform.
            </div>
            <div className="p-3.5 bg-[#041F1E] rounded-xl border border-[#084746]">
              <strong className="text-white">Explicit Consent (Art. 9(2)(a)):</strong> Special category health data (e.g. medical conditions or dietary requirements) disclosed specifically for residential trips.
            </div>
          </div>
        </section>

        {/* Section 4: Third-Party Sub-Processors */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">4.</span> Third-Party Sub-Processors &amp; Infrastructure
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            We partner with trusted infrastructure providers who adhere strictly to UK GDPR and International Data Transfer Agreements (IDTA):
          </p>
          <ul className="text-xs text-zinc-300 space-y-2 list-disc list-inside">
            <li><strong>Cloudflare Inc.</strong> — Edge hosting, CDN, DNS routing, and DDoS security (UK/EU edge servers).</li>
            <li><strong>Supabase Inc.</strong> — Encrypted PostgreSQL database and authentication engine (EU London/Ireland region, AES-256 encrypted at rest).</li>
            <li><strong>Resend Inc.</strong> — Transactional email dispatch for password recovery and magic links (EU delivery zone).</li>
            <li><strong>King&apos;s College London Students&apos; Union (KCLSU)</strong> — Official student union roster reconciliation and membership verification.</li>
          </ul>
        </section>

        {/* Section 5: Data Retention */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">5.</span> Data Retention &amp; Disposal
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            We adhere to strict data minimization principles:
          </p>
          <ul className="text-xs text-zinc-300 space-y-1.5 list-disc list-inside">
            <li><strong>Active Membership Passes:</strong> Retained for the duration of the academic year plus 12 months for re-enrollment continuity.</li>
            <li><strong>Trip Medical &amp; Emergency Forms:</strong> Securely destroyed or purged within 30 days of the conclusion of each outdoor meet.</li>
            <li><strong>Merchandise Financial Records:</strong> Retained for 6 years in accordance with UK statutory accounting and tax regulations.</li>
          </ul>
        </section>

        {/* Section 6: Data Subject Rights */}
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">6.</span> Your Rights Under UK GDPR
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            As a data subject, you hold the following statutory rights under the Data Protection Act 2018:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-300">
            <div className="p-3 bg-[#041F1E] rounded-xl border border-[#084746]">
              <strong className="text-[#FFBD59]">Right of Access (SAR):</strong> Request a copy of all personal records we hold about you free of charge.
            </div>
            <div className="p-3 bg-[#041F1E] rounded-xl border border-[#084746]">
              <strong className="text-[#FFBD59]">Right to Rectification:</strong> Request correction of inaccurate or outdated information.
            </div>
            <div className="p-3 bg-[#041F1E] rounded-xl border border-[#084746]">
              <strong className="text-[#FFBD59]">Right to Erasure (&ldquo;Forgotten&rdquo;):</strong> Request deletion of your account and personal profile where no statutory retention applies.
            </div>
            <div className="p-3 bg-[#041F1E] rounded-xl border border-[#084746]">
              <strong className="text-[#FFBD59]">Right to Data Portability:</strong> Obtain an export of your account data in standard machine-readable JSON format.
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-2">
            To exercise any of these rights, email us at <a href="mailto:portal@kclmc.org" className="text-[#FFBD59] underline">portal@kclmc.org</a>. We respond to all verified requests within 30 days as required by UK law. You also have the right to lodge a complaint with the <strong>Information Commissioner&apos;s Office (ICO)</strong> at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-[#FFBD59] underline">ico.org.uk</a>.
          </p>
        </section>

        {/* Section 7: Cookies */}
        <section className="space-y-3 border-t border-[#084746] pt-6">
          <h2 className="text-xl sm:text-2xl font-bold font-heading uppercase text-white tracking-wide flex items-center gap-2">
            <span className="text-[#FFBD59]">7.</span> Cookie &amp; Local Storage Policy (PECR)
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            In accordance with the <strong>Privacy and Electronic Communications Regulations (PECR)</strong>:
          </p>
          <div className="p-4 bg-[#041F1E] border border-emerald-500/30 rounded-2xl text-xs space-y-2 text-zinc-300">
            <div className="font-heading font-bold text-emerald-400 uppercase tracking-wider text-sm flex items-center gap-1.5">
              <span>✔</span> 100% Zero Advertising Trackers
            </div>
            <p>
              We do <strong>not</strong> use third-party marketing cookies, ad pixels, or behavioral profiling trackers. We only utilize <strong>Strictly Necessary</strong> cookies and local storage tokens essential to authenticate your login session (<code>sb-*-auth-token</code>) and protect the platform against cyberattacks (Cloudflare bot defense).
            </p>
            <p className="text-[11px] text-zinc-400">
              Under UK law, strictly necessary functional tokens are exempt from requiring intrusive opt-in pop-up banners.
            </p>
          </div>
        </section>

        {/* Footer Navigation */}
        <div className="border-t border-[#084746] pt-6 flex flex-col sm:flex-row justify-between items-center text-xs text-zinc-400 font-heading uppercase tracking-wider gap-4">
          <Link href="/terms" className="text-[#FFBD59] hover:underline flex items-center gap-1">
            <span>Read Terms of Service</span>
            <span>→</span>
          </Link>
          <Link href="/safety" className="text-amber-400 hover:underline flex items-center gap-1">
            <span>BMC Climbing Safety Statement</span>
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
