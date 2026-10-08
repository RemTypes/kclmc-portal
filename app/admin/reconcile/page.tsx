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
  const [rawTransactionCount, setRawTransactionCount] = useState(0);
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
    const rawLines = text.split('\n').filter(l => l.trim().length > 0 && (l.includes(',K') || l.includes('K2') || l.includes('K1')));
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
              <span className="text-xs font-mono font-bold text-[#FFBD59]">KCLSU Roster &amp; Reconciliation</span>
            </div>
            <h1 className="text-3xl font-black font-heading uppercase tracking-wide text-white mt-2">
              Reconciliation &amp; Roster Sync
            </h1>
            <p className="text-sm text-zinc-300 mt-1">
              Synchronize official KCLSU sales exports directly into your Supabase database and reconcile pre-order payments.
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
        <div className="flex space-x-2 border-b border-[#084746] mb-8 font-mono text-xs">
          <button
            onClick={() => setActiveTab('roster')}
            className={`pb-3 px-4 font-bold uppercase transition-all flex items-center gap-2 border-b-2 ${
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
            onClick={() => setActiveTab('merch')}
            className={`pb-3 px-4 font-bold uppercase transition-all flex items-center gap-2 border-b-2 ${
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
                          <td className="p-4 font-bold text-white font-sans">{m.name}</td>
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

        {/* TAB 2: Merch Drop Reconciliation */}
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
