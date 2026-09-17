'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabaseMock } from '@/lib/supabase';

interface BoulderProblem {
  id: number;
  grade: string;
  color: string;
  colorHex: string;
  zonePoints: number;
  topPoints: number;
  flashPoints: number;
}

const PROBLEMS: BoulderProblem[] = [
  { id: 1, grade: 'V1', color: 'White', colorHex: '#F5F5F0', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 2, grade: 'V1', color: 'White', colorHex: '#F5F5F0', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 3, grade: 'V2', color: 'White', colorHex: '#F5F5F0', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 4, grade: 'V2', color: 'Yellow', colorHex: '#EAB308', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 5, grade: 'V2+', color: 'Yellow', colorHex: '#EAB308', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 6, grade: 'V3', color: 'Yellow', colorHex: '#EAB308', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 7, grade: 'V3', color: 'Green', colorHex: '#22C55E', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 8, grade: 'V3+', color: 'Green', colorHex: '#22C55E', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 9, grade: 'V4', color: 'Green', colorHex: '#22C55E', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 10, grade: 'V4', color: 'Blue', colorHex: '#3B82F6', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 11, grade: 'V4+', color: 'Blue', colorHex: '#3B82F6', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 12, grade: 'V5', color: 'Blue', colorHex: '#3B82F6', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 13, grade: 'V5', color: 'Red', colorHex: '#EF4444', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 14, grade: 'V5+', color: 'Red', colorHex: '#EF4444', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 15, grade: 'V6', color: 'Red', colorHex: '#EF4444', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 16, grade: 'V6', color: 'Purple', colorHex: '#A855F7', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 17, grade: 'V6+', color: 'Purple', colorHex: '#A855F7', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 18, grade: 'V7', color: 'Purple', colorHex: '#A855F7', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 19, grade: 'V7', color: 'Black', colorHex: '#52525B', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 20, grade: 'V7+', color: 'Black', colorHex: '#52525B', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 21, grade: 'V8', color: 'Black', colorHex: '#52525B', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 22, grade: 'V8', color: 'Chalk White', colorHex: '#FAFAFA', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 23, grade: 'V8+', color: 'Chalk White', colorHex: '#FAFAFA', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 24, grade: 'V9', color: 'Chalk White', colorHex: '#FAFAFA', zonePoints: 3, topPoints: 7, flashPoints: 10 },
  { id: 25, grade: 'V9+', color: 'Fluo Pink', colorHex: '#EC4899', zonePoints: 3, topPoints: 7, flashPoints: 10 },
];

type ProblemStatus = 'UNATTEMPTED' | 'ZONE' | 'TOP' | 'FLASH';

interface ProblemState {
  status: ProblemStatus;
  attempts: number;
}

