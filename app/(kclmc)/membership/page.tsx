'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MembershipCard from '@/components/MembershipCard';
import { findMemberByCardNumber, KclsuMemberRecord } from '@/lib/roster';
import { UNIVERSITIES, DEFAULT_UNIVERSITY, sanitizeUniversity } from '@/lib/auth';
import confetti from 'canvas-confetti';
import { checkSafetyProfileCompleteness } from '@/lib/safety';
import { generateBmcPrefilledUrl } from '@/lib/bmc_insurance';
import type { Profile, Membership } from '@/types/database';

function MembershipTierGuide() {
  return (
    <div className="bg-[#084746]/70 backdrop-blur-md border border-[#FFBD59]/30 rounded-3xl p-6 md:p-10 shadow-xl mb-12">
      <div className="max-w-3xl mb-8">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#FFBD59] bg-[#041F1E] px-2.5 py-1 rounded border border-[#FFBD59]/30">
          Official KCLMC Guide
        </span>
        <h2 className="text-3xl font-black font-heading uppercase tracking-tight text-white mt-3 mb-2">
          Social vs. Recreational Membership: What's the Difference?
        </h2>
        <p className="text-xs sm:text-sm text-zinc-300 font-sans leading-relaxed">
          We offer two distinct memberships through KCLSU. Choose the tier that matches your climbing goals, or start with Social and upgrade with a Top-Up later!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Social Membership Card */}
        <div className="bg-[#041F1E]/95 border-2 border-[#FFBD59]/40 rounded-2xl p-6 relative flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-bold font-heading uppercase tracking-wide text-[#FFBD59]">
                Social Membership
              </h3>
              <span className="text-xs font-mono uppercase bg-[#084746] text-[#FFBD59] px-2.5 py-1 rounded font-bold border border-[#FFBD59]/40">
                Bouldering &amp; Social
              </span>
            </div>
            <div className="text-2xl font-mono font-black text-white mb-3">
              £15 <span className="text-xs font-sans text-zinc-400 font-normal">/ year</span>
            </div>
            <p className="text-xs text-zinc-300 mb-6 leading-relaxed">
              Developed specifically for boulderers and brand-new climbers, as well as those not ready to commit to full expeditions yet but who want to be within the club's sphere of influence. If you'd like to boulder with KCLMC during official climbing sessions, this is the membership for you.
            </p>

            <h4 className="text-xs font-mono uppercase text-[#FFBD59] font-bold mb-3">
              Included Perks &amp; Benefits:
            </h4>
            <ul className="space-y-3 text-xs text-zinc-300">
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold text-sm">✔</span>
                <div>
                  <strong className="text-white">The KCLMC Discount (£9.50 Entry):</strong>
                  <p className="text-zinc-400 mt-0.5">
                    Discounted entry (£9.50) at London Climbing Centre (LCC) gyms on Mondays, Fridays, and off-peak hours. Includes free shoe hire (usually £4). <em>Pays for itself in just 3 visits!</em>
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold text-sm">✔</span>
                <div>
                  <strong className="text-white">Members' WhatsApp Group Chat:</strong>
                  <p className="text-zinc-400 mt-0.5">
                    Coordinated climbing sessions, advance notice on trip signups, and direct access to committee beta.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold text-sm">✔</span>
                <div>
                  <strong className="text-white">Discounts on Ticketed Socials:</strong>
                  <p className="text-zinc-400 mt-0.5">
                    Subsidized tickets for the annual KCLMC Winter Ball, Christmas Dinner, and social events.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold text-sm">✔</span>
                <div>
                  <strong className="text-white">Easy Upgrade Path:</strong>
                  <p className="text-zinc-400 mt-0.5">
                    Upgrade anytime to Full Membership by purchasing the Student Recreational Top-Up.
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <div>
            <a
              href="https://www.kclsu.org/groups/sports/join/mountaineerclimbsoc/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 w-full py-3 bg-[#FFBD59] text-[#052322] font-heading font-black text-sm uppercase tracking-wider rounded-xl text-center hover:bg-[#FFE0A3] transition-colors shadow-md block"
            >
              Join Social on KCLSU (£15) ↗
            </a>
            <div className="mt-4 pt-4 border-t border-[#FFBD59]/20 flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400">Best for: Boulderers &amp; New Climbers</span>
              <span className="text-[#FFBD59] font-bold">£15 / Year</span>
            </div>
          </div>
        </div>

        {/* Recreational Membership Card */}
        <div className="bg-[#041F1E]/95 border-2 border-emerald-500/50 rounded-2xl p-6 relative flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-bold font-heading uppercase tracking-wide text-emerald-400">
                Full Recreational Membership
              </h3>
              <span className="text-xs font-mono uppercase bg-emerald-950 text-emerald-300 px-2.5 py-1 rounded font-bold border border-emerald-500/40">
                Standard / Associate
              </span>
            </div>
            <div className="text-2xl font-mono font-black text-white mb-3">
              £45 <span className="text-xs font-sans text-zinc-400 font-normal">/ year</span>
            </div>
            <p className="text-xs text-zinc-300 mb-6 leading-relaxed">
              Our biggest offering yet and a must for those who want to get good at climbing and make the most of what KCLMC has to offer. Includes <strong>all perks of the Social Membership</strong>, plus:
            </p>

            <h4 className="text-xs font-mono uppercase text-emerald-400 font-bold mb-3">
              Exclusive Full Member Benefits:
            </h4>
            <ul className="space-y-3 text-xs text-zinc-300">
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold text-sm">✔</span>
                <div>
                  <strong className="text-white">Free Hire of £30,000+ Club Equipment:</strong>
                  <p className="text-zinc-400 mt-0.5">
                    Ropes, trad racks, harnesses, ice axes, bouldering pads, camping gear, and guidebooks regularly safety-checked. Climb safely on your own or with us without storing expensive kit.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold text-sm">✔</span>
                <div>
                  <strong className="text-white">Exclusive Worldwide Climbing Trips:</strong>
                  <p className="text-zinc-400 mt-0.5">
                    Intro days at Harrison's Rocks, trad in the Peak District, sport climbing in Portland &amp; Wales, and world-class sandstone bouldering in Fontainebleau, France.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold text-sm">✔</span>
                <div>
                  <strong className="text-white">Subsidised Training &amp; Guided Alpine Expeditions:</strong>
                  <p className="text-zinc-400 mt-0.5">
                    Join us in the French Alps for 3 weeks to learn multipitch sport climbing &amp; guided mountaineering (all guide fees covered by the club!), plus winter climbing in Scotland.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold text-sm">✔</span>
                <div>
                  <strong className="text-white">UK Mountain Hut &amp; Bunkhouse Access:</strong>
                  <p className="text-zinc-400 mt-0.5">
                    Stay at authentic mountaineering huts and bunkhouses across North Wales, the Lake District, and the Scottish Highlands on official club meets.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold text-sm">✔</span>
                <div>
                  <strong className="text-white">Weekly Comp Training &amp; Team Entry:</strong>
                  <p className="text-zinc-400 mt-0.5">
                    Weekly coaching clinics and free entry representing KCLMC in LUBE, BUCS, and university boulder leagues.
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <div>
            <a
              href="https://www.kclsu.org/groups/sports/join/mountaineerclimbsoc/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 w-full py-3 bg-emerald-500 text-slate-950 font-heading font-black text-sm uppercase tracking-wider rounded-xl text-center hover:bg-emerald-400 transition-colors shadow-md block"
            >
              Join Recreational on KCLSU (£45) ↗
            </a>
            <div className="mt-4 pt-4 border-t border-emerald-500/20 flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400">Best for: Active Climbers &amp; Mountaineers</span>
              <span className="text-emerald-400 font-bold">£45 / Year</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MembershipDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [suRecord, setSuRecord] = useState<KclsuMemberRecord | null>(null);
  const [boundStudentId, setBoundStudentId] = useState<string | null>(null);

  // Student ID linking state (for authenticated accounts not yet bound)
  const [inputStudentId, setInputStudentId] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Form states for profile & safety notes
  const [university, setUniversity] = useState<string>(DEFAULT_UNIVERSITY);
  const [customUniversity, setCustomUniversity] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [dietary, setDietary] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formError, setFormError] = useState('');
  const [safetyConsent, setSafetyConsent] = useState(true);

  const loadUserData = async () => {
    try {
      const res = await fetch('/api/membership', { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          setProfile(data.profile || null);
          setBoundStudentId(data.boundStudentId || null);
          setSuRecord(data.suRecord || null);
          setMembership(data.membership || null);

          // Update browser tab description dynamically
          if (typeof document !== 'undefined') {
            const memberName = data.membership?.memberName || data.user.fullName;
            document.title = memberName ? `${memberName} | Pass | KCLMC` : 'My Digital Pass | KCLMC';
          }

          if (data.profile) {
            setPhone(data.profile.phone || '');
            setEmergencyName(data.profile.emergency_contact_name || '');
            setEmergencyPhone(data.profile.emergency_contact_phone || '');
            setDietary(data.profile.dietary_requirements || '');

            if (data.profile.university) {
              if ((UNIVERSITIES as readonly string[]).includes(data.profile.university)) {
                setUniversity(data.profile.university);
                setCustomUniversity('');
              } else {
                setUniversity('Other UK Institution');
                setCustomUniversity(data.profile.university);
              }
            }
          }
          return;
        }
      }
      setCurrentUser(null);
    } catch (err) {
      console.error('Error loading membership data:', err);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  // Handle one-time student ID linking to authenticated account
  const handleLinkStudentId = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = inputStudentId.trim().toUpperCase();
    if (!cleanId) return;

    setLinkLoading(true);
    setSearchError('');

    try {
      const res = await fetch('/api/roster/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: cleanId }),
      });

      let data: any = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch (jsonErr) {
          console.warn('JSON parsing error in handleLinkStudentId:', jsonErr);
        }
      } else {
        const textBody = await res.text().catch(() => '');
        console.warn('Non-JSON response from /api/roster/link:', res.status, textBody);
      }

      if (!res.ok || !data?.success) {
        let errorMsg = data?.error;
        if (!errorMsg) {
          if (res.status === 401) {
            errorMsg = 'Please sign in to link your Student ID to your account.';
          } else if (res.status === 404) {
            errorMsg = `Student ID "${cleanId}" was not found in the official KCLSU purchase list.`;
          } else if (res.status === 409) {
            errorMsg = `Student ID "${cleanId}" is already linked to another account.`;
          } else {
            errorMsg = `Verification server returned status ${res.status}. Please try again or contact kclmc.committee@gmail.com.`;
          }
        }
        setSearchError(errorMsg);
        setLinkLoading(false);
        return;
      }

      const matched: KclsuMemberRecord = data.member;
      setSuRecord(matched);
      setBoundStudentId(matched.cardNumber);
      setMembership({
        id: matched.cardNumber,
        user_id: currentUser?.id || 'member',
        membership_number: matched.cardNumber,
        tier: matched.tier,
        valid_from: '2026-09-01',
        valid_until: '2027-08-31',
        payment_reference: matched.transactionId,
        is_active: true,
        created_at: new Date().toISOString(),
      });
      if (profile) {
        setProfile({
          ...profile,
          full_name: matched.name,
          student_id: matched.cardNumber,
        });
      }
    } catch (err: any) {
      console.error('Error linking student ID:', err);
      const rawMsg = String(err?.message || '');
      if (rawMsg.includes('pattern') || rawMsg.includes('SyntaxError') || rawMsg.includes('JSON')) {
        setSearchError('Connection error communicating with verification server. Please try again.');
      } else {
        setSearchError(rawMsg || 'Network error linking Student ID. Please try again.');
      }
    } finally {
      setLinkLoading(false);
    }
  };

  const profileSafetyCheck = checkSafetyProfileCompleteness(profile);
  const currentSafetyCheck = checkSafetyProfileCompleteness({
    phone,
    emergencyContact: emergencyName,
    emergencyPhone,
    dietaryNotes: dietary,
  });

  const handleUpdateSafetyNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!currentSafetyCheck.isComplete) {
      setFormError(`Please complete required safety fields: ${currentSafetyCheck.missingFields.join(', ')}`);
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          university,
          customUniversity,
          phone,
          emergencyName,
          emergencyPhone,
          dietary,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update safety notes');
      }

      const wasIncomplete = !profileSafetyCheck.isComplete;

      if (data.profile) {
        setProfile(data.profile);
      }
      setSaveSuccess(true);

      // Celebrate pass activation if newly unlocked
      if (wasIncomplete && currentSafetyCheck.isComplete) {
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch {
          // Confetti optional
        }
      }

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error updating safety notes:', err);
      setFormError(err?.message || 'Failed to update safety details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    setCurrentUser(null);
    setProfile(null);
    setSuRecord(null);
    setMembership(null);
    setBoundStudentId(null);
    setInputStudentId('');
    router.push('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#041F1E] text-[#F7F7F7] p-6 md:p-12 relative overflow-hidden font-sans topo-pattern">
      <div className="max-w-6xl mx-auto relative z-10">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b border-[#FFBD59]/20">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#084746] border border-[#FFBD59]/40 text-[#FFBD59] text-xs font-mono uppercase tracking-widest mb-3">
              {currentUser ? 'Official KCLMC Pass // Season 2026/27' : 'KCLSU Accredited Society // Season 2026/27'}
            </div>
            <h1 className="text-4xl md:text-5xl font-black font-heading uppercase tracking-tight text-[#FFBD59]">
              {currentUser ? 'Membership Portal' : 'Club Memberships & Passes'}
            </h1>
            <p className="text-zinc-300 text-sm mt-1">
              {currentUser
                ? 'Your verified climbing pass. Card tier and details are locked according to your authenticated account and official KCLSU purchase record.'
                : 'Compare official membership tiers, join via the KCLSU Student Union portal, and access your verified digital pass for London wall discounts and outdoor expeditions.'}
            </p>
          </div>
          {currentUser ? (
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-mono transition-colors self-start sm:self-auto"
            >
              Sign Out
            </button>
          ) : (
            <Link
              href="/login?next=/membership"
              className="px-5 py-2.5 rounded-lg bg-[#FFBD59] text-[#052322] font-bold hover:bg-[#FFE0A3] text-xs font-mono transition-colors self-start sm:self-auto shadow-md"
            >
              Sign In
            </Link>
          )}
        </div>

        {/* 1. Unauthenticated Visitor State */}
        {!currentUser && (
          <>
            <MembershipTierGuide />

            {loading ? (
              <div className="mb-12 p-8 bg-[#084746]/60 backdrop-blur-md border border-[#FFBD59]/20 rounded-3xl text-center max-w-xl mx-auto shadow-xl">
                <div className="w-8 h-8 rounded-full border-2 border-[#FFBD59] border-t-transparent animate-spin mx-auto mb-3"></div>
                <p className="text-xs font-mono text-zinc-300">Checking membership pass status...</p>
              </div>
            ) : (
              <div className="mb-12 p-8 md:p-12 bg-[#084746]/80 backdrop-blur-md border border-[#FFBD59]/30 rounded-3xl shadow-2xl text-center max-w-2xl mx-auto">
                <div className="w-16 h-16 rounded-full bg-[#FFBD59]/20 text-[#FFBD59] flex items-center justify-center mx-auto text-3xl mb-4 border border-[#FFBD59]/40">
                  🔒
                </div>
                <h2 className="text-2xl md:text-3xl font-black font-heading uppercase text-white tracking-wide mb-3">
                  Already Joined on KCLSU? Sign In to View Your Pass
                </h2>
                <p className="text-sm text-zinc-300 leading-relaxed mb-6 font-sans">
                  To protect student privacy and ensure safety compliance, KCLMC digital climbing passes are locked strictly to your authenticated account. Please sign in or register to display your verified membership card, gym concessions, and trip credentials.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center font-mono">
                  <Link
                    href="/login?next=/membership"
                    className="w-full sm:w-auto px-6 py-3 bg-[#FFBD59] text-[#052322] font-black text-xs uppercase tracking-wider rounded-xl hover:bg-[#FFE0A3] transition-colors shadow-lg"
                  >
                    Sign In to View Pass →
                  </Link>
                  <Link
                    href="/login?view=sign_up&next=/membership"
                    className="w-full sm:w-auto px-6 py-3 bg-[#041F1E] border border-[#FFBD59]/40 text-[#FFBD59] font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[#084746] transition-colors"
                  >
                    Register New Account
                  </Link>
                </div>
              </div>
            )}
          </>
        )}

        {/* 2. Authenticated: Already Bound to Account */}
        {currentUser && boundStudentId && (
          <div className="mb-8 p-6 bg-[#084746]/80 backdrop-blur-md border border-emerald-500/40 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center text-emerald-400 text-xl shrink-0">
                🔒
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                    Pass Bound to Your Account
                  </span>
                  <span className="bg-emerald-950 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-500/30">
                    VERIFIED
                  </span>
                </div>
                <p className="text-sm font-bold text-white mt-0.5">
                  KCL Student ID: <span className="font-mono text-[#FFBD59] tracking-wider">{boundStudentId}</span>
                  {suRecord?.name ? ` • ${suRecord.name}` : ''}
                </p>
                <p className="text-xs text-zinc-300 mt-0.5">
                  This climbing pass is permanently locked to your authenticated account ({currentUser.email}).
                </p>
              </div>
            </div>
            <div className="text-xs font-mono text-zinc-400 text-left md:text-right shrink-0">
              <span className="block text-zinc-400">Need to update or re-link?</span>
              <a href="mailto:kclmc.committee@gmail.com" className="text-[#FFBD59] hover:underline">
                Contact Committee →
              </a>
            </div>
          </div>
        )}

        {/* 3. Authenticated: Not Yet Bound (One-time link) */}
        {currentUser && !boundStudentId && (
          <div className="mb-8 p-6 md:p-8 bg-[#084746]/80 backdrop-blur-md border border-[#FFBD59]/30 rounded-3xl shadow-xl">
            <div className="max-w-2xl">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#FFBD59] bg-[#041F1E] px-2.5 py-1 rounded border border-[#FFBD59]/30">
                Account Verification
              </span>
              <h2 className="text-2xl font-black font-heading uppercase text-white mt-2 mb-1">
                Link Your KCL Student ID
              </h2>
              <p className="text-xs text-zinc-300 mb-6 font-sans leading-relaxed">
                Enter your 8-digit King's Student ID (e.g. <span className="font-mono text-[#FFBD59]">K25008223</span>) from your official KCLSU membership purchase. Once verified, your membership pass will be permanently bound to your account (<span className="text-white font-mono">{currentUser.email}</span>).
              </p>

              <form onSubmit={handleLinkStudentId} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  required
                  value={inputStudentId}
                  onChange={e => {
                    setInputStudentId(e.target.value.toUpperCase());
                    setSearchError('');
                  }}
                  placeholder="e.g. K25008223"
                  className="bg-[#041F1E] border border-[#FFBD59]/40 rounded-xl px-4 py-3 text-white font-mono text-sm tracking-wider uppercase focus:outline-none focus:border-[#FFBD59] flex-1"
                />
                <button
                  type="submit"
                  disabled={linkLoading}
                  className="px-6 py-3 bg-[#FFBD59] text-[#052322] font-mono font-bold text-xs uppercase rounded-xl hover:bg-[#FFE0A3] transition-colors shrink-0 shadow disabled:opacity-50"
                >
                  {linkLoading ? 'Verifying...' : 'Link to Account'}
                </button>
              </form>

              {searchError && (
                <div className="mt-4 p-4 bg-red-950/80 border border-red-500/60 rounded-xl text-red-300 text-xs font-mono flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <span>✖ {searchError}</span>
                  <a
                    href="https://www.kclsu.org/groups/sports/join/mountaineerclimbsoc/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-[#FFBD59] hover:text-white shrink-0"
                  >
                    Purchase on KCLSU Shop →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Member Card & Safety Profile (Rendered for Authenticated Users) */}
        {currentUser && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
            {/* Left Column: Official Card */}
            <div className="lg:col-span-6 space-y-6">
              {suRecord && boundStudentId ? (
                profileSafetyCheck.isComplete ? (
                  <>
                    <MembershipCard
                    profile={{
                      full_name: suRecord.name,
                      student_id: suRecord.cardNumber,
                      avatar_url: profile?.avatar_url || null,
                    }}
                    membership={{
                      id: suRecord.cardNumber,
                      membership_number: suRecord.cardNumber,
                      tier: suRecord.tier,
                      valid_from: '2026-09-01',
                      valid_until: '2027-08-31',
                      is_active: true,
                      payment_reference: suRecord.transactionId,
                    }}
                  />

                  {/* BMC Insurance Status Badge (Recreational Tier Only) */}
                  {suRecord.tier.toLowerCase().includes('recreational') && (
                    <div
                      className={`mt-6 rounded-2xl p-4 border transition-colors ${
                        (profile as any)?.bmc_insured
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                          : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">
                            {(profile as any)?.bmc_insured ? '🛡️' : '⚠️'}
                          </span>
                          <div>
                            <p className="text-xs font-mono font-bold">
                              {(profile as any)?.bmc_insured
                                ? 'BMC Insurance Verified (2026/27)'
                                : 'BMC Insurance Registration Pending'}
                            </p>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {(profile as any)?.bmc_insured
                                ? 'Official BMC combined liability and personal accident coverage active.'
                                : 'Recreational members must submit the BMC insurance form before outdoor trips.'}
                            </p>
                          </div>
                        </div>

                        {!(profile as any)?.bmc_insured && (
                          <a
                            href={generateBmcPrefilledUrl({
                              firstName: suRecord.name.split(' ')[0] || '',
                              lastName: suRecord.name.split(' ').slice(1).join(' ') || '',
                              membershipType: 'Student',
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-[#FFBD59] hover:bg-white text-[#041F1E] font-heading font-black text-xs uppercase tracking-wider rounded-xl transition-colors shadow-sm text-center shrink-0"
                          >
                            Complete Form ↗
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </>
                ) : (
                  <div className="bg-[#084746]/80 border-2 border-amber-500/50 rounded-3xl p-8 shadow-2xl space-y-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-950/80 border border-amber-500/50 flex items-center justify-center text-amber-400 text-2xl shrink-0">
                        🛡️
                      </div>
                      <span className="bg-amber-950/90 text-amber-300 border border-amber-500/40 text-[10px] font-mono px-2.5 py-1 rounded-full uppercase tracking-wider font-bold">
                        Safety Activation Required
                      </span>
                    </div>

                    <div>
                      <h3 className="text-2xl font-black font-heading uppercase tracking-tight text-white">
                        Climbing Pass Inactive
                      </h3>
                      <p className="text-xs text-zinc-300 leading-relaxed font-sans mt-1">
                        Under British Mountaineering Council (BMC) guidelines and club duty of care, your digital climbing pass is locked until your safety contact details are recorded.
                      </p>
                    </div>

                    <div className="bg-[#041F1E] border border-[#084746] rounded-2xl p-4 font-mono text-xs space-y-2.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400">1. KCLSU Purchase Roster:</span>
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <span>✔</span> Linked ({boundStudentId})
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400">2. Climber Mobile Phone:</span>
                        <span className={profileSafetyCheck.hasPhone ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                          {profileSafetyCheck.hasPhone ? '✔ Recorded' : '⏳ Action Required'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400">3. Emergency Contact (Next of Kin):</span>
                        <span className={profileSafetyCheck.hasEmergencyContact && profileSafetyCheck.hasEmergencyPhone ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                          {profileSafetyCheck.hasEmergencyContact && profileSafetyCheck.hasEmergencyPhone ? '✔ Recorded' : '⏳ Action Required'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] font-mono text-[#FFBD59] bg-[#041F1E]/80 border border-[#FFBD59]/30 rounded-xl p-3">
                      👉 Please complete your mobile phone and emergency contact in the form on the right and click <strong>&quot;Save Details &amp; Activate Pass&quot;</strong> to unlock your climbing card.
                    </p>
                  </div>
                )
              ) : (
                <div className="bg-[#084746]/60 border-2 border-dashed border-[#FFBD59]/40 rounded-3xl p-8 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-[#FFBD59]/20 text-[#FFBD59] flex items-center justify-center mx-auto text-2xl">
                    🔒
                  </div>
                  <h3 className="text-xl font-bold font-heading uppercase tracking-wide text-white">Pass Locked</h3>
                  <p className="text-xs text-zinc-300 leading-relaxed max-w-sm mx-auto">
                    Link your KCL Student ID above to unlock and bind your official 2026/27 KCLMC climbing pass.
                  </p>
                </div>
              )}

              {/* KCLSU Purchase Verification Receipt */}
              {suRecord && boundStudentId && profileSafetyCheck.isComplete && (
                <div className="bg-[#084746]/60 border border-[#FFBD59]/30 rounded-2xl p-6 font-mono text-xs shadow-lg">
                  <div className="flex items-center justify-between border-b border-[#FFBD59]/20 pb-3 mb-3">
                    <span className="text-[#FFBD59] font-bold uppercase tracking-wider">
                      Official SU Purchase Details
                    </span>
                    <span className="text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/40 text-[10px]">
                      VERIFIED
                    </span>
                  </div>
                  <div className="space-y-2 text-zinc-300 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-zinc-500 uppercase">Product:</span>
                      <span className="text-white font-bold">{suRecord.productName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 uppercase">Member:</span>
                      <span className="text-white">{suRecord.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 uppercase">KCL Card Number:</span>
                      <span className="text-[#FFBD59] font-bold">{suRecord.cardNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 uppercase">Transaction ID:</span>
                      <span className="text-white">{suRecord.transactionId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 uppercase">Date of Purchase:</span>
                      <span className="text-zinc-400">{suRecord.purchaseDate}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Climber Safety Profile */}
            <div id="safety-form" className="lg:col-span-6 bg-[#084746]/70 backdrop-blur-md border border-[#FFBD59]/30 rounded-3xl p-6 md:p-8 shadow-xl">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-black font-heading uppercase tracking-wide text-white">
                  Climber Safety &amp; Expedition Notes
                </h2>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  profileSafetyCheck.isComplete
                    ? 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40' 
                    : boundStudentId
                    ? 'text-amber-400 bg-amber-950/60 border-amber-500/40'
                    : 'text-[#FFBD59] bg-[#041F1E] border-[#FFBD59]/30'
                }`}>
                  {profileSafetyCheck.isComplete 
                    ? '✔ Pass Active' 
                    : boundStudentId 
                    ? '⏳ Safety Required' 
                    : 'Pass Locked'}
                </span>
              </div>
              <p className="text-xs text-zinc-300 mb-6 font-sans leading-relaxed">
                Your name and student ID are verified from KCLSU. Provide your mobile number and emergency contact below to activate your digital climbing pass.
              </p>

              {saveSuccess && (
                <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-500/60 rounded-xl text-emerald-300 text-xs font-mono">
                  ✔ Safety profile saved and climbing pass activated successfully!
                </div>
              )}

              {formError && (
                <div className="mb-4 p-3 bg-red-950/80 border border-red-500/60 rounded-xl text-red-300 text-xs font-mono">
                  ✖ {formError}
                </div>
              )}

              <form onSubmit={handleUpdateSafetyNotes} className="space-y-4 text-xs font-mono">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block uppercase text-zinc-400 mb-1 flex items-center justify-between">
                      <span>Full Name</span>
                      <span className="text-[10px] text-zinc-500 font-sans">
                        {boundStudentId ? 'Verified from SU' : 'Account Name'}
                      </span>
                    </label>
                    <input
                      type="text"
                      disabled
                      value={suRecord?.name || profile?.full_name || ''}
                      placeholder="Link Student ID to unlock"
                      className="w-full bg-[#041F1E]/60 border border-zinc-700 rounded-xl p-3 text-zinc-300 cursor-not-allowed text-xs font-semibold placeholder:text-zinc-600"
                    />
                  </div>
                  <div>
                    <label className="block uppercase text-zinc-400 mb-1 flex items-center justify-between">
                      <span>Student ID Number</span>
                      <span className="text-[10px] text-zinc-500 font-sans">
                        {boundStudentId ? 'Verified' : 'Optional for Guests'}
                      </span>
                    </label>
                    <input
                      type="text"
                      disabled={!!boundStudentId}
                      value={boundStudentId || profile?.student_id || ''}
                      placeholder="Not linked"
                      className="w-full bg-[#041F1E]/60 border border-zinc-700 rounded-xl p-3 text-[#FFBD59] cursor-not-allowed text-xs font-mono font-bold placeholder:text-zinc-600"
                    />
                  </div>
                </div>

                {/* University & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block uppercase text-zinc-300 mb-1 font-bold">
                      University / Affiliation
                    </label>
                    <select
                      value={university}
                      onChange={e => setUniversity(e.target.value)}
                      className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl p-3 text-white focus:outline-none focus:border-[#FFBD59] text-xs font-semibold cursor-pointer"
                    >
                      {UNIVERSITIES.map(u => (
                        <option key={u} value={u} className="bg-[#041F1E] text-white">
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  {university === 'Other UK Institution' ? (
                    <div>
                      <label className="block uppercase text-zinc-300 mb-1 font-bold">
                        Institution Name
                      </label>
                      <input
                        type="text"
                        value={customUniversity}
                        onChange={e => setCustomUniversity(e.target.value)}
                        placeholder="e.g. University of Cambridge"
                        className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl p-3 text-white focus:outline-none focus:border-[#FFBD59] text-xs font-semibold"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block uppercase text-zinc-300 mb-1 font-bold flex items-center justify-between">
                        <span>Climber Mobile Phone</span>
                        <span className="text-[10px] text-amber-400 font-sans font-normal bg-[#041F1E] px-2 py-0.5 rounded border border-amber-500/30">
                          * Required
                        </span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={e => {
                          setPhone(e.target.value);
                          setFormError('');
                        }}
                        placeholder="e.g. +44 7123 456789 or 07123..."
                        className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl p-3 text-white focus:outline-none focus:border-[#FFBD59] text-xs font-mono"
                      />
                    </div>
                  )}
                </div>

                {university === 'Other UK Institution' && (
                  <div>
                    <label className="block uppercase text-zinc-300 mb-1 font-bold flex items-center justify-between">
                      <span>Climber Mobile Phone</span>
                      <span className="text-[10px] text-amber-400 font-sans font-normal bg-[#041F1E] px-2 py-0.5 rounded border border-amber-500/30">
                        * Required
                      </span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={e => {
                        setPhone(e.target.value);
                        setFormError('');
                      }}
                      placeholder="e.g. +44 7123 456789 or 07123..."
                      className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl p-3 text-white focus:outline-none focus:border-[#FFBD59] text-xs font-mono"
                    />
                  </div>
                )}

                <div className="pt-2 border-t border-[#FFBD59]/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-[#FFBD59] uppercase">
                      Emergency Contact (Next of Kin)
                    </span>
                    <span className="text-[10px] text-amber-400 font-sans bg-[#041F1E] px-2 py-0.5 rounded border border-amber-500/30">
                      * Required
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block uppercase text-zinc-300 mb-1">Contact Name</label>
                      <input
                        type="text"
                        required
                        value={emergencyName}
                        onChange={e => {
                          setEmergencyName(e.target.value);
                          setFormError('');
                        }}
                        placeholder="e.g. Sarah Smith (Parent/Next of Kin)"
                        className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl p-3 text-white focus:outline-none focus:border-[#FFBD59]"
                      />
                    </div>
                    <div>
                      <label className="block uppercase text-zinc-300 mb-1">Contact Phone</label>
                      <input
                        type="tel"
                        required
                        value={emergencyPhone}
                        onChange={e => {
                          setEmergencyPhone(e.target.value);
                          setFormError('');
                        }}
                        placeholder="e.g. +44 7987 654321"
                        className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl p-3 text-white focus:outline-none focus:border-[#FFBD59] font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block uppercase text-zinc-300 mb-1 flex items-center justify-between">
                    <span>Dietary &amp; Medical Notes</span>
                    <span className="text-[10px] text-zinc-400 font-sans">
                      (Optional // UK GDPR Art. 9)
                    </span>
                  </label>
                  <textarea
                    rows={2}
                    value={dietary}
                    onChange={e => setDietary(e.target.value)}
                    placeholder="e.g. Vegetarian, carrying EpiPen, asthma inhaler..."
                    className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl p-3 text-white focus:outline-none focus:border-[#FFBD59]"
                  />
                  <span className="text-[10px] text-zinc-400 font-sans mt-1 block">
                    Voluntary disclosure for residential bunkhouses and outdoor mountain meets.
                  </span>
                </div>

                <div className="p-3 bg-[#041F1E] border border-[#084746] rounded-xl">
                  <label className="flex items-start gap-2.5 cursor-pointer text-zinc-300 hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      checked={safetyConsent}
                      onChange={e => setSafetyConsent(e.target.checked)}
                      className="mt-0.5 rounded border-[#FFBD59]/40 bg-[#052322] text-[#FFBD59] focus:ring-0 cursor-pointer"
                    />
                    <span className="text-[11px] leading-relaxed font-sans">
                      <strong className="text-white">Club Safety Notices:</strong> I acknowledge that the KCLMC committee may contact me or my emergency contact regarding club climbing sessions, trips, and emergency incidents.
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={saving || !profile}
                  className="w-full py-3 bg-[#FFBD59] text-[#052322] font-black rounded-xl hover:bg-[#FFE0A3] transition-colors font-mono uppercase tracking-wider disabled:opacity-50 text-xs shadow-lg cursor-pointer"
                >
                  {saving 
                    ? 'Saving Details...' 
                    : !profile 
                      ? 'Loading Profile...' 
                      : profileSafetyCheck.isComplete
                        ? 'Update Profile & Safety Details'
                        : 'Save Details & Activate Climbing Pass →'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Membership Tier Guide: Social vs Recreational */}
        {currentUser && <MembershipTierGuide />}
      </div>
    </div>
  );
}
