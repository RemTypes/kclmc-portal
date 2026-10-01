'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import MembershipCard from '@/components/MembershipCard';
import { findMemberByCardNumber, KclsuMemberRecord } from '@/lib/roster';
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
              href="https://www.kclsu.org/groups/activities/join/kclmc/"
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
              href="https://www.kclsu.org/groups/activities/join/kclmc/"
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
  const supabase = useMemo(() => createClient(), []);

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

  // Form states for safety notes
  const [phone, setPhone] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [dietary, setDietary] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function loadUserData() {
      try {
        if (!isSupabaseConfigured()) {
          setLoading(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setCurrentUser(null);
          setLoading(false);
          return;
        }

        setCurrentUser(user);

        // Fetch profile
        const { data: profData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profData) {
          setProfile(profData);
          setPhone(profData.phone || '');
          setEmergencyName(profData.emergency_contact_name || '');
          setEmergencyPhone(profData.emergency_contact_phone || '');
          setDietary(profData.dietary_requirements || '');

          let activeStudentId = profData.student_id;
          if (!activeStudentId) {
            const { data: linkedRoster } = await supabase
              .from('kclsu_roster')
              .select('card_number')
              .eq('user_id', user.id)
              .maybeSingle();
            if (linkedRoster) {
              activeStudentId = linkedRoster.card_number;
            }
          }

          if (activeStudentId) {
            const cleanId = activeStudentId.trim().toUpperCase();
            setBoundStudentId(cleanId);

            // Fetch official verified details for this user's bound student ID
            let matched: KclsuMemberRecord | null = null;
            const { data: rosterRow } = await supabase
              .from('kclsu_roster')
              .select('*')
              .eq('card_number', cleanId)
              .maybeSingle();

            if (rosterRow) {
              matched = {
                cardNumber: rosterRow.card_number,
                name: rosterRow.full_name,
                rawPurchaser: rosterRow.raw_purchaser || '',
                tier: rosterRow.tier,
                productName: rosterRow.product_name,
                transactionId: rosterRow.transaction_id,
                purchaseDate: rosterRow.purchase_date || '',
              };
            } else {
              matched = findMemberByCardNumber(cleanId) || null;
            }

            if (matched) {
              setSuRecord(matched);
              setMembership({
                id: matched.cardNumber,
                user_id: user.id,
                membership_number: matched.cardNumber,
                tier: matched.tier,
                valid_from: '2026-09-01',
                valid_until: '2027-08-31',
                payment_reference: matched.transactionId,
                is_active: true,
                created_at: new Date().toISOString(),
              });
            }
          }
        }
      } catch (err) {
        console.error('Error loading membership data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadUserData();
  }, [supabase]);

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
      const data = await res.json();

      if (!res.ok || !data.success) {
        setSearchError(data.error || 'Failed to link Student ID.');
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
      setSearchError(err.message || 'Network error linking Student ID.');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleUpdateSafetyNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      if (profile && isSupabaseConfigured()) {
        const { error } = await supabase
          .from('profiles')
          .update({
            phone,
            emergency_contact_name: emergencyName,
            emergency_contact_phone: emergencyPhone,
            dietary_requirements: dietary,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        if (!error) {
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        }
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#041F1E] text-[#F7F7F7] flex items-center justify-center font-mono">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-full border-2 border-[#FFBD59] border-t-transparent animate-spin"></div>
          <span>Loading membership pass...</span>
        </div>
      </div>
    );
  }

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
                  href="/register"
                  className="w-full sm:w-auto px-6 py-3 bg-[#041F1E] border border-[#FFBD59]/40 text-[#FFBD59] font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[#084746] transition-colors"
                >
                  Register New Account
                </Link>
              </div>
            </div>
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
              <a href="mailto:committee@kclmc.org" className="text-[#FFBD59] hover:underline">
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
                    href="https://www.kclsu.org/groups/activities/join/kclmc/"
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
              {suRecord && boundStudentId && (
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
            <div className="lg:col-span-6 bg-[#084746]/70 backdrop-blur-md border border-[#FFBD59]/30 rounded-3xl p-6 md:p-8 shadow-xl">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-black font-heading uppercase tracking-wide text-white">
                  Climber Safety &amp; Expedition Notes
                </h2>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  suRecord && boundStudentId
                    ? 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40' 
                    : 'text-[#FFBD59] bg-[#041F1E] border-[#FFBD59]/30'
                }`}>
                  {suRecord && boundStudentId ? 'Verified Member' : 'Pass Locked'}
                </span>
              </div>
              <p className="text-xs text-zinc-300 mb-6 font-sans leading-relaxed">
                Your name and student ID are permanently locked to your authenticated account. Below you can keep your emergency contact and medical details up to date for expedition leaders.
              </p>

              {saveSuccess && (
                <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-500/60 rounded-xl text-emerald-300 text-xs font-mono">
                  ✔ Emergency and safety notes saved successfully.
                </div>
              )}

              <form onSubmit={handleUpdateSafetyNotes} className="space-y-4 text-xs font-mono">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block uppercase text-zinc-400 mb-1 flex items-center justify-between">
                      <span>Full Name</span>
                      <span className="text-[10px] text-zinc-500 font-sans">Locked</span>
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
                      <span>KCL Student ID</span>
                      <span className="text-[10px] text-zinc-500 font-sans">Locked</span>
                    </label>
                    <input
                      type="text"
                      disabled
                      value={boundStudentId || ''}
                      placeholder="Link Student ID to unlock"
                      className="w-full bg-[#041F1E]/60 border border-zinc-700 rounded-xl p-3 text-[#FFBD59] cursor-not-allowed text-xs font-mono font-bold placeholder:text-zinc-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block uppercase text-zinc-300 mb-1 font-bold">
                    Climber Mobile Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+44 7000 000000"
                    className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl p-3 text-white focus:outline-none focus:border-[#FFBD59]"
                  />
                </div>

                <div className="pt-2 border-t border-[#FFBD59]/20">
                  <span className="block text-[11px] font-bold text-[#FFBD59] uppercase mb-3">
                    Emergency Contact (Required for Expeditions)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block uppercase text-zinc-300 mb-1">Contact Name</label>
                      <input
                        type="text"
                        value={emergencyName}
                        onChange={e => setEmergencyName(e.target.value)}
                        placeholder="e.g. Next of Kin / Parent"
                        className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl p-3 text-white focus:outline-none focus:border-[#FFBD59]"
                      />
                    </div>
                    <div>
                      <label className="block uppercase text-zinc-300 mb-1">Contact Phone</label>
                      <input
                        type="tel"
                        value={emergencyPhone}
                        onChange={e => setEmergencyPhone(e.target.value)}
                        placeholder="+44 7000 000000"
                        className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl p-3 text-white focus:outline-none focus:border-[#FFBD59]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block uppercase text-zinc-300 mb-1">
                    Dietary &amp; Medical Notes
                  </label>
                  <textarea
                    rows={2}
                    value={dietary}
                    onChange={e => setDietary(e.target.value)}
                    placeholder="e.g. Vegetarian, carrying EpiPen, asthma inhaler..."
                    className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl p-3 text-white focus:outline-none focus:border-[#FFBD59]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving || (!boundStudentId && !profile)}
                  className="w-full py-3 bg-[#FFBD59] text-[#052322] font-black rounded-xl hover:bg-[#FFE0A3] transition-colors font-mono uppercase tracking-wider disabled:opacity-50 text-xs shadow-lg"
                >
                  {saving 
                    ? 'Saving...' 
                    : (!boundStudentId && !profile) 
                      ? 'Link Student ID to Unlock Notes' 
                      : 'Update Emergency Details'}
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
