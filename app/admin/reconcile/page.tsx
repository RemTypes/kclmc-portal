'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { parseKclsuCsv, KclsuMemberRecord } from '@/lib/roster';

export default function ReconcilePage() {
  const [activeTab, setActiveTab] = useState<'roster' | 'merch'>('roster');
  const [dragActive, setDragActive] = useState(false);

  // Roster Sync states
  const [rosterCsvText, setRosterCsvText] = useState('');
  const [parsedMembers, setParsedMembers] = useState<KclsuMemberRecord[]>([]);
  const [rosterSyncLoading, setRosterSyncLoading] = useState(false);
  const [rosterSyncResult, setRosterSyncResult] = useState<{
    success: boolean;
    source: string;
    message: string;
    totalSynced?: number;
  } | null>(null);

  // Live database stats
  const [dbStats, setDbStats] = useState<{
    source: string;
    total: number;
    socialCount: number;
    recreationalCount: number;
  } | null>(null);

  // Merch drop states
  const [merchResults, setMerchResults] = useState<any>(null);

  // Fetch current database roster stats on mount
  useEffect(() => {
    fetchDbStats();
  }, []);

  const fetchDbStats = async () => {
    try {
      const res = await fetch('/api/roster');
      const data = await res.json();
      if (res.ok) {
        setDbStats({
          source: data.source,
          total: data.total,
          socialCount: data.socialCount,
          recreationalCount: data.recreationalCount,
        });
      }
    } catch (err) {
      console.error('Error fetching roster stats:', err);
    }
  };

  const handleRosterFile = (text: string) => {
    setRosterCsvText(text);
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
      } else {
        processMerchCSV(text);
      }
    }
  };

  const loadSampleMerch = () => {
    const sampleCSV = `Date,Order ID,Name,Email,Amount,Note\n2026-09-13,KCL-1234,Alice,alice@example.com,20,\n2026-09-13,LUB-5678,Bob,bob@example.com,20,Deposit\n2026-09-13,UNK-9999,Charlie,c@example.com,15,Missing Order`;
    processMerchCSV(sampleCSV);
  };

  return (
    <div className="min-h-screen bg-[#041F1E] text-zinc-100 p-6 md:p-12 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b border-[#FFBD59]/20 font-mono">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#084746] border border-[#FFBD59]/40 text-[#FFBD59] text-xs uppercase tracking-widest mb-2">
              Committee Admin Tools
            </div>
            <h1 className="text-3xl md:text-4xl font-black font-serif text-[#FFBD59]">
              Reconciliation &amp; Roster Sync
            </h1>
            <p className="text-zinc-400 text-xs mt-1">
              Synchronize official KCLSU purchase exports directly into your Supabase database.
            </p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 rounded-xl bg-[#084746] hover:bg-[#0b5c5b] text-[#FFBD59] text-xs font-mono border border-[#FFBD59]/40 transition-colors"
          >
            ← Admin Hub
          </Link>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 mb-6 border-b border-zinc-800 pb-2">
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-5 py-2.5 rounded-xl font-mono text-xs uppercase font-bold transition-all ${
              activeTab === 'roster'
                ? 'bg-[#FFBD59] text-[#052322] shadow-lg'
                : 'bg-[#084746]/50 text-zinc-400 hover:text-white'
            }`}
          >
            📋 KCLSU Member Roster Sync
          </button>
          <button
            onClick={() => setActiveTab('merch')}
            className={`px-5 py-2.5 rounded-xl font-mono text-xs uppercase font-bold transition-all ${
              activeTab === 'merch'
                ? 'bg-[#FFBD59] text-[#052322] shadow-lg'
                : 'bg-[#084746]/50 text-zinc-400 hover:text-white'
            }`}
          >
            👕 Merch Drop Reconciliation
          </button>
        </div>

        {/* Database Live Status Card */}
        {activeTab === 'roster' && dbStats && (
          <div className="mb-6 p-4 bg-[#084746]/60 border border-[#FFBD59]/30 rounded-2xl flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${dbStats.source === 'supabase' ? 'bg-emerald-400 animate-pulse' : 'bg-yellow-400'}`}></span>
              <div>
                <span className="font-bold text-white uppercase">
                  Current Database Roster: {dbStats.total} Members
                </span>
                <span className="text-zinc-400 ml-2">
                  ({dbStats.recreationalCount} Recreational, {dbStats.socialCount} Social)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-zinc-400">
                Source: {dbStats.source === 'supabase' ? 'Supabase Postgres' : 'Local Roster Fallback'}
              </span>
              <button
                onClick={fetchDbStats}
                className="text-[11px] text-[#FFBD59] hover:underline"
              >
                Refresh ↻
              </button>
            </div>
          </div>
        )}

        {/* Drag and Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-3xl p-10 text-center mb-8 transition-colors ${
            dragActive
              ? 'border-[#FFBD59] bg-[#084746]/80'
              : 'border-[#FFBD59]/30 bg-[#084746]/40 hover:border-[#FFBD59]/60'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <div className="text-5xl mb-3">📄</div>
          <h3 className="text-lg font-bold font-serif text-white mb-1">
            {activeTab === 'roster' ? 'Drop KCLSU Membership CSV Here' : 'Drop KCLSU Merch Payment CSV Here'}
          </h3>
          <p className="text-xs text-zinc-300 max-w-md mx-auto mb-4 font-mono">
            {activeTab === 'roster'
              ? 'Accepts official student union purchase export with card_number, purchaser, product_name, and transaction_id.'
              : 'The 3-tier matching engine will automatically pair payments to pending merch order passes.'}
          </p>
          <div className="flex justify-center items-center gap-3">
            <label className="cursor-pointer px-4 py-2 bg-[#FFBD59] hover:bg-[#FFE0A3] text-[#052322] font-mono text-xs font-bold rounded-xl transition-colors">
              <span>Select CSV File</span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (e) => {
                  if (e.target.files && e.target.files[0]) {
                    const text = await e.target.files[0].text();
                    if (activeTab === 'roster') {
                      handleRosterFile(text);
                    } else {
                      processMerchCSV(text);
                    }
                  }
                }}
              />
            </label>
            {activeTab === 'merch' && (
              <button
                onClick={loadSampleMerch}
                className="px-4 py-2 bg-[#041F1E] border border-[#FFBD59]/40 text-[#FFBD59] font-mono text-xs font-bold rounded-xl hover:bg-[#06302e] transition-colors"
              >
                Load Sample Data
              </button>
            )}
          </div>
        </div>

        {/* Roster Preview & Sync Controls */}
        {activeTab === 'roster' && parsedMembers.length > 0 && (
          <div className="bg-[#084746]/60 border border-[#FFBD59]/30 rounded-3xl p-6 mb-8 font-mono text-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-zinc-700">
              <div>
                <h2 className="text-lg font-bold font-serif text-white">
                  Parsed CSV Roster: {parsedMembers.length} Members
                </h2>
                <p className="text-zinc-400 text-xs">
                  {parsedMembers.filter((m) => m.tier === 'recreational').length} Recreational •{' '}
                  {parsedMembers.filter((m) => m.tier === 'social').length} Social
                </p>
              </div>
              <button
                onClick={handleSyncRosterToDb}
                disabled={rosterSyncLoading}
                className="px-6 py-3 bg-[#FFBD59] hover:bg-[#FFE0A3] text-[#052322] font-bold uppercase rounded-xl transition-colors shadow disabled:opacity-50"
              >
                {rosterSyncLoading ? 'Synchronizing to Supabase...' : 'Sync Roster to Database ⚡'}
              </button>
            </div>

            {/* Sync Feedback Message */}
            {rosterSyncResult && (
              <div
                className={`p-4 rounded-xl mb-6 flex items-center justify-between ${
                  rosterSyncResult.success
                    ? 'bg-emerald-950/80 border border-emerald-500/60 text-emerald-300'
                    : 'bg-red-950/80 border border-red-500/60 text-red-300'
                }`}
              >
                <span>{rosterSyncResult.success ? '✔' : '✖'} {rosterSyncResult.message}</span>
                <span className="text-[10px] text-zinc-400">Target: {rosterSyncResult.source}</span>
              </div>
            )}

            {/* Preview Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-zinc-400 border-b border-zinc-700">
                    <th className="pb-2">KCL Student ID</th>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Tier</th>
                    <th className="pb-2">Transaction ID</th>
                    <th className="pb-2">Purchase Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {parsedMembers.slice(0, 10).map((m, i) => (
                    <tr key={i} className="hover:bg-black/20">
                      <td className="py-2.5 font-bold text-white">{m.cardNumber}</td>
                      <td className="py-2.5 text-zinc-200">{m.name}</td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            m.tier === 'recreational'
                              ? 'bg-[#FFBD59]/20 text-[#FFBD59]'
                              : 'bg-emerald-400/20 text-emerald-300'
                          }`}
                        >
                          {m.tier}
                        </span>
                      </td>
                      <td className="py-2.5 text-zinc-400">{m.transactionId}</td>
                      <td className="py-2.5 text-zinc-400">{m.purchaseDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedMembers.length > 10 && (
                <p className="text-center text-zinc-500 mt-4 text-[11px]">
                  + {parsedMembers.length - 10} more members in upload
                </p>
              )}
            </div>
          </div>
        )}

        {/* Merch Results Breakdown */}
        {activeTab === 'merch' && merchResults && (
          <div className="grid gap-6">
            <div className="bg-zinc-900 rounded-2xl border border-emerald-500/40 p-6">
              <h2 className="text-sm font-mono uppercase font-bold mb-4 text-emerald-400">
                Matched ({merchResults.matched.length})
              </h2>
              <ul className="space-y-2">
                {merchResults.matched.map((m: any, i: number) => (
                  <li key={i} className="flex justify-between p-3 bg-emerald-950/40 text-emerald-200 rounded-xl font-mono text-xs">
                    <span className="font-bold">{m.orderCode}</span>
                    <span>£{m.amount}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-zinc-900 rounded-2xl border border-yellow-500/40 p-6">
              <h2 className="text-sm font-mono uppercase font-bold mb-4 text-yellow-400">
                Partial Payments ({merchResults.partial.length})
              </h2>
              <ul className="space-y-2">
                {merchResults.partial.map((m: any, i: number) => (
                  <li key={i} className="flex justify-between p-3 bg-yellow-950/40 text-yellow-200 rounded-xl font-mono text-xs">
                    <span className="font-bold">{m.orderCode}</span>
                    <span>Paid: £{m.amount} / Expected: £{m.expected}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-zinc-900 rounded-2xl border border-red-500/40 p-6">
              <h2 className="text-sm font-mono uppercase font-bold mb-4 text-red-400">
                Orphan Payments ({merchResults.orphan.length})
              </h2>
              <ul className="space-y-2">
                {merchResults.orphan.map((m: any, i: number) => (
                  <li key={i} className="flex justify-between p-3 bg-red-950/40 text-red-200 rounded-xl font-mono text-xs">
                    <span className="font-bold">{m.orderCode}</span>
                    <span className="flex gap-4">
                      <span>£{m.amount}</span>
                      {m.note && <span className="text-red-400 italic">{m.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
