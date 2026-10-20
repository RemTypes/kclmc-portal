'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { parseKclsuCsv, KclsuMemberRecord, isCompleteFullName } from '@/lib/roster';
import { UNIVERSITIES, isAssociateId } from '@/lib/auth';

interface RosterDirectoryRow extends KclsuMemberRecord {
  phone?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  safetyComplete?: boolean;
}

export default function ReconcilePage() {
  const [activeTab, setActiveTab] = useState<'roster' | 'associates' | 'merch'>('roster');
  const [dragActive, setDragActive] = useState(false);

  // Roster Sync states
  const [rosterCsvText, setRosterCsvText] = useState('');
  const [parsedMembers, setParsedMembers] = useState<KclsuMemberRecord[]>([]);
  const [rawTransactionCount, setRawTransactionCount] = useState(0);
  const [rosterSyncLoading, setRosterSyncLoading] = useState(false);
  const [rosterSyncResult, setRosterSyncResult] = useState<{
    success: boolean;
    source: string;
    message: string;
    totalSynced?: number;
  } | null>(null);

  // Live database stats & directory
  const [dbStats, setDbStats] = useState<{
    source: string;
    total: number;
    socialCount: number;
    recreationalCount: number;
    associateCount: number;
    awaitingSuCount: number;
    nextAssociateId: string;
  } | null>(null);
  const [rosterMembers, setRosterMembers] = useState<RosterDirectoryRow[]>([]);

  // Associate Member Creation Form states
  const [assocFullName, setAssocFullName] = useState('');
  const [assocCustomId, setAssocCustomId] = useState('');
  const [assocTier, setAssocTier] = useState<'social' | 'recreational'>('recreational');
  const [assocEmail, setAssocEmail] = useState('');
  const [assocUniversity, setAssocUniversity] = useState('Alumni / Associate / Guest');
  const [assocCustomUniversity, setAssocCustomUniversity] = useState('');
  const [assocSuStatus, setAssocSuStatus] = useState<'awaiting_su' | 'verified'>('awaiting_su');
  const [assocCreating, setAssocCreating] = useState(false);
  const [assocFeedback, setAssocFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    member?: KclsuMemberRecord;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Roster Table Filter & Inline Edit states
  const [rosterFilter, setRosterFilter] = useState<'associates' | 'awaiting_su' | 'all'>('associates');
  const [rosterSearch, setRosterSearch] = useState('');
  const [editingRow, setEditingRow] = useState<{
    cardNumber: string;
    fullName: string;
    tier: 'social' | 'recreational';
    email: string;
    university: string;
    suStatus: 'verified' | 'awaiting_su' | 'revoked';
  } | null>(null);
  const [rowSaving, setRowSaving] = useState<string | null>(null);

  // Merch drop states
  const [merchResults, setMerchResults] = useState<any>(null);

  // Fetch current database roster stats on mount
  useEffect(() => {
    fetchDbStats();
  }, []);

  const fetchDbStats = async () => {
    try {
      const res = await fetch('/api/roster', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setDbStats({
          source: data.source,
          total: data.total,
          socialCount: data.socialCount,
          recreationalCount: data.recreationalCount,
          associateCount: data.associateCount ?? 0,
          awaitingSuCount: data.awaitingSuCount ?? 0,
          nextAssociateId: data.nextAssociateId || 'ASSOC-2601',
        });
        if (Array.isArray(data.members)) {
          setRosterMembers(data.members);
        }
        if (data.nextAssociateId && !assocCustomId) {
          setAssocCustomId(data.nextAssociateId);
        }
      }
    } catch (err) {
      console.error('Error fetching roster stats:', err);
    }
  };

  const handleCreateAssociate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assocFullName.trim()) return;
    setAssocCreating(true);
    setAssocFeedback(null);

    const effectiveUni =
      assocUniversity === 'Other UK Institution'
        ? assocCustomUniversity.trim() || 'Other UK Institution'
        : assocUniversity;

    try {
      const res = await fetch('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_associate',
          fullName: assocFullName.trim(),
          customCardNumber: assocCustomId.trim() || undefined,
          tier: assocTier,
          email: assocEmail.trim() || null,
          university: effectiveUni,
          suStatus: assocSuStatus,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setAssocFeedback({
          type: 'success',
          message: data.message || `Created Associate Member ${data.member?.cardNumber}`,
          member: data.member,
        });
        setAssocFullName('');
        setAssocEmail('');
        setAssocCustomId('');
        await fetchDbStats();
      } else {
        setAssocFeedback({
          type: 'error',
          message: data.error || 'Failed to create associate member.',
        });
      }
    } catch (err: any) {
      setAssocFeedback({
        type: 'error',
        message: err.message || 'Network error creating associate member.',
      });
    } finally {
      setAssocCreating(false);
    }
  };

  const handleQuickUpdateMember = async (
    cardNumber: string,
    updates: {
      fullName?: string;
      tier?: 'social' | 'recreational';
      email?: string | null;
      university?: string | null;
      suStatus?: 'verified' | 'awaiting_su' | 'revoked';
    }
  ) => {
    setRowSaving(cardNumber);
    try {
      const res = await fetch('/api/roster', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardNumber,
          ...updates,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEditingRow(null);
        await fetchDbStats();
      } else {
        alert(data.error || 'Failed to update member.');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating member.');
    } finally {
      setRowSaving(null);
    }
  };

  const handleDeleteMember = async (cardNumber: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently remove ${name} (${cardNumber}) from the roster?`)) {
      return;
    }
    setRowSaving(cardNumber);
    try {
      const res = await fetch(`/api/roster?cardNumber=${encodeURIComponent(cardNumber)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchDbStats();
      } else {
        alert(data.error || 'Failed to delete member.');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting member.');
    } finally {
      setRowSaving(null);
    }
  };

  const copyAssociateInvite = async (member: { name: string; cardNumber: string; tier: string }) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kclmc.uk';
    const inviteUrl = `${origin}/login?view=sign_up&type=associate&id=${encodeURIComponent(member.cardNumber)}`;
    const message = `Hi ${member.name.split(' ')[0]}! Climbing pass setup for KCLMC 2026/27:\n\nYour Custom Associate ID is: ${member.cardNumber} (${member.tier.toUpperCase()} Tier)\n\n1. Register or sign in via the Associate Member tab here: ${inviteUrl}\n2. Enter your Custom Associate ID (${member.cardNumber}) and complete your Emergency Contact details to unlock your digital pass!`;
    try {
      await navigator.clipboard.writeText(message);
      setCopiedId(member.cardNumber);
      setTimeout(() => setCopiedId(null), 3000);
    } catch {
      // Fallback
    }
  };

  const handleRosterFile = (text: string) => {
    setRosterCsvText(text);
    const rawLines = text.split('\n').filter(l => l.trim().length > 0 && (l.includes(',K') || l.includes('K2') || l.includes('K1') || l.toLowerCase().includes('associate')));
    setRawTransactionCount(rawLines.length);
    const parsed = parseKclsuCsv(text);
    setParsedMembers(parsed);
    setRosterSyncResult(null);
  };

  const handleSyncRosterToDb = async () => {
    if (!rosterCsvText && !parsedMembers.length) return;
    setRosterSyncLoading(true);
    setRosterSyncResult(null);

    try {
      const res = await fetch('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: rosterCsvText, records: parsedMembers }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setRosterSyncResult({
          success: true,
          source: data.source,
          message: data.message || `Successfully synced ${data.totalSynced} members to database.`,
          totalSynced: data.totalSynced,
        });
        await fetchDbStats();
      } else {
        setRosterSyncResult({
          success: false,
          source: 'error',
          message: data.error || 'Failed to sync roster to database.',
        });
      }
    } catch (err: any) {
      setRosterSyncResult({
        success: false,
        source: 'error',
        message: err.message || 'Network error syncing roster.',
      });
    } finally {
      setRosterSyncLoading(false);
    }
  };

  // Merch CSV processor
  const processMerchCSV = async (text: string) => {
    const parseCSV = (csv: string) => {
      let result = [];
      let row = [];
      let currentWord = '';
      let inQuotes = false;

      for (let i = 0; i < csv.length; i++) {
        const char = csv[i];
        const nextChar = csv[i + 1];

        if (inQuotes) {
          if (char === '"' && nextChar === '"') {
            currentWord += '"';
            i++;
          } else if (char === '"') {
            inQuotes = false;
          } else {
            currentWord += char;
          }
        } else {
          if (char === '"') {
            inQuotes = true;
          } else if (char === ',') {
            row.push(currentWord.trim());
            currentWord = '';
          } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
            row.push(currentWord.trim());
            result.push(row);
            row = [];
            currentWord = '';
            if (char === '\r') i++;
          } else {
            currentWord += char;
          }
        }
      }

      if (currentWord !== '' || row.length > 0) {
        row.push(currentWord.trim());
        result.push(row);
      }

      return result;
    };

    const lines = parseCSV(text.trim());
    if (lines.length < 2) return;
    const headers = lines[0];
    const data = lines.slice(1).map((values) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        obj[h] = values[i];
      });
      return obj;
    });

    const res = await fetch('/api/reconcile', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
    const parsedRes = await res.json();
    if (parsedRes.results) setMerchResults(parsedRes.results);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const text = await e.dataTransfer.files[0].text();
      if (activeTab === 'roster') {
        handleRosterFile(text);
      } else if (activeTab === 'merch') {
        processMerchCSV(text);
      }
    }
  };

  const loadSampleMerch = () => {
    const sampleCSV = `Date,Order ID,Name,Email,Amount,Note\n2026-09-13,KCL-1234,Alice,alice@example.com,20,\n2026-09-13,LUB-5678,Bob,bob@example.com,20,Deposit\n2026-09-13,UNK-9999,Charlie,c@example.com,15,Missing Order`;
    processMerchCSV(sampleCSV);
  };

  const filteredRosterMembers = rosterMembers.filter(m => {
    const isAssoc = Boolean(m.isAssociate || isAssociateId(m.cardNumber));
    if (rosterFilter === 'associates' && !isAssoc) return false;
    if (rosterFilter === 'awaiting_su' && m.suStatus !== 'awaiting_su') return false;
    if (rosterSearch.trim()) {
      const q = rosterSearch.toLowerCase();
      return (
        m.cardNumber.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        (m.university && m.university.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#041F1E] text-slate-100 p-6 md:p-10 font-sans relative overflow-hidden topo-pattern">
      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b border-[#084746] pb-4 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/admin" className="text-zinc-400 hover:text-[#FFBD59] text-xs font-mono transition-colors">
                ← Back to Dashboard
              </Link>
              <span className="text-zinc-600">/</span>
              <span className="text-xs font-mono font-bold text-[#FFBD59]">KCLSU Roster &amp; Associate Management</span>
            </div>
            <h1 className="text-3xl font-black font-heading uppercase tracking-wide text-white mt-2">
              Reconciliation &amp; Associate IDs
            </h1>
            <p className="text-sm text-zinc-300 mt-1">
              Synchronize KCLSU sales exports, issue custom Associate Member IDs (`ASSOC-26XX`), and manage member tiers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'roster' && parsedMembers.length > 0 && (
              <button
                onClick={handleSyncRosterToDb}
                disabled={rosterSyncLoading}
                className="px-5 py-2.5 bg-[#FFBD59] hover:bg-[#FFE0A3] disabled:opacity-50 text-[#052322] font-heading font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <span>{rosterSyncLoading ? 'Synchronizing...' : '⚡ Sync Roster to Database'}</span>
              </button>
            )}
            {activeTab === 'merch' && (
              <button
                onClick={loadSampleMerch}
                className="px-4 py-2.5 bg-[#084746] hover:bg-[#0a5857] text-[#FFBD59] border border-[#FFBD59]/40 font-heading font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <span>Load Sample Data</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-[#084746] mb-8 font-mono text-xs">
          <button
            onClick={() => setActiveTab('roster')}
            className={`pb-3 px-4 font-bold uppercase transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'roster'
                ? 'border-[#FFBD59] text-[#FFBD59]'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <span>📋 KCLSU Member Roster Sync</span>
            {dbStats && (
              <span className="bg-[#084746] text-[#FFBD59] px-2 py-0.5 rounded-full text-[10px]">
                {dbStats.total}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('associates')}
            className={`pb-3 px-4 font-bold uppercase transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'associates'
                ? 'border-[#FFBD59] text-[#FFBD59]'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <span>🤝 Associate Members &amp; Custom IDs</span>
            {dbStats && (
              <span className="bg-[#084746] text-[#FFBD59] px-2 py-0.5 rounded-full text-[10px]">
                {dbStats.associateCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('merch')}
            className={`pb-3 px-4 font-bold uppercase transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'merch'
                ? 'border-[#FFBD59] text-[#FFBD59]'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <span>👕 Merch Drop Reconciliation</span>
            {merchResults && (
              <span className="bg-[#084746] text-zinc-300 px-2 py-0.5 rounded-full text-[10px]">
                {merchResults.matched?.length || 0}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: Roster Sync */}
        {activeTab === 'roster' && (
          <div className="space-y-6">
            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-[#052322] border border-[#084746] rounded-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-mono text-[11px] uppercase block">Total Database Roster</span>
                  <button
                    onClick={fetchDbStats}
                    className="text-[11px] text-[#FFBD59] hover:underline font-mono"
                    title="Refresh database count"
                  >
                    Refresh ↻
                  </button>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black font-heading text-white">{dbStats?.total ?? 0}</span>
                  <span className="text-xs text-zinc-400 font-mono">Members</span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono mt-1">
                  Source: {dbStats?.source === 'supabase' ? 'Supabase Postgres' : 'Local Fallback'}
                </span>
              </div>

              <div className="p-4 bg-[#052322] border border-[#084746] rounded-2xl">
                <span className="text-zinc-400 font-mono text-[11px] uppercase block">Recreational Members</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black font-heading text-emerald-400">{dbStats?.recreationalCount ?? 0}</span>
                  <span className="text-xs text-zinc-400 font-mono">Climbers</span>
                </div>
                <span className="text-[10px] text-emerald-400/80 font-mono mt-1 block">
                  Full wall access &amp; BMC coverage
                </span>
              </div>

              <div className="p-4 bg-[#052322] border border-[#084746] rounded-2xl">
                <span className="text-zinc-400 font-mono text-[11px] uppercase block">Social Members</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black font-heading text-[#FFBD59]">{dbStats?.socialCount ?? 0}</span>
                  <span className="text-xs text-zinc-400 font-mono">Members</span>
                </div>
                <span className="text-[10px] text-[#FFBD59]/80 font-mono mt-1 block">
                  Social events &amp; non-climbing
                </span>
              </div>
            </div>

            {/* Drag and Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center transition-colors ${
                dragActive
                  ? 'border-[#FFBD59] bg-[#084746]/70'
                  : 'border-[#084746] bg-[#052322] hover:border-[#FFBD59]/60'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <div className="text-4xl mb-3">📄</div>
              <h3 className="text-lg font-bold font-heading uppercase tracking-wide text-white mb-1">
                Drop KCLSU Membership CSV Here
              </h3>
              <p className="text-xs text-zinc-300 max-w-md mx-auto mb-4 font-mono">
                Accepts official student union purchase export with card_number, purchaser, product_name, and transaction_id.
              </p>
              <div className="flex justify-center items-center gap-3">
                <label className="cursor-pointer px-5 py-2.5 bg-[#FFBD59] hover:bg-[#FFE0A3] text-[#052322] font-heading font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md inline-block">
                  <span>Select CSV File</span>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={async (e) => {
                      if (e.target.files && e.target.files[0]) {
                        const text = await e.target.files[0].text();
                        handleRosterFile(text);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Sync Feedback Message */}
            {rosterSyncResult && (
              <div
                className={`p-4 rounded-2xl flex items-center justify-between font-mono text-xs shadow-lg ${
                  rosterSyncResult.success
                    ? 'bg-emerald-950/80 border border-emerald-500/60 text-emerald-300'
                    : 'bg-red-950/80 border border-red-500/60 text-red-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{rosterSyncResult.success ? '✔' : '✖'}</span>
                  <span>{rosterSyncResult.message}</span>
                </div>
                <span className="text-[10px] text-zinc-400 bg-[#041F1E] px-2.5 py-1 rounded-full border border-zinc-700">
                  Target: {rosterSyncResult.source}
                </span>
              </div>
            )}

            {/* Parsed CSV Preview Table */}
            {parsedMembers.length > 0 && (
              <div className="bg-[#052322] border border-[#084746] rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-5 border-b border-[#084746] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#041F1E]/80">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold font-heading uppercase text-white tracking-wide">
                        Parsed CSV Roster: {parsedMembers.length} Unique Members
                      </h2>
                      {rawTransactionCount > parsedMembers.length && (
                        <span className="text-[10px] font-mono text-[#FFBD59] bg-[#084746] px-2.5 py-0.5 rounded-full border border-[#FFBD59]/30">
                          {rawTransactionCount} total purchase rows • Upgrades merged
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      {parsedMembers.filter((m) => m.tier === 'recreational').length} Recreational •{' '}
                      {parsedMembers.filter((m) => m.tier === 'social').length} Social
                    </p>
                  </div>
                  <button
                    onClick={handleSyncRosterToDb}
                    disabled={rosterSyncLoading}
                    className="px-5 py-2.5 bg-[#FFBD59] hover:bg-[#FFE0A3] disabled:opacity-50 text-[#052322] font-heading font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <span>{rosterSyncLoading ? 'Synchronizing...' : 'Sync Roster to Database ⚡'}</span>
                  </button>
                </div>

                <div className="p-3 bg-[#084746]/50 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-300 font-mono mb-4">
                  <span>🛡️ <strong>ETL Survivor Rule Active:</strong> Syncing will safely ingest new sales while preserving any manually curated full names in your database. Single-word names from KCLSU will not overwrite existing first names.</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono">
                    <thead className="bg-[#041F1E] text-zinc-400 text-xs uppercase tracking-wider border-b border-[#084746]">
                      <tr>
                        <th className="p-4 font-bold text-white">Student ID</th>
                        <th className="p-4 font-bold text-white">Member Name</th>
                        <th className="p-4">Tier</th>
                        <th className="p-4">Transaction ID</th>
                        <th className="p-4">Purchase Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#084746]/60 text-xs">
                      {parsedMembers.slice(0, 10).map((m, i) => (
                        <tr key={i} className="hover:bg-[#084746]/30 transition-colors">
                          <td className="p-4 text-[#FFBD59] font-bold">{m.cardNumber}</td>
                          <td className="p-4 font-bold text-white font-sans">
                            <div className="flex items-center gap-2">
                              <span>{m.name}</span>
                              {!isCompleteFullName(m.name) && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-600/40 font-mono">
                                  ⚠️ Missing First Name
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 uppercase text-[11px] text-zinc-300">
                            <span
                              className={`px-2 py-0.5 rounded ${
                                m.tier === 'recreational'
                                  ? 'bg-emerald-950 text-emerald-300'
                                  : 'bg-[#084746] text-[#FFBD59]'
                              }`}
                            >
                              {m.tier}
                            </span>
                          </td>
                          <td className="p-4 text-zinc-300">{m.transactionId}</td>
                          <td className="p-4 text-zinc-400">{m.purchaseDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedMembers.length > 10 && (
                    <div className="p-3 text-center text-zinc-400 text-xs bg-[#041F1E]/50 border-t border-[#084746]">
                      + {parsedMembers.length - 10} more members in upload
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Associate Members & Custom IDs */}
        {activeTab === 'associates' && (
          <div className="space-y-8">
            {/* Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-[#052322] border border-[#084746] rounded-2xl">
                <span className="text-zinc-400 font-mono text-[11px] uppercase block">Issued Associate IDs</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black font-heading text-[#FFBD59]">{dbStats?.associateCount ?? 0}</span>
                  <span className="text-xs text-zinc-400 font-mono">Non-KCL / External</span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono mt-1 block">
                  Custom `ASSOC-26XX` &amp; Guest Passes
                </span>
              </div>

              <div className="p-4 bg-[#052322] border border-[#084746] rounded-2xl">
                <span className="text-zinc-400 font-mono text-[11px] uppercase block">Awaiting KCLSU Processing</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black font-heading text-amber-400">{dbStats?.awaitingSuCount ?? 0}</span>
                  <span className="text-xs text-zinc-400 font-mono">Pending SU Sync</span>
                </div>
                <span className="text-[10px] text-amber-400/80 font-mono mt-1 block">
                  Passes active while SU resolves backlog
                </span>
              </div>

              <div className="p-4 bg-[#052322] border border-[#084746] rounded-2xl">
                <span className="text-zinc-400 font-mono text-[11px] uppercase block">Next Auto-Generated ID</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black font-mono text-emerald-400">{dbStats?.nextAssociateId ?? 'ASSOC-2601'}</span>
                </div>
                <span className="text-[10px] text-emerald-400/80 font-mono mt-1 block">
                  Ready for immediate assignment
                </span>
              </div>
            </div>

            {/* Issue Custom Associate ID Card */}
            <div className="bg-[#052322] border-2 border-[#FFBD59]/40 rounded-3xl p-6 md:p-8 shadow-2xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-4 border-b border-[#084746]">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#FFBD59] bg-[#041F1E] px-2.5 py-1 rounded border border-[#FFBD59]/30">
                    Manual Associate Onboarding
                  </span>
                  <h2 className="text-xl font-black font-heading uppercase text-white mt-2">
                    Issue Custom Associate Member ID
                  </h2>
                  <p className="text-xs text-zinc-300 mt-0.5">
                    Generate an official Associate ID (`ASSOC-26XX`) for non-KCL climbers awaiting KCLSU associate processing so they can register and unlock their digital climbing pass immediately.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateAssociate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                      Full Name (First &amp; Last) *
                    </label>
                    <input
                      type="text"
                      required
                      value={assocFullName}
                      onChange={e => setAssocFullName(e.target.value)}
                      placeholder="e.g. Tommy Caldwell"
                      className="w-full bg-[#041F1E] border border-[#084746] focus:border-[#FFBD59] rounded-xl px-4 py-2.5 text-sm text-white font-sans outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-300 mb-1.5 flex justify-between">
                      <span>Custom Associate ID</span>
                      <button
                        type="button"
                        onClick={() => setAssocCustomId(dbStats?.nextAssociateId || 'ASSOC-2601')}
                        className="text-[10px] font-mono text-[#FFBD59] hover:underline cursor-pointer"
                      >
                        Reset to {dbStats?.nextAssociateId || 'ASSOC-2601'}
                      </button>
                    </label>
                    <input
                      type="text"
                      value={assocCustomId}
                      onChange={e => setAssocCustomId(e.target.value.toUpperCase())}
                      placeholder={dbStats?.nextAssociateId || 'ASSOC-2601'}
                      className="w-full bg-[#041F1E] border border-[#084746] focus:border-[#FFBD59] rounded-xl px-4 py-2.5 text-sm text-[#FFBD59] font-mono uppercase tracking-wider outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                      Membership Tier *
                    </label>
                    <select
                      value={assocTier}
                      onChange={e => setAssocTier(e.target.value as 'social' | 'recreational')}
                      className="w-full bg-[#041F1E] border border-[#084746] focus:border-[#FFBD59] rounded-xl px-4 py-2.5 text-sm text-white font-sans outline-none cursor-pointer"
                    >
                      <option value="recreational">Recreational (£45 — Full Trips &amp; Gear)</option>
                      <option value="social">Social (£15 — Bouldering &amp; Socials)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                      Personal Email (for BMC Insurance)
                    </label>
                    <input
                      type="email"
                      value={assocEmail}
                      onChange={e => setAssocEmail(e.target.value)}
                      placeholder="climber@gmail.com"
                      className="w-full bg-[#041F1E] border border-[#084746] focus:border-[#FFBD59] rounded-xl px-4 py-2.5 text-sm text-white font-sans outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                      University / Affiliation
                    </label>
                    <select
                      value={assocUniversity}
                      onChange={e => setAssocUniversity(e.target.value)}
                      className="w-full bg-[#041F1E] border border-[#084746] focus:border-[#FFBD59] rounded-xl px-4 py-2.5 text-sm text-white font-sans outline-none cursor-pointer"
                    >
                      {UNIVERSITIES.map(u => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                      SU Processing Status
                    </label>
                    <select
                      value={assocSuStatus}
                      onChange={e => setAssocSuStatus(e.target.value as 'awaiting_su' | 'verified')}
                      className="w-full bg-[#041F1E] border border-[#084746] focus:border-[#FFBD59] rounded-xl px-4 py-2.5 text-sm text-white font-sans outline-none cursor-pointer"
                    >
                      <option value="awaiting_su">⏳ Awaiting KCLSU Processing (Pass Active)</option>
                      <option value="verified">✔ Verified / Paid</option>
                    </select>
                  </div>
                </div>

                {assocUniversity === 'Other UK Institution' && (
                  <div>
                    <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                      Specify Institution / Affiliation
                    </label>
                    <input
                      type="text"
                      value={assocCustomUniversity}
                      onChange={e => setAssocCustomUniversity(e.target.value)}
                      placeholder="e.g. University of Bristol / KCL Alumni"
                      className="w-full bg-[#041F1E] border border-[#084746] focus:border-[#FFBD59] rounded-xl px-4 py-2.5 text-sm text-white font-sans outline-none"
                    />
                  </div>
                )}

                <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <p className="text-[11px] font-mono text-zinc-400">
                    💡 Future KCLSU CSV exports containing this member&apos;s name will automatically reconcile with their custom ID.
                  </p>
                  <button
                    type="submit"
                    disabled={assocCreating || !assocFullName.trim()}
                    className="px-6 py-3 bg-[#FFBD59] hover:bg-[#FFE0A3] disabled:opacity-50 text-[#052322] font-heading font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer shrink-0"
                  >
                    {assocCreating ? 'Issuing ID...' : '➕ Issue Associate ID & Activate'}
                  </button>
                </div>
              </form>

              {assocFeedback && (
                <div
                  className={`mt-5 p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono ${
                    assocFeedback.type === 'success'
                      ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                      : 'bg-red-950/80 border-red-500/50 text-red-200'
                  }`}
                >
                  <div>
                    <span className="font-bold">{assocFeedback.type === 'success' ? '✔ ' : '✖ '}</span>
                    <span>{assocFeedback.message}</span>
                  </div>
                  {assocFeedback.member && (
                    <button
                      type="button"
                      onClick={() => copyAssociateInvite(assocFeedback.member!)}
                      className="px-3.5 py-2 bg-[#FFBD59] text-[#052322] font-heading font-black uppercase tracking-wider rounded-xl hover:bg-white transition-colors cursor-pointer shrink-0"
                    >
                      {copiedId === assocFeedback.member.cardNumber
                        ? '✓ Login Instructions Copied!'
                        : '📋 Copy Login Instructions for Member'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Roster & Associate Management Table */}
            <div className="bg-[#052322] border border-[#084746] rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-5 border-b border-[#084746] bg-[#041F1E]/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-base font-bold font-heading uppercase text-white tracking-wide">
                    Associate &amp; Member Roster Management
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Edit details, upgrade Social → Recreational, mark SU status verified, or copy login instructions.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <div className="flex bg-[#052322] p-1 rounded-xl border border-[#084746] font-mono text-[11px]">
                    <button
                      type="button"
                      onClick={() => setRosterFilter('associates')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        rosterFilter === 'associates' ? 'bg-[#FFBD59] text-[#052322] font-bold' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Associates ({dbStats?.associateCount ?? 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRosterFilter('awaiting_su')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        rosterFilter === 'awaiting_su' ? 'bg-[#FFBD59] text-[#052322] font-bold' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Awaiting SU ({dbStats?.awaitingSuCount ?? 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRosterFilter('all')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        rosterFilter === 'all' ? 'bg-[#FFBD59] text-[#052322] font-bold' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      All Roster ({rosterMembers.length})
                    </button>
                  </div>

                  <input
                    type="text"
                    value={rosterSearch}
                    onChange={e => setRosterSearch(e.target.value)}
                    placeholder="Search ID, name, email..."
                    className="bg-[#052322] border border-[#084746] focus:border-[#FFBD59] rounded-xl px-3 py-1.5 text-xs font-mono text-white outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono">
                  <thead className="bg-[#041F1E] text-zinc-400 text-xs uppercase tracking-wider border-b border-[#084746]">
                    <tr>
                      <th className="p-4 font-bold text-white">Member ID</th>
                      <th className="p-4 font-bold text-white">Name &amp; Affiliation</th>
                      <th className="p-4">Tier</th>
                      <th className="p-4">SU Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#084746]/60 text-xs">
                    {filteredRosterMembers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-zinc-400 font-mono">
                          {rosterFilter === 'associates'
                            ? 'No Associate Members issued yet. Use the form above to generate your first ASSOC-2601 ID.'
                            : 'No matching roster records found.'}
                        </td>
                      </tr>
                    ) : (
                      filteredRosterMembers.map(m => {
                        const isEditing = editingRow?.cardNumber === m.cardNumber;
                        const isAssoc = Boolean(m.isAssociate || isAssociateId(m.cardNumber));
                        const status = m.suStatus || 'verified';

                        return (
                          <tr key={m.cardNumber} className="hover:bg-[#084746]/30 transition-colors">
                            <td className="p-4 align-top">
                              <div className="font-bold text-[#FFBD59]">{m.cardNumber}</div>
                              {isAssoc && (
                                <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] bg-[#084746] text-[#FFBD59] border border-[#FFBD59]/30">
                                  🤝 ASSOCIATE
                                </span>
                              )}
                            </td>

                            <td className="p-4 align-top font-sans">
                              {isEditing ? (
                                <div className="space-y-2 max-w-xs">
                                  <input
                                    type="text"
                                    value={editingRow.fullName}
                                    onChange={e => setEditingRow({ ...editingRow, fullName: e.target.value })}
                                    placeholder="Full Name"
                                    className="w-full bg-[#041F1E] border border-[#FFBD59]/50 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                  />
                                  <input
                                    type="email"
                                    value={editingRow.email}
                                    onChange={e => setEditingRow({ ...editingRow, email: e.target.value })}
                                    placeholder="Email address"
                                    className="w-full bg-[#041F1E] border border-[#084746] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                                  />
                                  <input
                                    type="text"
                                    value={editingRow.university}
                                    onChange={e => setEditingRow({ ...editingRow, university: e.target.value })}
                                    placeholder="University / Affiliation"
                                    className="w-full bg-[#041F1E] border border-[#084746] rounded-lg px-2.5 py-1.5 text-xs text-white"
                                  />
                                </div>
                              ) : (
                                <div>
                                  <div className="font-bold text-white">{m.name}</div>
                                  {m.email && <div className="text-[11px] font-mono text-zinc-400">{m.email}</div>}
                                  <div className="text-[11px] text-zinc-400">{m.university || "King's College London"}</div>
                                </div>
                              )}
                            </td>

                            <td className="p-4 align-top">
                              {isEditing ? (
                                <select
                                  value={editingRow.tier}
                                  onChange={e => setEditingRow({ ...editingRow, tier: e.target.value as 'social' | 'recreational' })}
                                  className="bg-[#041F1E] border border-[#FFBD59]/50 rounded-lg px-2 py-1 text-xs text-white"
                                >
                                  <option value="recreational">RECREATIONAL</option>
                                  <option value="social">SOCIAL</option>
                                </select>
                              ) : (
                                <div className="flex flex-col items-start gap-1">
                                  <span
                                    className={`px-2 py-0.5 rounded uppercase text-[10px] font-bold ${
                                      m.tier === 'recreational'
                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                        : 'bg-[#084746] text-[#FFBD59] border border-[#FFBD59]/30'
                                    }`}
                                  >
                                    {m.tier}
                                  </span>
                                  {m.tier === 'social' && (
                                    <button
                                      type="button"
                                      disabled={rowSaving === m.cardNumber}
                                      onClick={() => handleQuickUpdateMember(m.cardNumber, { tier: 'recreational' })}
                                      className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                                      title="Upgrade member from Social to Recreational"
                                    >
                                      ↑ Upgrade to Rec
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="p-4 align-top">
                              {isEditing ? (
                                <select
                                  value={editingRow.suStatus}
                                  onChange={e =>
                                    setEditingRow({
                                      ...editingRow,
                                      suStatus: e.target.value as 'verified' | 'awaiting_su' | 'revoked',
                                    })
                                  }
                                  className="bg-[#041F1E] border border-[#FFBD59]/50 rounded-lg px-2 py-1 text-xs text-white"
                                >
                                  <option value="awaiting_su">AWAITING SU</option>
                                  <option value="verified">VERIFIED</option>
                                  <option value="revoked">REVOKED</option>
                                </select>
                              ) : (
                                <div className="flex flex-col items-start gap-1">
                                  <span
                                    className={`px-2 py-0.5 rounded uppercase text-[10px] font-bold ${
                                      status === 'verified'
                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                        : status === 'awaiting_su'
                                        ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                                        : 'bg-red-950 text-red-300 border border-red-500/40'
                                    }`}
                                  >
                                    {status === 'awaiting_su' ? '⏳ AWAITING SU' : status === 'revoked' ? '⛔ REVOKED' : '✔ VERIFIED'}
                                  </span>
                                  {status === 'awaiting_su' && (
                                    <button
                                      type="button"
                                      disabled={rowSaving === m.cardNumber}
                                      onClick={() => handleQuickUpdateMember(m.cardNumber, { suStatus: 'verified' })}
                                      className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                                    >
                                      ✔ Mark SU Verified
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="p-4 align-top text-right">
                              {isEditing ? (
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    type="button"
                                    disabled={rowSaving === m.cardNumber}
                                    onClick={() =>
                                      handleQuickUpdateMember(m.cardNumber, {
                                        fullName: editingRow.fullName,
                                        tier: editingRow.tier,
                                        email: editingRow.email || null,
                                        university: editingRow.university || null,
                                        suStatus: editingRow.suStatus,
                                      })
                                    }
                                    className="px-2.5 py-1 bg-emerald-500 text-slate-950 font-bold rounded-lg text-[11px] hover:bg-emerald-400 cursor-pointer"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingRow(null)}
                                    className="px-2.5 py-1 bg-[#041F1E] text-zinc-300 rounded-lg text-[11px] hover:bg-[#084746] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-wrap justify-end gap-1.5">
                                  {isAssoc && (
                                    <button
                                      type="button"
                                      onClick={() => copyAssociateInvite(m)}
                                      className="px-2.5 py-1 bg-[#084746] hover:bg-[#0b5c5a] text-[#FFBD59] border border-[#FFBD59]/30 rounded-lg text-[10px] font-bold cursor-pointer"
                                      title="Copy login link and instructions for this Associate Member"
                                    >
                                      {copiedId === m.cardNumber ? '✓ Copied' : '📋 Invite'}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingRow({
                                        cardNumber: m.cardNumber,
                                        fullName: m.name,
                                        tier: m.tier,
                                        email: m.email || '',
                                        university: m.university || (isAssoc ? 'Alumni / Associate / Guest' : "King's College London"),
                                        suStatus: m.suStatus || 'verified',
                                      })
                                    }
                                    className="px-2.5 py-1 bg-[#041F1E] hover:bg-[#084746] text-zinc-200 border border-[#084746] rounded-lg text-[10px] cursor-pointer"
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    type="button"
                                    disabled={rowSaving === m.cardNumber}
                                    onClick={() => handleDeleteMember(m.cardNumber, m.name)}
                                    className="px-2 py-1 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-500/30 rounded-lg text-[10px] cursor-pointer"
                                    title="Delete member from roster"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Merch Drop Reconciliation */}
        {activeTab === 'merch' && (
          <div className="space-y-6">
            {/* Dropzone */}
            <div
              className={`border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center transition-colors ${
                dragActive
                  ? 'border-[#FFBD59] bg-[#084746]/70'
                  : 'border-[#084746] bg-[#052322] hover:border-[#FFBD59]/60'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <div className="text-4xl mb-3">📄</div>
              <h3 className="text-lg font-bold font-heading uppercase tracking-wide text-white mb-1">
                Drop KCLSU Merch Payment CSV Here
              </h3>
              <p className="text-xs text-zinc-300 max-w-md mx-auto mb-4 font-mono">
                The 3-tier matching engine will automatically pair payments to pending merch order passes.
              </p>
              <div className="flex justify-center items-center gap-3">
                <label className="cursor-pointer px-5 py-2.5 bg-[#FFBD59] hover:bg-[#FFE0A3] text-[#052322] font-heading font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md inline-block">
                  <span>Select CSV File</span>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={async (e) => {
                      if (e.target.files && e.target.files[0]) {
                        const text = await e.target.files[0].text();
                        processMerchCSV(text);
                      }
                    }}
                  />
                </label>
                <button
                  onClick={loadSampleMerch}
                  className="px-4 py-2.5 bg-[#084746] hover:bg-[#0a5857] text-[#FFBD59] border border-[#FFBD59]/40 font-heading font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md"
                >
                  Load Sample Data
                </button>
              </div>
            </div>

            {/* Merch Results Breakdown */}
            {merchResults && (
              <div className="space-y-6">
                {/* Matched */}
                <div className="bg-[#052322] border border-emerald-500/40 rounded-2xl overflow-hidden shadow-xl">
                  <div className="p-4 border-b border-[#084746] bg-[#041F1E]/80 flex justify-between items-center">
                    <h2 className="text-xs font-mono uppercase font-bold text-emerald-400 flex items-center gap-2">
                      <span>✔ Matched Payments</span>
                      <span className="bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full text-[10px]">
                        {merchResults.matched?.length || 0}
                      </span>
                    </h2>
                    <span className="text-[10px] font-mono text-zinc-400">Order code &amp; amount verified</span>
                  </div>
                  <div className="p-4">
                    {merchResults.matched?.length === 0 ? (
                      <p className="text-xs font-mono text-zinc-500 py-2">No matched orders found.</p>
                    ) : (
                      <ul className="space-y-2">
                        {merchResults.matched.map((m: any, i: number) => (
                          <li key={i} className="flex justify-between items-center p-3 bg-[#041F1E] border border-[#084746] text-emerald-200 rounded-xl font-mono text-xs">
                            <span className="font-bold text-white">{m.orderCode}</span>
                            <span className="text-emerald-400 font-bold">£{m.amount}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Partial */}
                <div className="bg-[#052322] border border-amber-500/40 rounded-2xl overflow-hidden shadow-xl">
                  <div className="p-4 border-b border-[#084746] bg-[#041F1E]/80 flex justify-between items-center">
                    <h2 className="text-xs font-mono uppercase font-bold text-amber-400 flex items-center gap-2">
                      <span>⏳ Partial Payments</span>
                      <span className="bg-amber-950 text-amber-300 px-2 py-0.5 rounded-full text-[10px]">
                        {merchResults.partial?.length || 0}
                      </span>
                    </h2>
                    <span className="text-[10px] font-mono text-zinc-400">Requires manual review</span>
                  </div>
                  <div className="p-4">
                    {merchResults.partial?.length === 0 ? (
                      <p className="text-xs font-mono text-zinc-500 py-2">No partial orders found.</p>
                    ) : (
                      <ul className="space-y-2">
                        {merchResults.partial.map((m: any, i: number) => (
                          <li key={i} className="flex justify-between items-center p-3 bg-[#041F1E] border border-[#084746] text-amber-200 rounded-xl font-mono text-xs">
                            <span className="font-bold text-white">{m.orderCode}</span>
                            <span className="text-amber-400">Paid: £{m.amount} / Expected: £{m.expected}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Orphan */}
                <div className="bg-[#052322] border border-red-500/40 rounded-2xl overflow-hidden shadow-xl">
                  <div className="p-4 border-b border-[#084746] bg-[#041F1E]/80 flex justify-between items-center">
                    <h2 className="text-xs font-mono uppercase font-bold text-red-400 flex items-center gap-2">
                      <span>✖ Orphan Payments</span>
                      <span className="bg-red-950 text-red-300 px-2 py-0.5 rounded-full text-[10px]">
                        {merchResults.orphan?.length || 0}
                      </span>
                    </h2>
                    <span className="text-[10px] font-mono text-zinc-400">No matching order code found</span>
                  </div>
                  <div className="p-4">
                    {merchResults.orphan?.length === 0 ? (
                      <p className="text-xs font-mono text-zinc-500 py-2">No orphan payments found.</p>
                    ) : (
                      <ul className="space-y-2">
                        {merchResults.orphan.map((m: any, i: number) => (
                          <li key={i} className="flex justify-between items-center p-3 bg-[#041F1E] border border-[#084746] text-red-200 rounded-xl font-mono text-xs">
                            <span className="font-bold text-white">{m.orderCode}</span>
                            <span className="flex items-center gap-4">
                              <span className="text-red-400 font-bold">£{m.amount}</span>
                              {m.note && <span className="text-zinc-400 italic">({m.note})</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
