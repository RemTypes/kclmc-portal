'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { generateMembersVCard, validatePhoneNumber } from '@/lib/safety';
import { isCompleteFullName } from '@/lib/roster';

interface RosterMember {
  cardNumber: string;
  name: string;
  tier: 'social' | 'recreational';
  purchaseDate?: string;
  phone?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  university?: string;
  safetyComplete?: boolean;
  email?: string | null;
}

export default function ExportPage() {
  const [activeTab, setActiveTab] = useState<'safety' | 'sizing'>('safety');

  // Merch matrix states
  const [matrix, setMatrix] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Safety directory states
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  // In-portal name curation states (Layer 4)
  const [editingMember, setEditingMember] = useState<{ cardNumber: string; currentName: string } | null>(null);
  const [editedNameInput, setEditedNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    // Detect Web Share API file support (iOS Safari & Android Chrome)
    if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
      try {
        const dummy = new File([''], 'test.vcf', { type: 'text/vcard' });
        setCanShareFiles(navigator.canShare({ files: [dummy] }));
      } catch {
        setCanShareFiles(false);
      }
    }

    // 1. Fetch Orders for Sizing Matrix
    fetch('/api/orders')
      .then((res) => res.json())
      .then((data) => {
        const breakdown: Record<string, Record<string, number>> = {};
        if (Array.isArray(data)) {
          data.forEach((order: any) => {
            order.items?.forEach((item: any) => {
              if (!breakdown[item.name]) {
                breakdown[item.name] = { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0, Total: 0 };
              }
              if (breakdown[item.name][item.size] !== undefined) {
                breakdown[item.name][item.size]++;
                breakdown[item.name].Total++;
              }
            });
          });
        }
        const rows = Object.keys(breakdown).map((garment) => ({
          name: garment,
          ...breakdown[garment],
        }));
        setMatrix(rows);
      })
      .catch((err) => {
        console.error('Error fetching orders for sizing export:', err);
      })
      .finally(() => {
        setLoadingOrders(false);
      });

    // 2. Fetch Roster with Profile Safety Info
    fetch('/api/roster')
      .then((res) => res.json())
      .then((data) => {
        if (data?.members && Array.isArray(data.members)) {
          setMembers(data.members);
        }
      })
      .catch((err) => {
        console.error('Error fetching roster for safety export:', err);
      })
      .finally(() => {
        setLoadingRoster(false);
      });
  }, []);

  const downloadSizingCSV = () => {
    if (matrix.length === 0) return;
    const header = ['Garment', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'Total'];
    const rows = matrix.map((row) => [
      row.name,
      row.XS,
      row.S,
      row.M,
      row.L,
      row.XL,
      row.XXL,
      row.Total,
    ]);

    const csvContent = [header, ...rows].map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `kclmc_printer_spec_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadSafetyCSV = () => {
    if (members.length === 0) return;
    const header = [
      'KCL Student ID',
      'Full Name',
      'Membership Tier',
      'Climber Mobile Phone',
      'Emergency Contact Name',
      'Emergency Contact Phone',
      'University Affiliation',
      'Safety Gate Status',
      'Purchase Date',
    ];

    const sanitizeCell = (val: string | null | undefined) => {
      if (!val) return '""';
      let clean = String(val).replace(/"/g, '""').trim();
      if (/^[=+@-]/.test(clean)) clean = `'` + clean; // prevent spreadsheet formula injection
      return `"${clean}"`;
    };

    const rows = members.map((m) => [
      sanitizeCell(m.cardNumber),
      sanitizeCell(m.name),
      sanitizeCell(m.tier.toUpperCase()),
      sanitizeCell(m.phone || 'PENDING'),
      sanitizeCell(m.emergencyContactName || 'PENDING'),
      sanitizeCell(m.emergencyContactPhone || 'PENDING'),
      sanitizeCell(m.university || "King's College London"),
      sanitizeCell(m.safetyComplete ? 'PASS_ACTIVE' : 'LOCKED_PENDING_SAFETY'),
      sanitizeCell(m.purchaseDate || ''),
    ]);

    const csvContent = [header.map((h) => `"${h}"`).join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `kclmc_member_safety_directory_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const verifiedPhoneCount = members.filter((m) => m.phone && validatePhoneNumber(m.phone)).length;
  const completedSafetyCount = members.filter((m) => m.safetyComplete).length;
  const pendingSafetyCount = members.length - completedSafetyCount;

  const downloadVCard = async (includePending = false) => {
    if (members.length === 0) return;
    const vCardText = generateMembersVCard(members, { includePending });
    if (!vCardText) {
      alert(
        includePending
          ? 'No members found in directory.'
          : 'No members have verified mobile numbers yet. Members must submit their phone number at /membership to appear in the WhatsApp contacts export.'
      );
      return;
    }

    const count = includePending ? members.length : verifiedPhoneCount;
    const dateStamp = new Date().toISOString().split('T')[0];
    const fileName = includePending
      ? `kclmc_all_roster_${dateStamp}.vcf`
      : `kclmc_whatsapp_contacts_${dateStamp}.vcf`;

    const blob = new Blob([vCardText], { type: 'text/vcard;charset=utf-8;' });

    // Use Web Share API if supported on mobile (bypasses iOS Safari 1-contact QuickLook bug)
    if (canShareFiles && typeof navigator !== 'undefined' && navigator.share) {
      try {
        const file = new File([blob], fileName, { type: 'text/vcard' });
        await navigator.share({
          files: [file],
          title: `KCLMC 26/27 Contacts (${count} climbers)`,
          text: `Import ${count} KCLMC climbing contacts to your phone.`,
        });
        setExportFeedback(`Shared ${count} contacts! On iPhone, select 'Contacts' → 'Add All Contacts'.`);
        setTimeout(() => setExportFeedback(null), 6000);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('Share API error, falling back to direct download:', err);
      }
    }

    // Standard download fallback (desktop or unsupported browsers)
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportFeedback(`Downloaded ${count} contact cards (${fileName}).`);
    setTimeout(() => setExportFeedback(null), 4000);
  };

  const handleSaveMemberName = async () => {
    if (!editingMember || !editedNameInput.trim()) return;
    setSavingName(true);
    try {
      const res = await fetch('/api/roster', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardNumber: editingMember.cardNumber,
          fullName: editedNameInput.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMembers((prev) =>
          prev.map((m) =>
            m.cardNumber === editingMember.cardNumber ? { ...m, name: editedNameInput.trim() } : m
          )
        );
        setExportFeedback(
          `✔ Updated name for ${editingMember.cardNumber} to "${editedNameInput.trim()}". Protected from CSV sync overwrite!`
        );
        setEditingMember(null);
      } else {
        alert(data.error || 'Failed to update member name.');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating member name.');
    } finally {
      setSavingName(false);
    }
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
              <span className="text-xs font-mono font-bold text-[#FFBD59]">Data &amp; Operations Export</span>
            </div>
            <h1 className="text-3xl font-black font-heading uppercase tracking-wide text-white mt-2">
              Committee Export Engine
            </h1>
            <p className="text-sm text-zinc-300 mt-1">
              Download verified climber safety profiles for trip leaders, emergency directories, and screen-printer spec sheets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'safety' ? (
              <>
                <button
                  onClick={() => downloadVCard(false)}
                  disabled={members.length === 0 || verifiedPhoneCount === 0}
                  className="px-4 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-50 text-[#052322] font-heading font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                  title="Import verified phone contacts into phone to bulk add to WhatsApp Community"
                >
                  <span>📥 WhatsApp Contacts ({verifiedPhoneCount} Verified .vcf)</span>
                </button>
                <button
                  onClick={() => downloadVCard(true)}
                  disabled={members.length === 0}
                  className="px-4 py-2.5 bg-[#084746] hover:bg-[#0c5c5b] border border-[#FFBD59]/40 text-[#FFBD59] font-heading font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                  title="Export all roster members into contacts (includes emergency contacts and student IDs)"
                >
                  <span>📇 All Roster ({members.length} .vcf)</span>
                </button>
                <button
                  onClick={downloadSafetyCSV}
                  disabled={members.length === 0}
                  className="px-4 py-2.5 bg-[#FFBD59] hover:bg-[#FFE0A3] disabled:opacity-50 text-[#052322] font-heading font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <span>📄 Export Directory CSV</span>
                </button>
              </>
            ) : (
              <button
                onClick={downloadSizingCSV}
                disabled={matrix.length === 0}
                className="px-5 py-2.5 bg-[#FFBD59] hover:bg-[#FFE0A3] disabled:opacity-50 text-[#052322] font-heading font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <span>📥 Download Printer Spec CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Export Feedback Banner */}
        {exportFeedback && (
          <div className="mb-6 p-4 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl flex items-center justify-between text-xs text-emerald-200">
            <div className="flex items-center gap-2">
              <span className="text-base">✔</span>
              <span className="font-mono">{exportFeedback}</span>
            </div>
            <button
              onClick={() => setExportFeedback(null)}
              className="text-emerald-400 hover:text-white font-mono text-xs px-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex space-x-2 border-b border-[#084746] mb-8 font-mono text-xs">
          <button
            onClick={() => setActiveTab('safety')}
            className={`pb-3 px-4 font-bold uppercase transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'safety'
                ? 'border-[#FFBD59] text-[#FFBD59]'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <span>📱 Member Phone &amp; Safety Directory</span>
            <span className="bg-[#084746] text-[#FFBD59] px-2 py-0.5 rounded-full text-[10px]">
              {members.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('sizing')}
            className={`pb-3 px-4 font-bold uppercase transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'sizing'
                ? 'border-[#FFBD59] text-[#FFBD59]'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <span>👕 Garment Sizing Matrix</span>
            <span className="bg-[#084746] text-zinc-300 px-2 py-0.5 rounded-full text-[10px]">
              {matrix.length}
            </span>
          </button>
        </div>

        {/* TAB 1: Safety Directory */}
        {activeTab === 'safety' && (
          <div className="space-y-6">
            {/* GDPR Notice Banner */}
            <div className="p-4 bg-[#084746]/70 border border-[#FFBD59]/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔒</span>
                <div>
                  <strong className="text-[#FFBD59] block font-heading uppercase tracking-wide">
                    UK GDPR &amp; Duty of Care Compliance Notice
                  </strong>
                  <span className="text-zinc-300 font-sans">
                    Member phone numbers and emergency contacts are collected under Contractual Necessity and Vital Interests for climbing safety and official club operations. Do not share or store on unencrypted personal devices.
                  </span>
                </div>
              </div>
              <span className="bg-[#041F1E] text-emerald-400 border border-emerald-500/40 px-3 py-1 rounded-full font-mono text-[10px] shrink-0">
                Committee Clearance (Role ≥ 1)
              </span>
            </div>

            {/* Phone Number Verification Coverage Banner */}
            {verifiedPhoneCount < members.length && (
              <div className="p-4 bg-amber-950/30 border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <strong className="text-amber-400 block font-heading uppercase tracking-wide">
                      {verifiedPhoneCount} of {members.length} Members Have Verified Phone Numbers
                    </strong>
                    <span className="text-zinc-300 font-sans">
                      KCLSU sales reports do not provide student phone numbers. The WhatsApp (.vcf) export only contains members who have logged into this portal and completed the Safety Gate ({verifiedPhoneCount} verified). The remaining {members.length - verifiedPhoneCount} members can be exported via <button onClick={() => downloadVCard(true)} className="text-[#FFBD59] underline font-bold hover:text-white">All Roster (.vcf)</button> or the full Directory CSV.
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => downloadVCard(true)}
                  className="px-3.5 py-2 bg-[#084746] hover:bg-[#0d5958] text-[#FFBD59] border border-[#FFBD59]/40 rounded-xl text-xs font-mono font-bold shrink-0 transition-colors cursor-pointer"
                >
                  Export All {members.length} (.vcf)
                </button>
              </div>
            )}

            {/* WhatsApp Community Onboarding Tutorial */}
            <div className="p-5 bg-[#052322] border border-[#25D366]/40 rounded-2xl text-xs space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#25D366] font-heading font-bold text-sm uppercase tracking-wide">
                  <span>💬 Leak-Proof WhatsApp Community Onboarding</span>
                </div>
                <span className="bg-[#084746] text-[#25D366] border border-[#25D366]/30 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold">
                  ZERO PUBLIC LINK • NO BOT NEEDED
                </span>
              </div>
              <p className="text-zinc-300 font-sans text-xs leading-relaxed">
                To prevent non-paying students from entering the WhatsApp Community via forwarded links, public invite links are disabled. Follow these 3 steps to bulk-onboard verified members in 30 seconds:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 font-mono text-[11px]">
                <div className="p-3.5 bg-[#041F1E] rounded-xl border border-[#084746] space-y-1">
                  <strong className="text-[#FFBD59] block">Step 1: Download .vcf</strong>
                  <span className="text-zinc-400 font-sans block">
                    Tap <strong className="text-white">&quot;WhatsApp Contacts ({verifiedPhoneCount} Verified .vcf)&quot;</strong> above (or &quot;All Roster&quot; to export all {members.length} climbers).
                  </span>
                </div>
                <div className="p-3.5 bg-[#041F1E] rounded-xl border border-[#084746] space-y-1">
                  <strong className="text-[#FFBD59] block">Step 2: Import Contacts</strong>
                  <span className="text-zinc-400 font-sans block space-y-1">
                    <span>Contacts are tagged as <code className="text-[#25D366]">KCLMC 26/27 - [Name]</code>.</span>
                    <span className="block text-[10px] text-zinc-300">
                      <strong>📱 iPhone:</strong> In share sheet, tap <strong>Contacts</strong> or save to <strong>Files</strong> → tap <strong>&quot;Add All Contacts&quot;</strong>. (QuickLook preview only shows 1st contact).
                    </span>
                    <span className="block text-[10px] text-zinc-300">
                      <strong>💻 Desktop:</strong> Import into <a href="https://contacts.google.com" target="_blank" rel="noreferrer" className="text-[#FFBD59] underline">Google Contacts</a> or iCloud.
                    </span>
                  </span>
                </div>
                <div className="p-3.5 bg-[#041F1E] rounded-xl border border-[#084746] space-y-1">
                  <strong className="text-[#FFBD59] block">Step 3: Bulk Add</strong>
                  <span className="text-zinc-400 font-sans block">
                    In WhatsApp Community → tap <strong className="text-white">Add Members</strong> → search <code className="text-[#25D366]">KCLMC 26/27</code> → select all → Done!
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-emerald-400 font-mono pt-1">
                ✔ 100% leak-proof • Zero unauthorized non-members • RFC 2426 compliant multi-vCard export.
              </p>
            </div>
            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-[#052322] border border-[#084746] rounded-2xl">
                <span className="text-zinc-400 font-mono text-[11px] uppercase block">Total Roster</span>
                <span className="text-2xl font-black font-heading text-white">{members.length}</span>
              </div>
              <div className="p-4 bg-[#052322] border border-[#084746] rounded-2xl">
                <span className="text-zinc-400 font-mono text-[11px] uppercase block">Passes Active (Safety Complete)</span>
                <span className="text-2xl font-black font-heading text-emerald-400">{completedSafetyCount}</span>
              </div>
              <div className="p-4 bg-[#052322] border border-[#084746] rounded-2xl">
                <span className="text-zinc-400 font-mono text-[11px] uppercase block">Passes Locked (Awaiting Numbers)</span>
                <span className="text-2xl font-black font-heading text-amber-400">{pendingSafetyCount}</span>
              </div>
            </div>

            {/* Members Directory Table */}
            <div className="bg-[#052322] border border-[#084746] rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-5 border-b border-[#084746] flex justify-between items-center bg-[#041F1E]/80">
                <div>
                  <h2 className="text-base font-bold font-heading uppercase text-white tracking-wide">
                    Live Member Contact Directory
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Showing verified numbers for climbing trip logistics and safety coordination.
                  </p>
                </div>
                <span className="text-xs font-mono text-[#FFBD59] bg-[#084746] px-3 py-1 rounded-full border border-[#FFBD59]/30">
                  Live Supabase Join
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono">
                  <thead className="bg-[#041F1E] text-zinc-400 text-xs uppercase tracking-wider border-b border-[#084746]">
                    <tr>
                      <th className="p-4 font-bold text-white">Student ID</th>
                      <th className="p-4 font-bold text-white">Member Name</th>
                      <th className="p-4">Tier</th>
                      <th className="p-4">Mobile Phone</th>
                      <th className="p-4">Emergency Contact</th>
                      <th className="p-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#084746]/60 text-xs">
                    {loadingRoster ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-zinc-400 font-mono">
                          Loading member safety directory...
                        </td>
                      </tr>
                    ) : members.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-zinc-400 font-mono">
                          No roster members found in database.
                        </td>
                      </tr>
                    ) : (
                      members.map((m, i) => (
                        <tr key={i} className="hover:bg-[#084746]/30 transition-colors">
                          <td className="p-4 text-[#FFBD59] font-bold">{m.cardNumber}</td>
                          <td className="p-4 font-bold text-white font-sans">
                            <div className="flex items-center gap-2">
                              <span>{m.name}</span>
                              {!isCompleteFullName(m.name) && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-600/40 font-mono">
                                  ⚠️ Surname Only
                                </span>
                              )}
                              <button
                                onClick={() => {
                                  setEditingMember({ cardNumber: m.cardNumber, currentName: m.name });
                                  setEditedNameInput(m.name);
                                }}
                                className="text-zinc-500 hover:text-[#FFBD59] text-xs font-mono px-1 py-0.5 rounded hover:bg-[#084746] transition-colors cursor-pointer"
                                title="Edit member full name (protected from CSV sync overwrite)"
                              >
                                ✏️
                              </button>
                            </div>
                          </td>
                          <td className="p-4 uppercase text-[11px] text-zinc-300">
                            <span className={`px-2 py-0.5 rounded ${m.tier === 'recreational' ? 'bg-emerald-950 text-emerald-300' : 'bg-[#084746] text-[#FFBD59]'}`}>
                              {m.tier}
                            </span>
                          </td>
                          <td className="p-4 text-white">
                            {m.phone ? (
                              <span className="font-mono text-emerald-300">{m.phone}</span>
                            ) : (
                              <span className="text-zinc-500 italic">Not provided</span>
                            )}
                          </td>
                          <td className="p-4 text-zinc-300">
                            {m.emergencyContactPhone ? (
                              <div>
                                <span className="text-white block font-sans">{m.emergencyContactName || 'Next of Kin'}</span>
                                <span className="font-mono text-zinc-400 text-[11px]">{m.emergencyContactPhone}</span>
                              </div>
                            ) : (
                              <span className="text-zinc-500 italic">Not provided</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {m.safetyComplete ? (
                              <span className="bg-emerald-950 border border-emerald-500/40 text-emerald-300 px-2.5 py-1 rounded text-[10px] font-bold">
                                ✔ PASS ACTIVE
                              </span>
                            ) : (
                              <span className="bg-amber-950/80 border border-amber-500/40 text-amber-300 px-2.5 py-1 rounded text-[10px] font-bold">
                                ⏳ LOCKED
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Garment Sizing Matrix */}
        {activeTab === 'sizing' && (
          <div className="space-y-6">
            <div className="bg-[#052322] border border-[#084746] rounded-2xl overflow-hidden shadow-2xl mb-8">
              <div className="p-5 border-b border-[#084746] flex justify-between items-center bg-[#041F1E]/80">
                <div>
                  <h2 className="text-base font-bold font-heading uppercase text-white tracking-wide">
                    Garment Breakdown Matrix
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Total garments: {matrix.reduce((acc, r) => acc + (r.Total || 0), 0)} units
                  </p>
                </div>
                <span className="text-xs font-mono text-[#FFBD59] bg-[#084746] px-3 py-1 rounded-full border border-[#FFBD59]/30">
                  Auto-Aggregated
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono">
                  <thead className="bg-[#041F1E] text-zinc-400 text-xs uppercase tracking-wider border-b border-[#084746]">
                    <tr>
                      <th className="p-4 font-bold text-white">Garment</th>
                      <th className="p-4 text-center">XS</th>
                      <th className="p-4 text-center">S</th>
                      <th className="p-4 text-center">M</th>
                      <th className="p-4 text-center">L</th>
                      <th className="p-4 text-center">XL</th>
                      <th className="p-4 text-center">XXL</th>
                      <th className="p-4 text-right font-bold text-[#FFBD59]">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#084746]/60 text-sm">
                    {loadingOrders ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-zinc-400">
                          Loading orders data...
                        </td>
                      </tr>
                    ) : matrix.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-zinc-400">
                          No orders found in current drop window.
                        </td>
                      </tr>
                    ) : (
                      matrix.map((row, i) => (
                        <tr key={i} className="hover:bg-[#084746]/30 transition-colors">
                          <td className="p-4 font-bold text-white font-sans">{row.name}</td>
                          <td className="p-4 text-center text-zinc-300">{row.XS || 0}</td>
                          <td className="p-4 text-center text-zinc-300">{row.S || 0}</td>
                          <td className="p-4 text-center text-zinc-300">{row.M || 0}</td>
                          <td className="p-4 text-center text-zinc-300">{row.L || 0}</td>
                          <td className="p-4 text-center text-zinc-300">{row.XL || 0}</td>
                          <td className="p-4 text-center text-zinc-300">{row.XXL || 0}</td>
                          <td className="p-4 text-right font-bold text-[#FFBD59] text-base">{row.Total || 0}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-[#052322] border border-[#084746] rounded-2xl p-5 text-xs text-zinc-300 font-mono flex items-center justify-between">
              <span>Format: Standard CSV compliant with AS Colour and UK bulk printers.</span>
              <span className="text-[#FFBD59]">Live database linked</span>
            </div>
          </div>
        )}

        {/* Modal: Inline Member Name Curation (Layer 4) */}
        {editingMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#052322] border border-[#FFBD59]/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-black font-heading uppercase text-white">
                    Curate Member Name
                  </h3>
                  <span className="text-xs font-mono text-[#FFBD59]">
                    Student ID: {editingMember.cardNumber}
                  </span>
                </div>
                <button
                  onClick={() => setEditingMember(null)}
                  className="text-zinc-400 hover:text-white font-mono text-sm"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                Edit this member&apos;s full name. Once saved, the <strong>ETL Survivor Rule</strong> will permanently protect this name from being overwritten by future KCLSU CSV uploads (e.g. preventing single-word or &quot;- Janjic&quot; downgrades).
              </p>

              <div>
                <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                  Full Name (First &amp; Last)
                </label>
                <input
                  type="text"
                  value={editedNameInput}
                  onChange={(e) => setEditedNameInput(e.target.value)}
                  placeholder="e.g. Marko Janjic"
                  className="w-full bg-[#041F1E] border border-[#084746] focus:border-[#FFBD59] rounded-xl px-4 py-2 text-sm text-white font-sans outline-none transition-colors"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 bg-[#041F1E] hover:bg-[#084746] text-zinc-300 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingName || !editedNameInput.trim()}
                  onClick={handleSaveMemberName}
                  className="px-4 py-2 bg-[#FFBD59] hover:bg-[#FFE0A3] disabled:opacity-50 text-[#052322] rounded-xl text-xs font-heading font-black uppercase tracking-wider transition-colors shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  {savingName ? 'Saving...' : '🔒 Save & Lock Name'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
