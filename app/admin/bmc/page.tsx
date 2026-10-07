'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  parseKclsuSalesForBmc,
  parseBmcFormResponses,
  generateBmcEmailContent,
  generateBmcMailMergeCsv,
  partitionRecipientsByDispatchStatus,
  DEFAULT_BMC_FORM_URL,
  BmcMemberRecipient,
  BmcRosterStats,
  BmcFormResponseRecord,
  BmcDispatchMap,
} from '@/lib/bmc_insurance';

export default function BmcInsuranceAdminPage() {
  const [mainTab, setMainTab] = useState<'broadcast' | 'responses'>('broadcast');

  // Broadcast & Roster state
  const [formUrl, setFormUrl] = useState(DEFAULT_BMC_FORM_URL);
  const [csvText, setCsvText] = useState('');
  const [recipients, setRecipients] = useState<BmcMemberRecipient[]>([]);
  const [allMembers, setAllMembers] = useState<BmcMemberRecipient[]>([]);
  const [stats, setStats] = useState<BmcRosterStats | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [subTab, setSubTab] = useState<'recipients' | 'preview'>('recipients');
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [copiedBcc, setCopiedBcc] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Anti-Duplicate & Dispatch Tracking State
  const [dispatches, setDispatches] = useState<BmcDispatchMap>({});
  const [skipAlreadySent, setSkipAlreadySent] = useState(true);
  const [filterSentStatus, setFilterSentStatus] = useState<'all' | 'unsent' | 'sent'>('all');
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const [serverSmtp, setServerSmtp] = useState<{ isConfigured: boolean; senderEmail: string } | null>(null);

  // Email Credentials & Broadcast State
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState<{
    success: boolean;
    message: string;
    sentCount?: number;
    failedCount?: number;
    failedEmails?: string[];
  } | null>(null);

  // Google Form Responses & Sync state
  const [responseCsvText, setResponseCsvText] = useState('');
  const [responseRecords, setResponseRecords] = useState<BmcFormResponseRecord[]>([]);
  const [responseStats, setResponseStats] = useState<{
    totalResponses: number;
    matchedCount: number;
    unmatchedCount: number;
    phoneNumbersFound: number;
  } | null>(null);
  const [responseSearchFilter, setResponseSearchFilter] = useState('');
  const [syncingDb, setSyncingDb] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Load server SMTP readiness and historical dispatches on mount
  useEffect(() => {
    // 1. Read cached dispatches from localStorage for zero-latency UI
    try {
      const cached = localStorage.getItem('kclmc_bmc_dispatches_2026');
      if (cached) {
        setDispatches(JSON.parse(cached));
      }
    } catch {}

    // 2. Fetch server SMTP environment configuration status
    fetch('/api/admin/bmc-insurance?action=status')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setServerSmtp({
            isConfigured: data.isSmtpConfigured,
            senderEmail: data.senderEmail,
          });
        }
      })
      .catch(() => {});

    // 3. Fetch server dispatch history from database
    fetch('/api/admin/bmc-insurance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get-dispatches' }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.dispatches) {
          setDispatches(prev => {
            const merged = { ...prev, ...data.dispatches };
            try {
              localStorage.setItem('kclmc_bmc_dispatches_2026', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);


  // Handle Sales CSV Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvText(text);
        processCsv(text, formUrl);
      }
    };
    reader.readAsText(file);
  };

  const processCsv = (raw: string, url: string) => {
    const result = parseKclsuSalesForBmc(raw, url);
    setRecipients(result.recipients);
    setAllMembers(result.allMembers);
    setStats(result.stats);
  };

  // Handle Google Form Response CSV Upload
  const handleResponseFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setResponseCsvText(text);
        processResponseCsv(text);
      }
    };
    reader.readAsText(file);
  };

  const processResponseCsv = (raw: string) => {
    const parsed = parseBmcFormResponses(raw, recipients);
    setResponseRecords(parsed.records);
    setResponseStats({
      totalResponses: parsed.totalResponses,
      matchedCount: parsed.matchedCount,
      unmatchedCount: parsed.unmatchedCount,
      phoneNumbersFound: parsed.phoneNumbersFound,
    });
  };

  const { unsentRecipients, alreadySentRecipients, allEnriched } = partitionRecipientsByDispatchStatus(
    recipients,
    dispatches
  );
  const unsentCount = unsentRecipients.length;
  const alreadySentCount = alreadySentRecipients.length;
  const targetRecipients = skipAlreadySent ? unsentRecipients : recipients;
  const skippedCount = skipAlreadySent ? alreadySentCount : 0;

  const downloadMailMergeCsv = () => {
    const exportList = skipAlreadySent ? unsentRecipients : recipients;
    if (exportList.length === 0) return;
    const csvContent = generateBmcMailMergeCsv(exportList, formUrl);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kclmc_bmc_insurance_recipients_${skipAlreadySent ? 'unsent_' : ''}${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyBccEmails = () => {
    const list = skipAlreadySent ? unsentRecipients : recipients;
    const bccList = list.map(r => r.email).join(', ');
    navigator.clipboard.writeText(bccList);
    setCopiedBcc(true);
    setTimeout(() => setCopiedBcc(false), 3000);
  };

  const sendTestEmail = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      setTestStatus({ success: false, message: 'Please enter a valid email address.' });
      return;
    }
    setSendingTest(true);
    setTestStatus(null);
    try {
      const res = await fetch('/api/admin/bmc-insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          csvText,
          formUrl,
          testEmail,
          memberIndex: selectedPreviewIndex,
          smtpUser: smtpUser.trim() || undefined,
          smtpPass: smtpPass.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus({ success: true, message: data.message || 'Test email dispatched!' });
      } else {
        setTestStatus({ success: false, message: data.error || 'Failed to dispatch test email.' });
      }
    } catch (err: any) {
      setTestStatus({ success: false, message: err.message || 'Network error sending test email.' });
    } finally {
      setSendingTest(false);
    }
  };

  const handleBroadcast = async () => {
    if (targetRecipients.length === 0) return;
    setBroadcasting(true);
    setBroadcastStatus(null);
    try {
      const res = await fetch('/api/admin/bmc-insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          csvText,
          formUrl,
          skipAlreadySent,
          smtpUser: smtpUser.trim() || undefined,
          smtpPass: smtpPass.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBroadcastStatus({
          success: true,
          message: `🎉 Broadcast Complete! Successfully dispatched to ${data.sentCount} member(s) (${data.skippedCount || 0} skipped as already sent, ${data.failedCount || 0} failed).`,
          sentCount: data.sentCount,
          failedCount: data.failedCount,
          failedEmails: data.failedEmails,
        });

        // Persist newly sent members to local dispatches state & localStorage
        if (data.newDispatches) {
          setDispatches(prev => {
            const updated = { ...prev, ...data.newDispatches };
            try {
              localStorage.setItem('kclmc_bmc_dispatches_2026', JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }

        setShowBroadcastModal(false);
        setConfirmCheckbox(false);
      } else {
        setBroadcastStatus({
          success: false,
          message: data.error || data.message || 'Failed to execute broadcast. Check SMTP credentials or edge limits.',
        });
      }
    } catch (err: any) {
      setBroadcastStatus({
        success: false,
        message: err.message || 'Network error executing broadcast.',
      });
    } finally {
      setBroadcasting(false);
    }
  };

  const syncResponsesToDb = async () => {
    const matchedRecords = responseRecords.filter(r => r.isMatched);
    if (matchedRecords.length === 0) {
      setSyncStatus({ success: false, message: 'No matched member records found to sync.' });
      return;
    }

    setSyncingDb(true);
    setSyncStatus(null);
    try {
      const res = await fetch('/api/admin/bmc-insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync-db',
          syncRecords: matchedRecords,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncStatus({
          success: true,
          message: `Successfully verified and synced ${data.updatedCount} member pass${data.updatedCount === 1 ? '' : 'es'} in the database!`,
        });
      } else {
        setSyncStatus({ success: false, message: data.error || 'Database sync encountered an error.' });
      }
    } catch (err: any) {
      setSyncStatus({ success: false, message: err.message || 'Network error syncing records.' });
    } finally {
      setSyncingDb(false);
    }
  };

  const filteredRecipients = allEnriched.filter(r => {
    const matchesSearch =
      r.formattedName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      r.cardNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
      r.email.toLowerCase().includes(searchFilter.toLowerCase());

    if (!matchesSearch) return false;
    if (filterSentStatus === 'unsent') return !r.isSent;
    if (filterSentStatus === 'sent') return r.isSent;
    return true;
  });

  const filteredResponses = responseRecords.filter(
    r =>
      r.fullName.toLowerCase().includes(responseSearchFilter.toLowerCase()) ||
      r.mobile.includes(responseSearchFilter) ||
      (r.studentId && r.studentId.toLowerCase().includes(responseSearchFilter.toLowerCase()))
  );

  const validPreviewIndex = recipients.length > 0
    ? Math.min(Math.max(0, selectedPreviewIndex), recipients.length - 1)
    : 0;
  const sampleMember = recipients.length > 0 ? recipients[validPreviewIndex] : null;
  const sampleEmail = sampleMember ? generateBmcEmailContent(sampleMember, formUrl) : null;


  return (
    <div className="min-h-screen bg-[#041F1E] text-slate-100 p-6 md:p-10 font-sans relative overflow-hidden topo-pattern">
      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-xs font-mono text-[#FFBD59] hover:text-white transition-colors"
          >
            ← Back to Committee Dashboard
          </Link>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-800">
            Preview Environment
          </span>
        </div>

        {/* Header */}
        <div className="border-b border-[#084746] pb-6 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD59] animate-pulse"></span>
            <span className="text-xs font-mono uppercase tracking-wider text-[#FFBD59]">
              Safety &amp; Compliance Engine
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black font-heading uppercase tracking-wide text-white">
            BMC Insurance Automation &amp; Pass Verification
          </h1>
          <p className="text-sm text-zinc-300 mt-2 max-w-2xl leading-relaxed">
            Distribute personalized pre-filled Google Form links to all official Recreational climbing members (including Social-to-Rec upgrades), and import form responses to sync verified phone numbers into member passes.
          </p>
        </div>

        {/* Main Tab Switcher */}
        <div className="flex border-b border-[#084746] mb-8 gap-4">
          <button
            onClick={() => setMainTab('broadcast')}
            className={`pb-3 font-heading font-black text-sm uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
              mainTab === 'broadcast'
                ? 'border-[#FFBD59] text-[#FFBD59]'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <span>✉️ 1. Broadcast &amp; Mail Merge</span>
            {recipients.length > 0 && (
              <span className="bg-[#084746] text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                {recipients.length} Rec
              </span>
            )}
          </button>

          <button
            onClick={() => setMainTab('responses')}
            className={`pb-3 font-heading font-black text-sm uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
              mainTab === 'responses'
                ? 'border-[#FFBD59] text-[#FFBD59]'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <span>📥 2. Import Responses &amp; Sync Passes</span>
            {responseRecords.length > 0 && (
              <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-mono">
                {responseRecords.length} Submissions
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: BROADCAST & MAIL MERGE */}
        {mainTab === 'broadcast' && (
          <>
            {/* Control Panel Card */}
            <div className="bg-[#052322] border border-[#084746] rounded-2xl p-6 shadow-xl mb-8 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* File Upload */}
                <div>
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#FFBD59] mb-2">
                    1. Upload KCLSU Purchasers Report (CSV)
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-zinc-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-mono file:font-bold file:bg-[#FFBD59] file:text-[#041F1E] hover:file:bg-white cursor-pointer bg-[#041F1E] border border-[#084746] rounded-xl p-2"
                  />
                  <p className="text-[11px] text-zinc-400 mt-2 font-mono">
                    System automatically classifies Recreational [10002480], Social [10166870], and Upgrades [10188720].
                  </p>
                </div>

                {/* Form URL Input */}
                <div>
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#FFBD59] mb-2">
                    2. Target Google Form URL
                  </label>
                  <input
                    type="text"
                    value={formUrl}
                    onChange={(e) => {
                      setFormUrl(e.target.value);
                      if (csvText) processCsv(csvText, e.target.value);
                    }}
                    placeholder="https://docs.google.com/forms/d/e/.../viewform"
                    className="w-full bg-[#041F1E] border border-[#084746] rounded-xl px-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FFBD59]"
                  />
                  <p className="text-[11px] text-emerald-400 mt-2 font-mono">
                    ⚡ Auto pre-fills Forename, Surname, and Student status for each member.
                  </p>
                </div>
              </div>
            </div>

            {/* Metrics Ribbon */}
            {stats && (
              <div className="space-y-4 mb-8">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div className="bg-[#052322] border border-[#084746] p-4 rounded-xl">
                    <p className="text-zinc-400 text-[10px] font-mono uppercase">Total Rows</p>
                    <p className="text-2xl font-black font-heading text-white">{stats.totalRows}</p>
                  </div>
                  <div className="bg-[#052322] border border-[#084746] p-4 rounded-xl">
                    <p className="text-zinc-400 text-[10px] font-mono uppercase">Unique Members</p>
                    <p className="text-2xl font-black font-heading text-white">{stats.totalUniqueMembers}</p>
                  </div>
                  <div className="bg-[#052322] border border-emerald-800/80 p-4 rounded-xl bg-emerald-950/20">
                    <p className="text-emerald-400 text-[10px] font-mono uppercase">Recreational (Eligible)</p>
                    <p className="text-2xl font-black font-heading text-emerald-400">{stats.recreationalCount}</p>
                  </div>
                  <div className="bg-[#052322] border border-amber-800/80 p-4 rounded-xl bg-amber-950/20">
                    <p className="text-amber-400 text-[10px] font-mono uppercase">Upgraded (Social➔Rec)</p>
                    <p className="text-2xl font-black font-heading text-amber-400">{stats.upgradedCount}</p>
                  </div>
                  <div className="bg-[#052322] border border-zinc-800 p-4 rounded-xl">
                    <p className="text-zinc-400 text-[10px] font-mono uppercase">Social Only (Excluded)</p>
                    <p className="text-2xl font-black font-heading text-zinc-400">{stats.socialCount}</p>
                  </div>
                </div>

                {/* Anti-Duplicate Tracking Ribbon */}
                {recipients.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-[#052322] border border-emerald-700/80 p-4 rounded-xl bg-emerald-950/30 flex items-center justify-between">
                      <div>
                        <p className="text-emerald-400 text-[10px] font-mono uppercase font-bold">Total Rec in Report</p>
                        <p className="text-2xl font-black font-heading text-white">{recipients.length}</p>
                      </div>
                      <span className="text-3xl">🏔️</span>
                    </div>

                    <div className="bg-[#052322] border border-emerald-800/80 p-4 rounded-xl bg-emerald-950/20 flex items-center justify-between">
                      <div>
                        <p className="text-emerald-400 text-[10px] font-mono uppercase font-bold">Already Emailed (Protected)</p>
                        <p className="text-2xl font-black font-heading text-emerald-300">{alreadySentCount}</p>
                      </div>
                      <span className="text-xs font-mono text-emerald-400 bg-emerald-900/60 px-2.5 py-1 rounded-lg border border-emerald-700/60 font-bold">
                        🛡️ No Duplicates
                      </span>
                    </div>

                    <div className="bg-[#052322] border border-amber-800/80 p-4 rounded-xl bg-amber-950/20 flex items-center justify-between">
                      <div>
                        <p className="text-amber-400 text-[10px] font-mono uppercase font-bold">New Members (Pending)</p>
                        <p className="text-2xl font-black font-heading text-amber-300">{unsentCount}</p>
                      </div>
                      <span className={`text-xs font-mono px-2.5 py-1 rounded-lg border font-bold ${
                        unsentCount > 0
                          ? 'text-amber-400 bg-amber-900/60 border-amber-700/60 animate-pulse'
                          : 'text-zinc-400 bg-zinc-800 border-zinc-700'
                      }`}>
                        {unsentCount > 0 ? `⚡ ${unsentCount} Ready` : '✓ Up to Date'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions Bar */}
            {recipients.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-[#052322] p-4 rounded-2xl border border-[#084746]">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={downloadMailMergeCsv}
                    className="px-4 py-2 bg-[#FFBD59] hover:bg-white text-[#041F1E] font-heading font-black text-xs uppercase tracking-wider rounded-xl transition-colors shadow-md flex items-center gap-2"
                  >
                    <span>📥 {skipAlreadySent && unsentCount < recipients.length ? `Download CSV (${unsentCount} Unsent)` : 'Download Mail Merge CSV'}</span>
                  </button>

                  <button
                    onClick={copyBccEmails}
                    className="px-4 py-2 bg-[#084746] hover:bg-[#0d5f5e] text-white font-mono text-xs font-bold rounded-xl border border-[#0D5F5E] transition-colors"
                  >
                    {copiedBcc ? `✓ Copied ${targetRecipients.length} Emails!` : `📋 Copy BCC (${targetRecipients.length})`}
                  </button>

                  {/* Anti-Duplicate Skip Toggle */}
                  <label className="flex items-center gap-2 bg-[#041F1E] px-3.5 py-2 rounded-xl border border-[#084746] cursor-pointer text-xs font-mono select-none hover:border-[#FFBD59]/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={skipAlreadySent}
                      onChange={(e) => setSkipAlreadySent(e.target.checked)}
                      className="accent-[#FFBD59] w-4 h-4 rounded cursor-pointer"
                    />
                    <span className="text-zinc-200">
                      Skip Emailed ({alreadySentCount})
                    </span>
                  </label>

                  {/* Mass Broadcast Button */}
                  <button
                    onClick={() => {
                      setShowBroadcastModal(true);
                      setConfirmCheckbox(false);
                    }}
                    disabled={targetRecipients.length === 0}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-[#041F1E] font-heading font-black text-xs uppercase tracking-wider rounded-xl transition-colors shadow-md flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {targetRecipients.length === 0 ? (
                      <span>✓ All {recipients.length} Rec Members Emailed</span>
                    ) : skipAlreadySent ? (
                      <span>🚀 Broadcast to {targetRecipients.length} New Members</span>
                    ) : (
                      <span>🚀 Broadcast to All {recipients.length} Rec Members (Force Re-send)</span>
                    )}
                  </button>

                  {/* Sender Config Indicator / Override Drawer Toggle */}
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`px-3 py-2 bg-[#041F1E] hover:bg-[#084746] font-mono text-xs rounded-xl border transition-colors flex items-center gap-1.5 ${
                      smtpUser || serverSmtp?.isConfigured
                        ? 'text-emerald-400 border-emerald-800/80'
                        : 'text-amber-400 border-amber-800/80'
                    }`}
                    title="Sender credentials configuration"
                  >
                    <span>⚙️ Sender: {smtpUser || serverSmtp?.senderEmail || 'kclmc.committee@gmail.com'}</span>
                    <span className="text-[10px] bg-[#052322] px-1.5 py-0.5 rounded border border-current">
                      {smtpUser ? 'Custom' : serverSmtp?.isConfigured ? 'Env ✓' : 'Setup'}
                    </span>
                  </button>
                </div>

                {/* Sub Tab Switcher */}
                <div className="flex bg-[#041F1E] p-1 rounded-xl border border-[#084746]">
                  <button
                    onClick={() => setSubTab('recipients')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
                      subTab === 'recipients' ? 'bg-[#FFBD59] text-[#041F1E]' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Roster ({filteredRecipients.length})
                  </button>
                  <button
                    onClick={() => setSubTab('preview')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
                      subTab === 'preview' ? 'bg-[#FFBD59] text-[#041F1E]' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Email Preview
                  </button>
                </div>
              </div>
            )}

            {/* Sender Credentials Drawer */}
            {showSettings && (
              <div className="bg-[#052322] border border-[#FFBD59]/40 rounded-2xl p-6 shadow-xl mb-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-black text-xs uppercase tracking-wider text-[#FFBD59]">
                    ⚙️ SMTP / Gmail Dispatch Credentials
                  </h3>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    ✕ Close
                  </button>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                  Optional. If left blank, the server uses environment secrets (<code>GMAIL_USER</code> and <code>GMAIL_APP_PASS</code>). Enter your credentials below if you have not configured worker secrets.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">Committee Sender Email:</label>
                    <input
                      type="email"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      placeholder="kclmc.committee@gmail.com"
                      className="w-full bg-[#041F1E] border border-[#084746] rounded-xl px-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FFBD59]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                      Google App Password (16 chars):
                    </label>
                    <input
                      type="password"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="abcd efgh ijkl mnop"
                      className="w-full bg-[#041F1E] border border-[#084746] rounded-xl px-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FFBD59]"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 font-mono">
                  💡 Note: Regular passwords will fail with 2FA. Generate an App Password at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-[#FFBD59] underline">myaccount.google.com/apppasswords</a>.
                </p>
              </div>
            )}

            {/* Broadcast Status Notification */}
            {broadcastStatus && (
              <div
                className={`p-4 rounded-xl border mb-6 text-xs font-mono leading-relaxed ${
                  broadcastStatus.success
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                    : 'bg-red-950/60 border-red-500 text-red-300'
                }`}
              >
                <p className="font-bold">{broadcastStatus.message}</p>
                {broadcastStatus.failedEmails && broadcastStatus.failedEmails.length > 0 && (
                  <p className="mt-1 text-red-400">
                    Failed recipients: {broadcastStatus.failedEmails.join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Recipient Roster View */}
            {recipients.length > 0 && subTab === 'recipients' && (
              <div className="bg-[#052322] border border-[#084746] rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search member name, K-number, or email..."
                    className="bg-[#041F1E] border border-[#084746] rounded-xl px-4 py-2 text-xs font-mono text-white w-full max-w-sm focus:outline-none focus:border-[#FFBD59]"
                  />

                  <div className="flex items-center gap-2">
                    <div className="flex bg-[#041F1E] p-1 rounded-xl border border-[#084746] text-xs font-mono">
                      <button
                        onClick={() => setFilterSentStatus('all')}
                        className={`px-2.5 py-1 rounded-lg transition-colors ${
                          filterSentStatus === 'all' ? 'bg-[#FFBD59] text-[#041F1E] font-bold' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        All ({allEnriched.length})
                      </button>
                      <button
                        onClick={() => setFilterSentStatus('unsent')}
                        className={`px-2.5 py-1 rounded-lg transition-colors ${
                          filterSentStatus === 'unsent' ? 'bg-amber-400 text-[#041F1E] font-bold' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        ⚡ New ({unsentCount})
                      </button>
                      <button
                        onClick={() => setFilterSentStatus('sent')}
                        className={`px-2.5 py-1 rounded-lg transition-colors ${
                          filterSentStatus === 'sent' ? 'bg-emerald-400 text-[#041F1E] font-bold' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        ✉️ Emailed ({alreadySentCount})
                      </button>
                    </div>

                    <span className="text-xs font-mono text-zinc-400 hidden sm:inline">
                      Showing {filteredRecipients.length} of {recipients.length}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#084746]">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-[#041F1E] text-zinc-400 font-mono uppercase text-[10px] border-b border-[#084746]">
                      <tr>
                        <th className="py-3 px-4">Student ID</th>
                        <th className="py-3 px-4">Member Name</th>
                        <th className="py-3 px-4">KCL Email</th>
                        <th className="py-3 px-4">Tier</th>
                        <th className="py-3 px-4">Dispatch Status</th>
                        <th className="py-3 px-4">Prefilled Form Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#084746] text-zinc-300">
                      {filteredRecipients.map((m) => (
                        <tr key={m.cardNumber} className="hover:bg-[#084746]/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-white">{m.cardNumber}</td>
                          <td className="py-3 px-4 font-medium text-white">{m.formattedName}</td>
                          <td className="py-3 px-4 font-mono text-[#FFBD59]">{m.email}</td>
                          <td className="py-3 px-4">
                            {m.isUpgradedFromSocial ? (
                              <span className="bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-mono px-2 py-0.5 rounded">
                                Upgraded Rec
                              </span>
                            ) : (
                              <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded">
                                Recreational
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {m.isSent ? (
                              <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1 w-max">
                                <span>✓ Emailed</span>
                                {m.sentAt && <span className="text-[9px] text-emerald-400">({new Date(m.sentAt).toLocaleDateString()})</span>}
                              </span>
                            ) : (
                              <span className="bg-amber-950/70 text-amber-300 border border-amber-800/60 text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1 w-max">
                                <span>⚡ Unsent</span>
                                <span className="text-[9px] text-amber-400/80">(New)</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono">
                            <a
                              href={m.prefilledFormUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-emerald-400 hover:text-white underline inline-flex items-center gap-1"
                            >
                              Test Prefill ↗
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Email Preview & Test Dispatch View */}
            {recipients.length > 0 && subTab === 'preview' && sampleEmail && sampleMember && (
              <div className="space-y-6">
                {/* Member Switcher Toolbar */}
                <div className="bg-[#052322] border border-[#084746] rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-mono text-[#FFBD59] font-bold uppercase tracking-wider">
                      Select Member to Preview:
                    </span>
                    <button
                      onClick={() => setSelectedPreviewIndex(prev => Math.max(0, prev - 1))}
                      disabled={validPreviewIndex === 0}
                      className="px-3 py-1.5 text-xs font-mono bg-[#041F1E] border border-[#084746] hover:border-[#FFBD59] rounded-xl disabled:opacity-40 text-white transition-colors flex items-center gap-1"
                      title="Previous member"
                    >
                      ◀ Prev
                    </button>
                    <select
                      value={validPreviewIndex}
                      onChange={(e) => setSelectedPreviewIndex(parseInt(e.target.value, 10))}
                      className="bg-[#041F1E] border border-[#084746] text-white text-xs font-mono rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#FFBD59] max-w-[280px] sm:max-w-md truncate"
                    >
                      {recipients.map((r, idx) => (
                        <option key={r.cardNumber} value={idx}>
                          #{idx + 1}: {r.formattedName} ({r.cardNumber}) {r.isUpgradedFromSocial ? '⚡ Upgraded' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setSelectedPreviewIndex(prev => Math.min(recipients.length - 1, prev + 1))}
                      disabled={validPreviewIndex === recipients.length - 1}
                      className="px-3 py-1.5 text-xs font-mono bg-[#041F1E] border border-[#084746] hover:border-[#FFBD59] rounded-xl disabled:opacity-40 text-white transition-colors flex items-center gap-1"
                      title="Next member"
                    >
                      Next ▶
                    </button>
                  </div>

                  <a
                    href={sampleMember.prefilledFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-emerald-400 hover:text-white underline inline-flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-800 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <span>Test {sampleMember.firstName}&apos;s Google Form Prefill ↗</span>
                  </a>
                </div>

                {/* Personalization Assurance Notice */}
                <div className="p-4 bg-emerald-950/40 border border-emerald-800/80 rounded-2xl text-xs font-mono text-emerald-300 flex items-start gap-3">
                  <span className="text-base">🛡️</span>
                  <div>
                    <strong className="text-white">Personalization Verification:</strong>
                    <p className="mt-1 text-zinc-300 font-sans text-xs leading-relaxed">
                      You are previewing template output for recipient <strong>#{validPreviewIndex + 1} of {recipients.length}</strong> ({sampleMember.formattedName}). When you trigger the mass broadcast, the engine automatically iterates through all <strong>{recipients.length} members</strong>. Every recipient receives an individual email with their own name, student ID, and distinct prefilled Google Form URL.
                    </p>
                  </div>
                </div>

                <div className="grid lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-8 bg-[#052322] border border-[#084746] rounded-2xl p-6 shadow-xl">
                    <div className="border-b border-[#084746] pb-4 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-[#FFBD59]">Subject Line:</span>
                        <span className="text-[11px] font-mono text-emerald-400">
                          Recipient: {sampleMember.email}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white mt-1">{sampleEmail.subject}</h3>
                    </div>

                    <div className="rounded-xl overflow-hidden border border-[#084746] bg-slate-200">
                      <iframe
                        srcDoc={sampleEmail.html}
                        title="Email Preview"
                        className="w-full h-[620px] border-0"
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-4 bg-[#052322] border border-[#084746] rounded-2xl p-6 shadow-xl space-y-4">
                    <h3 className="font-heading font-black text-sm uppercase text-[#FFBD59] tracking-wider">
                      🧪 Send Test Email
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                      Verify the personalized template in your inbox before broadcasting to all members.
                    </p>

                    <div className="bg-[#041F1E] p-3.5 rounded-xl border border-[#084746] text-xs font-mono space-y-1.5">
                      <div className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
                        Active Sample Recipient:
                      </div>
                      <div className="text-[#FFBD59] font-bold text-sm">
                        {sampleMember.formattedName}
                      </div>
                      <div className="text-[11px] text-zinc-300 flex justify-between">
                        <span>Student ID: {sampleMember.cardNumber}</span>
                        <span className="text-emerald-400">
                          {sampleMember.isUpgradedFromSocial ? 'Upgraded' : 'Recreational'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-zinc-400 mb-1">Send Test To Your Inbox:</label>
                      <input
                        type="email"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        placeholder="committee@kclmc.org"
                        className="w-full bg-[#041F1E] border border-[#084746] rounded-xl px-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FFBD59]"
                      />
                    </div>

                    <button
                      onClick={sendTestEmail}
                      disabled={sendingTest}
                      className="w-full py-2.5 bg-[#084746] hover:bg-[#0d5f5e] text-white font-mono font-bold text-xs rounded-xl border border-[#0D5F5E] transition-colors disabled:opacity-50"
                    >
                      {sendingTest
                        ? 'Sending via SMTP...'
                        : `Dispatch Test Email as ${sampleMember.firstName} →`}
                    </button>

                    {testStatus && (
                      <div
                        className={`p-3 rounded-xl border text-xs font-mono leading-relaxed ${
                          testStatus.success
                            ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                            : 'bg-red-950/60 border-red-500 text-red-300'
                        }`}
                      >
                        {testStatus.message}
                      </div>
                    )}

                    <div className="pt-4 border-t border-[#084746]">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase">CLI Command Alternative:</span>
                      <pre className="mt-2 p-3 bg-[#041F1E] rounded-xl text-[11px] font-mono text-[#FFBD59] overflow-x-auto">
                        npx tsx scripts/send_bmc_insurance_emails.ts --test your-email@kcl.ac.uk
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: IMPORT RESPONSES & SYNC PASSES */}
        {mainTab === 'responses' && (
          <>
            {/* Responses Upload Card */}
            <div className="bg-[#052322] border border-[#084746] rounded-2xl p-6 shadow-xl mb-8 space-y-4">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#FFBD59]">
                Upload Google Form Responses (CSV)
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleResponseFileUpload}
                className="block w-full text-xs text-zinc-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-mono file:font-bold file:bg-[#FFBD59] file:text-[#041F1E] hover:file:bg-white cursor-pointer bg-[#041F1E] border border-[#084746] rounded-xl p-2"
              />
              <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                Export responses from Google Forms (Responses → View in Sheets → Download as CSV), then drop the CSV here. The engine automatically matches Forenames &amp; Surnames to active Recreational members and extracts verified phone numbers.
              </p>
            </div>

            {/* Response Metrics Ribbon */}
            {responseStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-[#052322] border border-[#084746] p-4 rounded-xl">
                  <p className="text-zinc-400 text-[10px] font-mono uppercase">Form Submissions</p>
                  <p className="text-2xl font-black font-heading text-white">{responseStats.totalResponses}</p>
                </div>
                <div className="bg-[#052322] border border-emerald-800 p-4 rounded-xl bg-emerald-950/20">
                  <p className="text-emerald-400 text-[10px] font-mono uppercase">Matched to Roster</p>
                  <p className="text-2xl font-black font-heading text-emerald-400">{responseStats.matchedCount}</p>
                </div>
                <div className="bg-[#052322] border border-cyan-800 p-4 rounded-xl bg-cyan-950/20">
                  <p className="text-cyan-400 text-[10px] font-mono uppercase">Phone Numbers Extracted</p>
                  <p className="text-2xl font-black font-heading text-cyan-400">{responseStats.phoneNumbersFound}</p>
                </div>
                <div className="bg-[#052322] border border-zinc-800 p-4 rounded-xl">
                  <p className="text-zinc-400 text-[10px] font-mono uppercase">Unmatched Names</p>
                  <p className="text-2xl font-black font-heading text-zinc-400">{responseStats.unmatchedCount}</p>
                </div>
              </div>
            )}

            {/* Sync Action Header */}
            {responseRecords.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-[#052322] p-4 rounded-2xl border border-[#084746]">
                <div>
                  <h3 className="font-heading font-black text-sm uppercase text-white">
                    Sync Verified Responses to Database
                  </h3>
                  <p className="text-xs text-zinc-300">
                    Will update member profiles with verified phone numbers and activate the "BMC Insured 🛡️" pass badge.
                  </p>
                </div>

                <button
                  onClick={syncResponsesToDb}
                  disabled={syncingDb}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-[#041F1E] font-heading font-black text-xs uppercase tracking-wider rounded-xl transition-colors shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  <span>{syncingDb ? 'Syncing Passes...' : '⚡ Sync Verified Passes to Database'}</span>
                </button>
              </div>
            )}

            {syncStatus && (
              <div
                className={`p-4 rounded-xl border mb-6 text-xs font-mono leading-relaxed ${
                  syncStatus.success
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                    : 'bg-red-950/60 border-red-500 text-red-300'
                }`}
              >
                {syncStatus.message}
              </div>
            )}

            {/* Responses Table */}
            {responseRecords.length > 0 && (
              <div className="bg-[#052322] border border-[#084746] rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <input
                    type="text"
                    value={responseSearchFilter}
                    onChange={(e) => setResponseSearchFilter(e.target.value)}
                    placeholder="Filter responses by name or phone..."
                    className="bg-[#041F1E] border border-[#084746] rounded-xl px-4 py-2 text-xs font-mono text-white w-full max-w-sm focus:outline-none focus:border-[#FFBD59]"
                  />
                  <span className="text-xs font-mono text-zinc-400">
                    Showing {filteredResponses.length} of {responseRecords.length} submissions
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#084746]">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-[#041F1E] text-zinc-400 font-mono uppercase text-[10px] border-b border-[#084746]">
                      <tr>
                        <th className="py-3 px-4">Member Name</th>
                        <th className="py-3 px-4">Matched Student ID</th>
                        <th className="py-3 px-4">Verified Mobile</th>
                        <th className="py-3 px-4">DOB / Location</th>
                        <th className="py-3 px-4">Match Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#084746] text-zinc-300">
                      {filteredResponses.map((r, idx) => (
                        <tr key={idx} className="hover:bg-[#084746]/40 transition-colors">
                          <td className="py-3 px-4 font-medium text-white">{r.fullName}</td>
                          <td className="py-3 px-4 font-mono font-bold text-[#FFBD59]">
                            {r.studentId || '—'}
                          </td>
                          <td className="py-3 px-4 font-mono text-emerald-300">{r.mobile || '—'}</td>
                          <td className="py-3 px-4 text-zinc-400">
                            {r.dob ? `${r.dob}` : ''} {r.city ? `• ${r.city}` : ''}
                          </td>
                          <td className="py-3 px-4">
                            {r.isMatched ? (
                              <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded">
                                Matched Roster ✅
                              </span>
                            ) : (
                              <span className="bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-mono px-2 py-0.5 rounded">
                                Unmatched Name ⚠️
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* Broadcast Confirmation Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#052322] border border-[#084746] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="font-heading font-black text-lg text-white uppercase tracking-wide">
                  Confirm Mass Email Broadcast
                </h3>
                <p className="text-xs font-mono text-[#FFBD59]">Safety &amp; Compliance Dispatch</p>
              </div>
            </div>

            <div className="bg-[#041F1E] p-4 rounded-xl border border-[#084746] space-y-2.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-400">Total in Uploaded Roster:</span>
                <span className="text-white font-bold">{recipients.length} Rec Members</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Will Receive Email Now:</span>
                <span className="text-emerald-400 font-bold">🟢 {targetRecipients.length} Member(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Skipped (Duplicate Protection):</span>
                <span className="text-amber-400 font-bold">🛡️ {skippedCount} Member(s) Emailed Previously</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Social Members (Excluded):</span>
                <span className="text-zinc-400">{stats?.socialCount || 0} Members</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Sender Account:</span>
                <span className="text-[#FFBD59]">
                  {smtpUser || serverSmtp?.senderEmail || 'kclmc.committee@gmail.com'}
                  {serverSmtp?.isConfigured && !smtpUser ? ' (Server Env)' : ''}
                </span>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed font-sans">
              Each recipient will receive an individual personalized email with their unique Google Form link.
              {skippedCount > 0 && skipAlreadySent && (
                <span className="block mt-1 text-emerald-400 font-mono text-[11px]">
                  ✓ Duplicate protection active: {skippedCount} member(s) previously emailed will NOT receive duplicates.
                </span>
              )}
            </p>

            {/* Mandatory Confirmation Checkbox Gate */}
            <div className="bg-[#041F1E] p-3.5 rounded-xl border border-[#FFBD59]/40">
              <label className="flex items-start gap-3 cursor-pointer text-xs font-sans text-white select-none">
                <input
                  type="checkbox"
                  checked={confirmCheckbox}
                  onChange={(e) => setConfirmCheckbox(e.target.checked)}
                  className="mt-0.5 accent-[#FFBD59] w-4 h-4 rounded cursor-pointer"
                />
                <span className="leading-snug">
                  I confirm that I want to dispatch official BMC Insurance emails to these <strong>{targetRecipients.length} member(s)</strong>.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowBroadcastModal(false);
                  setConfirmCheckbox(false);
                }}
                disabled={broadcasting}
                className="px-4 py-2 bg-[#041F1E] hover:bg-[#084746] text-zinc-300 font-mono text-xs rounded-xl border border-[#084746] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleBroadcast}
                disabled={broadcasting || !confirmCheckbox || targetRecipients.length === 0}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-[#041F1E] font-heading font-black text-xs uppercase tracking-wider rounded-xl transition-colors shadow-md disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
              >
                {broadcasting ? (
                  <>
                    <span className="w-3 h-3 rounded-full border-2 border-[#041F1E] border-t-transparent animate-spin"></span>
                    <span>Broadcasting to {targetRecipients.length}...</span>
                  </>
                ) : (
                  <span>🚀 Confirm &amp; Dispatch to {targetRecipients.length} Members</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
