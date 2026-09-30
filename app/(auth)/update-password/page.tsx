'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

function UpdatePasswordForm() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      if (!isSupabaseConfigured()) {
        if (mounted) {
          setErrorMsg('Supabase credentials are not connected yet.');
          setCheckingSession(false);
        }
        return;
      }

      // Check current session
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        if (session) {
          setHasSession(true);
          setCheckingSession(false);
        } else {
          // Listen in case session is being initialized from the recovery token
          const { data: authListener } = supabase.auth.onAuthStateChange((event, s) => {
            if (s) {
              setHasSession(true);
              setCheckingSession(false);
            }
          });
          const timer = setTimeout(() => {
            if (mounted) setCheckingSession(false);
          }, 1500);

          return () => {
            clearTimeout(timer);
            authListener.subscription.unsubscribe();
          };
        }
      }
    }

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => {
        router.push('/membership');
        router.refresh();
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update password. Your recovery link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#041F1E] text-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans topo-pattern">
      <div className="max-w-md w-full bg-[#052322] border-2 border-[#FFBD59]/35 rounded-3xl p-6 sm:p-10 shadow-2xl relative z-10">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#084746] border border-[#FFBD59]/50 flex items-center justify-center text-2xl shadow-sm mb-3">
            ⛰️
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#084746] border border-[#FFBD59]/30 text-[#FFBD59] font-heading font-bold text-xs uppercase tracking-wider mb-2">
            Security // Password Reset
          </div>
          <h1 className="text-3xl sm:text-4xl font-black font-heading uppercase tracking-tight text-[#FFBD59]">
            Set New Password
          </h1>
          <p className="text-sm text-zinc-300 font-sans mt-2 max-w-xs leading-relaxed">
            Enter and confirm a secure new password for your KCLMC account.
          </p>
        </div>

        {checkingSession ? (
          <div className="py-12 text-center space-y-3">
            <div className="inline-block w-8 h-8 border-2 border-[#FFBD59] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-zinc-400 font-mono tracking-wider uppercase">
              Verifying recovery session...
            </p>
          </div>
        ) : !hasSession ? (
          <div className="bg-[#041F1E] border border-amber-500/40 rounded-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <h3 className="text-lg font-heading font-bold uppercase tracking-wide text-white">
              Link Expired or Invalid
            </h3>
            <p className="text-xs text-zinc-300 font-sans leading-relaxed">
              This password reset link is invalid, has expired, or has already been used. Please request a new recovery link.
            </p>
            <Link
              href="/login"
              className="inline-block w-full py-3.5 bg-[#FFBD59] text-[#052322] font-heading font-black uppercase tracking-wider text-sm rounded-xl hover:bg-[#FFE0A3] transition-all shadow-md text-center"
            >
              Request New Reset Link →
            </Link>
          </div>
        ) : success ? (
          <div className="bg-[#041F1E] border border-emerald-500/40 rounded-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-xl">
              ✔
            </div>
            <h3 className="text-lg font-heading font-bold uppercase tracking-wide text-white">
              Password Updated!
            </h3>
            <p className="text-xs text-zinc-300 font-sans leading-relaxed">
              Your password has been successfully updated. Redirecting you to your membership dashboard...
            </p>
            <Link
              href="/membership"
              className="inline-block w-full py-3.5 bg-[#FFBD59] text-[#052322] font-heading font-black uppercase tracking-wider text-sm rounded-xl hover:bg-[#FFE0A3] transition-all shadow-md text-center"
            >
              Go to Dashboard Now →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-4">
            {errorMsg && (
              <div className="p-3.5 bg-red-950/70 border border-red-500/50 rounded-xl text-red-300 text-xs font-sans leading-relaxed">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFBD59] focus:ring-1 focus:ring-[#FFBD59] text-sm font-sans transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFBD59] focus:ring-1 focus:ring-[#FFBD59] text-sm font-sans transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 bg-[#FFBD59] text-[#052322] font-heading font-black uppercase tracking-wider text-sm rounded-xl hover:bg-[#FFE0A3] transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Updating Password...' : 'Save New Password →'}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-[#FFBD59]/20 text-center font-heading uppercase text-xs tracking-wider text-zinc-400">
          <Link href="/login" className="hover:text-white transition-colors inline-flex items-center gap-1.5">
            <span>←</span>
            <span>Back to Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#052322] text-white flex items-center justify-center font-mono">Loading...</div>}>
      <UpdatePasswordForm />
    </Suspense>
  );
}
