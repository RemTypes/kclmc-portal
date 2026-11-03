'use client';

import React, { useState } from 'react';

export default function AdminSuperAdmin2FAReset() {
  const [targetIdentifier, setTargetIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = targetIdentifier.trim();
    if (!clean) return;

    if (!confirm(`Are you sure you want to reset 2FA for "${clean}"? They will be required to re-enroll a fresh authenticator on their next sign in.`)) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const isEmail = clean.includes('@');
      const res = await fetch('/api/admin/reset-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEmail ? { targetEmail: clean } : { targetUserId: clean }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || 'Failed to reset 2FA.', type: 'error' });
      } else {
        setMessage({ text: data.message || '2FA successfully reset.', type: 'success' });
        setTargetIdentifier('');
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Network error.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetAll = async () => {
    if (!confirm('DANGER: Are you sure you want to wipe ALL committee 2FA keys across the club? Every single officer and admin will be guided to re-setup 2FA upon their next login.')) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/reset-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetAll: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || 'Failed to wipe 2FA keys.', type: 'error' });
      } else {
        setMessage({ text: data.message || 'All committee 2FA keys wiped successfully.', type: 'success' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Network error.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#052322] border border-red-900/60 rounded-2xl p-6 shadow-xl mb-12">
      <div className="flex items-center justify-between mb-4 border-b border-[#084746] pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
          <h2 className="text-lg font-bold font-heading uppercase text-white">
            SuperAdmin 2FA Emergency Reset Hatch
          </h2>
        </div>
        <span className="px-2.5 py-0.5 bg-red-950 text-red-300 border border-red-800 text-[10px] rounded font-mono font-bold">
          Tier 2 Clearance
        </span>
      </div>

      <p className="text-xs text-zinc-300 mb-4 leading-relaxed">
        If a committee member loses their phone or inherited a broken Supabase 2FA record during migration, enter their email below to wipe their D1 <code className="text-[#FFBD59] font-mono">twoFactor</code> record and prompt a clean guided setup on their next login.
      </p>

      {message && (
        <div
          className={`p-3 rounded-xl text-xs font-mono mb-4 border ${
            message.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
              : 'bg-red-950/80 border-red-500/50 text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleReset} className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          value={targetIdentifier}
          onChange={(e) => setTargetIdentifier(e.target.value)}
          placeholder="officer@kclmc.org or User ID"
          className="flex-1 bg-[#041F1E] border border-[#084746] focus:border-red-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !targetIdentifier.trim()}
          className="px-5 py-2.5 bg-red-950 hover:bg-red-900 text-red-300 hover:text-white border border-red-700 rounded-xl text-xs font-mono font-bold uppercase transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
        >
          {loading ? 'Resetting...' : 'Reset Officer 2FA →'}
        </button>
      </form>

      <div className="pt-3 border-t border-[#084746]/60 flex items-center justify-between">
        <p className="text-[11px] text-zinc-400 font-sans">
          Post-migration cleanup: wipe all legacy/corrupted 2FA records across the club.
        </p>
        <button
          type="button"
          onClick={handleResetAll}
          disabled={loading}
          className="px-3.5 py-1.5 bg-[#041F1E] hover:bg-red-950/60 text-red-400 hover:text-red-300 border border-red-900/50 rounded-lg text-[11px] font-mono font-bold uppercase transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
        >
          Wipe All Committee 2FA Keys ⚠️
        </button>
      </div>
    </div>
  );
}