export default function LubeScoringPage() {
  const [climberName, setClimberName] = useState('');
  const [university, setUniversity] = useState('King\'s College London');
  const [category, setCategory] = useState<'Men' | 'Women' | 'Non-Binary/Open'>('Men');
  const [round, setRound] = useState('Round 3: VauxWall');
  const [scores, setScores] = useState<Record<number, ProblemState>>({});
  const [savedNotice, setSavedNotice] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');

  // Load from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lube_scoring_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.scores) setScores(parsed.scores);
        if (parsed.climberName) setClimberName(parsed.climberName);
        if (parsed.university) setUniversity(parsed.university);
        if (parsed.category) setCategory(parsed.category);
        if (parsed.unlocked) setUnlocked(true);
      }
    } catch {}
  }, []);

  const saveToLocal = (newScores: Record<number, ProblemState>) => {
    try {
      localStorage.setItem('lube_scoring_v1', JSON.stringify({
        climberName,
        university,
        category,
        scores: newScores,
        unlocked,
        updatedAt: Date.now()
      }));
    } catch {}
  };

  const handleStatusChange = (id: number, status: ProblemStatus) => {
    setScores(prev => {
      const current = prev[id] || { status: 'UNATTEMPTED', attempts: 1 };
      let newAttempts = current.attempts;
      if (status === 'FLASH') newAttempts = 1;
      else if (status === 'TOP' && current.attempts === 1 && current.status === 'FLASH') newAttempts = 2;
      else if (newAttempts === 0) newAttempts = 1;

      const updated = {
        ...prev,
        [id]: { status, attempts: newAttempts }
      };
      saveToLocal(updated);
      return updated;
    });
  };

  const handleAttempts = (id: number, delta: number) => {
    setScores(prev => {
      const current = prev[id] || { status: 'UNATTEMPTED', attempts: 1 };
      const newAttempts = Math.max(1, current.attempts + delta);
      // If was Flash but attempts > 1, downgrade to TOP
      let newStatus = current.status;
      if (newAttempts > 1 && newStatus === 'FLASH') newStatus = 'TOP';
      const updated = {
        ...prev,
        [id]: { ...current, attempts: newAttempts, status: newStatus }
      };
      saveToLocal(updated);
      return updated;
    });
  };

  // Stats calculation
  let totalScore = 0;
  let totalTops = 0;
  let totalFlashes = 0;
  let totalZones = 0;
  let totalAttemptsToTop = 0;

  PROBLEMS.forEach(p => {
    const s = scores[p.id];
    if (!s) return;
    if (s.status === 'FLASH') {
      totalScore += p.flashPoints;
      totalTops += 1;
      totalFlashes += 1;
      totalZones += 1;
      totalAttemptsToTop += 1;
    } else if (s.status === 'TOP') {
      totalScore += p.topPoints;
      totalTops += 1;
      totalZones += 1;
      totalAttemptsToTop += s.attempts;
    } else if (s.status === 'ZONE') {
      totalScore += p.zonePoints;
      totalZones += 1;
    }
  });

  const handleManualSave = () => {
    saveToLocal(scores);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmitScorecard = async () => {
    if (!climberName) return alert('Please enter your Climber Name before submitting.');
    setIsSubmitting(true);
    
    // In a real app we'd do an upsert by matching name/round, or store a submission ID.
    // For now, just insert a new pending record.
    await supabaseMock.from('scorecards').insert({
      climberName,
      university,
      category,
      round,
      totalScore,
      tops: totalTops,
      zones: totalZones,
      attempts: totalAttemptsToTop,
      status: 'PENDING',
      submittedAt: Date.now()
    });

    setIsSubmitting(false);
    alert('Official scorecard submitted! It is now PENDING review by the judges.');
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError('');
    const { data } = await supabaseMock.from('access_codes').select();
    const isValid = data?.some((codeObj: any) => codeObj.code === codeInput.toUpperCase());
    
    if (isValid) {
      setUnlocked(true);
      // Immediately save unlocked state so it persists on reload
      try {
        const saved = localStorage.getItem('lube_scoring_v1');
        const parsed = saved ? JSON.parse(saved) : {};
        localStorage.setItem('lube_scoring_v1', JSON.stringify({ ...parsed, unlocked: true }));
      } catch {}
    } else {
      setCodeError('Invalid Access Code. Please ask the event staff at the desk.');
    }
  };

  const universities = [
    'King\'s College London',
    'University College London',
    'Imperial College London',
    'Queen Mary University',
    'London School of Economics',
    'Brunel University',
    'City St George\'s',
    'St Mary\'s Twickenham',
    'Royal Holloway'
  ];

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F0] font-mono flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#121212] border border-[#F5F5F0]/20 p-8">
          <div className="flex justify-center mb-6">
            <img src="/images/lube-logo.png" alt="LUBE" className="h-16 brightness-0 invert" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-center mb-2">Access Scorecard</h1>
          <p className="text-center text-[#A1A1AA] text-sm mb-8">
            Please enter the event access code provided at the registration desk after paying your entry fee.
          </p>
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Enter Code (e.g. LUBE2026)"
                value={codeInput}
                onChange={e => setCodeInput(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#F5F5F0]/30 p-3 text-center text-xl font-black tracking-widest uppercase focus:outline-none focus:border-emerald-400"
              />
            </div>
            {codeError && <p className="text-red-400 text-xs text-center">{codeError}</p>}
            <button
              type="submit"
              className="w-full bg-emerald-500 text-[#0A0A0A] font-bold uppercase tracking-widest py-3 hover:bg-emerald-400 transition-colors"
            >
              Unlock
            </button>
          </form>
          <div className="mt-6 text-center">
            <Link href="/lube" className="text-xs text-[#A1A1AA] hover:text-white underline">
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F0] font-mono p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-[#F5F5F0]/20 pb-6 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <img src="/images/lube-logo.png" alt="LUBE" className="h-10 brightness-0 invert" />
              <span className="text-xs uppercase tracking-widest px-2 py-0.5 border border-[#F5F5F0]/40 rounded text-emerald-400">
                Circuit Engine Engine
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight mt-2">
              Circuit Live Scorecard
            </h1>
            <p className="text-xs text-[#A1A1AA] mt-1">
              Official London University Bouldering Events Circuit Scoring
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleManualSave}
              className="px-4 py-2 border border-[#F5F5F0]/40 text-xs uppercase tracking-widest hover:bg-[#F5F5F0]/10 transition-colors hidden sm:block"
            >
              {savedNotice ? '✓ Cached' : 'Local Save'}
            </button>
            <button
              onClick={handleSubmitScorecard}
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-500 text-[#0A0A0A] font-bold text-xs uppercase tracking-widest hover:bg-emerald-400 transition-colors"
            >
              {isSubmitting ? '...' : 'Submit Official Score'}
            </button>
          </div>
        </div>

        {/* Competitor Profile Setup */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-[#F5F5F0]/20 bg-[#121212] mb-8">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#A1A1AA] mb-1">Climber Name</label>
            <input
              type="text"
              placeholder="e.g. Alex Megos"
              value={climberName}
              onChange={e => setClimberName(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-[#F5F5F0]/30 p-2 text-sm text-[#F5F5F0] focus:outline-none focus:border-[#F5F5F0]"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#A1A1AA] mb-1">University</label>
            <select
              value={university}
              onChange={e => setUniversity(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-[#F5F5F0]/30 p-2 text-sm text-[#F5F5F0] focus:outline-none focus:border-[#F5F5F0]"
            >
              {universities.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#A1A1AA] mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as any)}
              className="w-full bg-[#0A0A0A] border border-[#F5F5F0]/30 p-2 text-sm text-[#F5F5F0] focus:outline-none focus:border-[#F5F5F0]"
            >
              <option value="Men">Men's Open</option>
              <option value="Women">Women's Open</option>
              <option value="Non-Binary/Open">Mixed / Social</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#A1A1AA] mb-1">Round</label>
            <select
              value={round}
              onChange={e => setRound(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-[#F5F5F0]/30 p-2 text-sm text-[#F5F5F0] focus:outline-none focus:border-[#F5F5F0]"
            >
              <option>Round 1: HarroWall (Closed)</option>
              <option>Round 2: Mile End (Closed)</option>
              <option>Round 3: VauxWall (Active)</option>
              <option>Finals: Substation (Upcoming)</option>
            </select>
          </div>
        </div>

        {/* Live Scorecard Summary Card */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8 p-6 bg-[#171717] border border-[#F5F5F0]/30 sticky top-4 z-20 backdrop-blur-md shadow-2xl">
          <div className="border-r border-[#F5F5F0]/10 pr-4">
            <p className="text-[10px] uppercase tracking-widest text-[#A1A1AA]">Total Score</p>
            <p className="text-4xl font-black text-emerald-400">{totalScore}</p>
            <p className="text-[10px] text-gray-400">Flash=10 | Top=7 | Zone=3</p>
          </div>

          <div className="border-r border-[#F5F5F0]/10 pr-4">
            <p className="text-[10px] uppercase tracking-widest text-[#A1A1AA]">Tops</p>
            <p className="text-3xl font-black">{totalTops} <span className="text-sm font-normal text-gray-500">/ 25</span></p>
            <p className="text-[10px] text-gray-400">{totalFlashes} Flashes</p>
          </div>

          <div className="border-r border-[#F5F5F0]/10 pr-4">
            <p className="text-[10px] uppercase tracking-widest text-[#A1A1AA]">Zones</p>
            <p className="text-3xl font-black">{totalZones} <span className="text-sm font-normal text-gray-500">/ 25</span></p>
            <p className="text-[10px] text-gray-400">Bonus holds secured</p>
          </div>

          <div className="border-r border-[#F5F5F0]/10 pr-4">
            <p className="text-[10px] uppercase tracking-widest text-[#A1A1AA]">Attempts</p>
            <p className="text-3xl font-black">{totalAttemptsToTop}</p>
            <p className="text-[10px] text-gray-400">Attempts to Tops</p>
          </div>

          <div className="col-span-2 md:col-span-1 flex flex-col justify-center">
            <div className="w-full bg-[#27272A] h-2 mb-2">
              <div
                className="bg-emerald-400 h-full transition-all duration-300"
                style={{ width: `${(totalTops / PROBLEMS.length) * 100}%` }}
              ></div>
            </div>
            <p className="text-[10px] uppercase tracking-wider text-center text-[#A1A1AA]">
              {Math.round((totalTops / PROBLEMS.length) * 100)}% Circuit Completed
            </p>
          </div>
        </div>

        {/* Boulder Circuit Grid */}
        <h2 className="text-xl font-black uppercase mb-4 tracking-wider flex items-center justify-between">
          <span>Circuit Boulders (1 - 25)</span>
          <span className="text-xs font-normal text-gray-400">Tap status to log send</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {PROBLEMS.map(prob => {
            const current = scores[prob.id] || { status: 'UNATTEMPTED', attempts: 1 };
            const isFlash = current.status === 'FLASH';
            const isTop = current.status === 'TOP';
            const isZone = current.status === 'ZONE';

            return (
              <div
                key={prob.id}
                className={`p-4 border transition-all ${
                  isFlash
                    ? 'border-emerald-400 bg-emerald-950/20'
                    : isTop
                    ? 'border-[#F5F5F0] bg-[#1a1a1a]'
                    : isZone
                    ? 'border-amber-400/80 bg-amber-950/10'
                    : 'border-[#F5F5F0]/20 bg-[#121212]'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full inline-block border border-black/40"
                      style={{ backgroundColor: prob.colorHex }}
                    ></span>
                    <span className="text-lg font-black tracking-tight">#{prob.id}</span>
                    <span className="text-xs px-2 py-0.5 bg-black/60 border border-[#F5F5F0]/20 text-[#D4D4D8]">
                      {prob.grade}
                    </span>
                  </div>

                  {/* Attempts Adjuster */}
                  <div className="flex items-center gap-1 bg-black/40 px-2 py-0.5 border border-[#F5F5F0]/20">
                    <button
                      onClick={() => handleAttempts(prob.id, -1)}
                      className="text-xs text-gray-400 hover:text-white px-1 font-bold"
                      title="Decrease attempt"
                    >
                      -
                    </button>
                    <span className="text-xs font-bold text-[#F5F5F0] px-1">
                      {current.attempts} {current.attempts === 1 ? 'try' : 'tries'}
                    </span>
                    <button
                      onClick={() => handleAttempts(prob.id, 1)}
                      className="text-xs text-gray-400 hover:text-white px-1 font-bold"
                      title="Increase attempt"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Status Toggle Buttons */}
                <div className="grid grid-cols-4 gap-1 mt-2">
                  <button
                    onClick={() => handleStatusChange(prob.id, 'FLASH')}
                    className={`py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      isFlash
                        ? 'bg-emerald-400 text-black'
                        : 'bg-black/60 border border-[#F5F5F0]/20 hover:border-emerald-400 text-gray-300'
                    }`}
                  >
                    Flash
                  </button>

                  <button
                    onClick={() => handleStatusChange(prob.id, 'TOP')}
                    className={`py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      isTop
                        ? 'bg-[#F5F5F0] text-black'
                        : 'bg-black/60 border border-[#F5F5F0]/20 hover:border-[#F5F5F0] text-gray-300'
                    }`}
                  >
                    Top
                  </button>

                  <button
                    onClick={() => handleStatusChange(prob.id, 'ZONE')}
                    className={`py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      isZone
                        ? 'bg-amber-400 text-black'
                        : 'bg-black/60 border border-[#F5F5F0]/20 hover:border-amber-400 text-gray-300'
                    }`}
                  >
                    Zone
                  </button>

                  <button
                    onClick={() => handleStatusChange(prob.id, 'UNATTEMPTED')}
                    className={`py-1.5 text-[10px] uppercase tracking-wider transition-colors ${
                      current.status === 'UNATTEMPTED'
                        ? 'bg-zinc-800 text-gray-400'
                        : 'bg-black/40 border border-transparent hover:border-red-500/50 text-gray-500 hover:text-red-400'
                    }`}
                  >
                    Reset
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Notes */}
        <div className="p-6 border border-[#F5F5F0]/20 bg-[#121212] text-xs text-[#A1A1AA] flex flex-col md:flex-row justify-between items-center gap-4">
          <p>
            Scores are auto-cached locally. Official score cards are validated by LUBE route judges during comp finals.
          </p>
          <div className="flex gap-4 font-mono">
            <Link href="/lube" className="underline hover:text-white">LUBE Home</Link>
            <Link href="/drops/lube" className="underline hover:text-white">LUBE Merch Drop</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
