'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import MembershipCard from '@/components/MembershipCard';
import { findMemberByCardNumber, KclsuMemberRecord } from '@/lib/roster';
import type { Profile, Membership } from '@/types/database';

export default function MembershipDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [suRecord, setSuRecord] = useState<KclsuMemberRecord | null>(null);

  // Student ID search / linking state
  const [inputStudentId, setInputStudentId] = useState('');
  const [searchError, setSearchError] = useState('');

  // Form states for safety notes
  const [phone, setPhone] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [dietary, setDietary] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Helper to load member by card_number
  const applyStudentId = async (idToLookup: string, currentProfile?: Profile | null) => {
    const cleanId = idToLookup.trim().toUpperCase();
    if (!cleanId) return;

    let matched: KclsuMemberRecord | undefined | null = null;

    if (isSupabaseConfigured()) {
      try {
        const { data } = await supabase
          .from('kclsu_roster')
          .select('*')
          .eq('card_number', cleanId)
          .maybeSingle();

        if (data) {
          matched = {
            cardNumber: data.card_number,
            name: data.full_name,
            rawPurchaser: data.raw_purchaser,
            tier: data.tier,
            productName: data.product_name,
            transactionId: data.transaction_id,
            purchaseDate: data.purchase_date || '',
          };

          const activeProf = currentProfile || profile;
          if (activeProf && activeProf.id !== 'demo-user') {
            await supabase
              .from('kclsu_roster')
              .update({ user_id: activeProf.id, updated_at: new Date().toISOString() })
              .eq('card_number', cleanId);
            await supabase
              .from('profiles')
              .update({ student_id: cleanId, full_name: matched.name })
              .eq('id', activeProf.id);
          }
        }
      } catch (err) {
        console.error('Error querying Supabase roster:', err);
      }
    }

    if (!matched) {
      matched = findMemberByCardNumber(cleanId);
    }

    if (matched) {
      setSuRecord(matched);
      setSearchError('');
      setMembership({
        id: matched.cardNumber,
        user_id: profile?.id || 'guest',
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
    } else {
      setSearchError(`Student ID "${cleanId}" was not found in the official KCLSU purchase list.`);
      setSuRecord(null);
    }
  };

  useEffect(() => {
    async function loadUserData() {
      try {
        if (!isSupabaseConfigured()) {
          // Default initial load: Demo with Remy Preston from the official SU list
          const defaultRecord = findMemberByCardNumber('K25008223');
          if (defaultRecord) {
            setSuRecord(defaultRecord);
            setInputStudentId(defaultRecord.cardNumber);
            setProfile({
              id: 'demo-user',
              full_name: defaultRecord.name,
              student_id: defaultRecord.cardNumber,
              university: 'King\'s College London',
              phone: '+44 7700 900123',
              emergency_contact_name: 'Parent / Emergency Contact',
              emergency_contact_phone: '+44 7700 900456',
              dietary_requirements: 'None',
              medical_notes: null,
              role: 0,
              avatar_url: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            setMembership({
              id: defaultRecord.cardNumber,
              user_id: 'demo-user',
              membership_number: defaultRecord.cardNumber,
              tier: defaultRecord.tier,
              valid_from: '2026-09-01',
              valid_until: '2027-08-31',
              payment_reference: defaultRecord.transactionId,
              is_active: true,
              created_at: new Date().toISOString(),
            });
          }
          setLoading(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login?next=/membership');
          return;
        }

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
            setInputStudentId(activeStudentId);
            await applyStudentId(activeStudentId, profData);
          }
        }
      } catch (err) {
        console.error('Error loading membership data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadUserData();
  }, [router, supabase]);

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyStudentId(inputStudentId);
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
              Official KCLMC Pass // Season 2026/27
            </div>
            <h1 className="text-4xl md:text-5xl font-black font-serif text-[#FFBD59]">
              Membership Portal
            </h1>
            <p className="text-zinc-300 text-sm mt-1">
              Your verified climbing pass. Card tier and details are locked according to your official KCLSU purchase record.
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-mono transition-colors self-start sm:self-auto"
          >
            Sign Out
          </button>
        </div>

        {/* Student ID Lookup & Verification Bar */}
        <div className="mb-8 p-6 bg-[#084746]/80 backdrop-blur-md border border-[#FFBD59]/30 rounded-3xl shadow-xl">
          <form onSubmit={handleLookupSubmit} className="flex flex-col md:flex-row items-center gap-4 justify-between">
            <div className="flex-1 w-full">
              <label className="block text-xs font-mono uppercase text-[#FFBD59] font-bold mb-1">
                KCL Student ID Number (Card Number)
              </label>
              <p className="text-xs text-zinc-300">
                Enter your 8-digit K-number to load and lock your verified KCLSU pass.
              </p>
            </div>
            <div className="flex w-full md:w-auto gap-2">
              <input
                type="text"
                required
                value={inputStudentId}
                onChange={e => setInputStudentId(e.target.value.toUpperCase())}
                placeholder="e.g. K25008223"
                className="bg-[#041F1E] border border-[#FFBD59]/40 rounded-xl px-4 py-2.5 text-white font-mono text-sm tracking-wider uppercase focus:outline-none focus:border-[#FFBD59] w-full md:w-56"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#FFBD59] text-[#052322] font-mono font-bold text-xs uppercase rounded-xl hover:bg-[#FFE0A3] transition-colors shrink-0 shadow"
              >
                Verify ID
              </button>
            </div>
          </form>

          {searchError && (
            <div className="mt-4 p-4 bg-red-950/80 border border-red-500/60 rounded-xl text-red-300 text-xs font-mono flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <span>✖ {searchError}</span>
              <a
                href="https://www.kclsu.org/groups/activities/join/kclmc/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-[#FFBD59] hover:text-white"
              >
                Purchase on KCLSU Shop →
              </a>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
          {/* Left Column: Official Card */}
          <div className="lg:col-span-6 space-y-6">
            {suRecord ? (
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
                <h3 className="text-xl font-bold font-serif text-white">Pass Locked</h3>
                <p className="text-xs text-zinc-300 leading-relaxed max-w-sm mx-auto">
                  Please enter a valid KCL Student ID that holds a 2026/27 KCLSU Mountaineering &amp; Climbing Club purchase to unlock your card.
                </p>
              </div>
            )}

            {/* KCLSU Purchase Verification Receipt */}
            {suRecord && (
              <div className="bg-[#084746]/60 border border-[#FFBD59]/30 rounded-2xl p-6 font-mono text-xs">
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

          {/* Right Column: Locked Climber Safety Profile */}
          <div className="lg:col-span-6 bg-[#084746]/70 backdrop-blur-md border border-[#FFBD59]/30 rounded-3xl p-6 md:p-8 shadow-xl">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-2xl font-black font-serif text-white">
                Climber Safety &amp; Expedition Notes
              </h2>
              <span className="text-[10px] font-mono text-[#FFBD59] bg-[#041F1E] px-2 py-0.5 rounded border border-[#FFBD59]/30">
                Card Locked
              </span>
            </div>
            <p className="text-xs text-zinc-300 mb-6 font-sans leading-relaxed">
              Your name and student ID are permanently locked to your KCLSU verification. Below you can keep your emergency contact and medical details up to date for expedition leaders.
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
                    value={suRecord?.name || profile?.full_name || 'KCL Climber'}
                    className="w-full bg-[#041F1E]/60 border border-zinc-700 rounded-xl p-3 text-zinc-300 cursor-not-allowed text-xs font-semibold"
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
                    value={suRecord?.cardNumber || profile?.student_id || 'K-STUDENT'}
                    className="w-full bg-[#041F1E]/60 border border-zinc-700 rounded-xl p-3 text-[#FFBD59] cursor-not-allowed text-xs font-mono font-bold"
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
                  placeholder="+44 7123 456789"
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
                      placeholder="e.g. Sarah Honnold (Parent)"
                      className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl p-3 text-white focus:outline-none focus:border-[#FFBD59]"
                    />
                  </div>
                  <div>
                    <label className="block uppercase text-zinc-300 mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      value={emergencyPhone}
                      onChange={e => setEmergencyPhone(e.target.value)}
                      placeholder="+44 7987 654321"
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
                disabled={saving}
                className="w-full py-3 bg-[#FFBD59] text-[#052322] font-black rounded-xl hover:bg-[#FFE0A3] transition-colors font-mono uppercase tracking-wider disabled:opacity-50 text-xs shadow-lg"
              >
                {saving ? 'Saving...' : 'Update Emergency Details'}
              </button>
            </form>
          </div>
        </div>

        {/* Membership Tier Guide: Social vs Recreational */}
        <div className="bg-[#084746]/70 backdrop-blur-md border border-[#FFBD59]/30 rounded-3xl p-6 md:p-10 shadow-xl">
          <div className="max-w-3xl mb-8">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#FFBD59] bg-[#041F1E] px-2.5 py-1 rounded border border-[#FFBD59]/30">
              Official KCLMC Guide
            </span>
            <h2 className="text-3xl font-black font-serif text-white mt-3 mb-2">
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
                  <h3 className="text-xl font-bold font-serif text-[#FFBD59]">
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

              <div className="mt-8 pt-4 border-t border-[#FFBD59]/20 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">Best for: Boulderers &amp; New Climbers</span>
                <span className="text-[#FFBD59] font-bold">£15 / Year</span>
              </div>
            </div>

            {/* Recreational Membership Card */}
            <div className="bg-[#041F1E]/95 border-2 border-emerald-500/50 rounded-2xl p-6 relative flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xl font-bold font-serif text-emerald-400">
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
                      <strong className="text-white">BMC Membership Included:</strong>
                      <p className="text-zinc-400 mt-0.5">
                        Annual British Mountaineering Council membership with discounted rescue insurance, training courses, and alpine hut access. (We'll help get existing BMC dues refunded).
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

              <div className="mt-8 pt-4 border-t border-emerald-500/20 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">Best for: Active Climbers &amp; Mountaineers</span>
                <span className="text-emerald-400 font-bold">£45 / Year</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
