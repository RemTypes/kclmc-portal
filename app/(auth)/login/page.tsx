'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/membership';
  const urlError = searchParams.get('error');

  const [view, setView] = useState<'sign_in' | 'sign_up' | 'forgot_password'>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(
    urlError === 'reset_link_expired'
      ? 'Your password reset link has expired or is invalid. Please request a new one below.'
      : urlError
      ? 'Authentication failed. Please try again.'
      : ''
  );
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (!isSupabaseConfigured()) {
      setErrorMsg('Supabase credentials are not connected yet. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Cloudflare Settings > Variables and Secrets, then trigger a new deployment.');
      setLoading(false);
      return;
    }

    try {
      if (view === 'sign_up') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              student_id: studentId,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;
        router.push(next);
        router.refresh();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(next);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (!isSupabaseConfigured()) {
      setErrorMsg('Supabase credentials are not connected yet.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
      });
      if (error) throw error;
      setResetEmailSent(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send password reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  let badgeText = 'Member Access // 2026/27';
  let titleText = 'KCLMC Member Portal';
  let descText = 'Sign in to access your verified climbing pass, meet signups & society perks.';

  if (view === 'sign_up') {
    badgeText = 'New Member Registration';
    titleText = 'Join KCLMC';
    descText = 'Create your member account to access verified passes and club signups.';
  } else if (view === 'forgot_password') {
    badgeText = 'Account Recovery';
    titleText = 'Reset Password';
    descText = 'Enter your email to receive a secure link to reset your account password.';
  }

  return (
    <div className="min-h-screen bg-[#041F1E] text-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans topo-pattern">
      <div className="max-w-md w-full bg-[#052322] border-2 border-[#FFBD59]/35 rounded-3xl p-6 sm:p-10 shadow-2xl relative z-10">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#084746] border border-[#FFBD59]/50 flex items-center justify-center text-2xl shadow-sm mb-3">
            ⛰️
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#084746] border border-[#FFBD59]/30 text-[#FFBD59] font-heading font-bold text-xs uppercase tracking-wider mb-2">
            {badgeText}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black font-heading uppercase tracking-tight text-[#FFBD59]">
            {titleText}
          </h1>
          <p className="text-sm text-zinc-300 font-sans mt-2 max-w-xs leading-relaxed">
            {descText}
          </p>
        </div>

        {view === 'forgot_password' ? (
          resetEmailSent ? (
            <div className="bg-[#041F1E] border border-[#FFBD59]/30 rounded-2xl p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#FFBD59]/20 text-[#FFBD59] flex items-center justify-center mx-auto text-xl">
                ✉️
              </div>
              <h3 className="text-lg font-heading font-bold uppercase tracking-wide text-white">Check your email</h3>
              <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                We sent a secure password reset link to <strong className="text-[#FFBD59]">{email}</strong>. Please check your inbox and spam folder.
              </p>
              <button
                type="button"
                onClick={() => {
                  setResetEmailSent(false);
                  setView('sign_in');
                  setErrorMsg('');
                }}
                className="text-xs font-sans text-[#FFBD59] underline hover:text-[#FFE0A3] mt-2 block mx-auto cursor-pointer"
              >
                ← Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {errorMsg && (
                <div className="p-3.5 bg-red-950/70 border border-red-500/50 rounded-xl text-red-300 text-xs font-sans leading-relaxed">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                  Account Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your.name@kcl.ac.uk"
                  className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFBD59] focus:ring-1 focus:ring-[#FFBD59] text-sm font-sans transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 bg-[#FFBD59] text-[#052322] font-heading font-black uppercase tracking-wider text-sm rounded-xl hover:bg-[#FFE0A3] transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Sending link...' : 'Send Recovery Link →'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setView('sign_in');
                    setErrorMsg('');
                  }}
                  className="text-xs font-sans text-zinc-400 hover:text-[#FFBD59] transition-colors underline cursor-pointer"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )
        ) : (
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3.5 bg-red-950/70 border border-red-500/50 rounded-xl text-red-300 text-xs font-sans leading-relaxed">
                {errorMsg}
              </div>
            )}

            {view === 'sign_up' && (
              <>
                <div>
                  <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Alex Honnold"
                    className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFBD59] focus:ring-1 focus:ring-[#FFBD59] text-sm font-sans transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                    KCL Student ID Number
                  </label>
                  <input
                    type="text"
                    value={studentId}
                    onChange={e => setStudentId(e.target.value.toUpperCase())}
                    placeholder="e.g. K1234567"
                    className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFBD59] focus:ring-1 focus:ring-[#FFBD59] text-sm font-mono uppercase tracking-wider transition-colors"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your.name@kcl.ac.uk"
                className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFBD59] focus:ring-1 focus:ring-[#FFBD59] text-sm font-sans transition-colors"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-heading font-bold uppercase tracking-wider text-zinc-300">
                  Password
                </label>
                {view === 'sign_in' && (
                  <button
                    type="button"
                    onClick={() => {
                      setView('forgot_password');
                      setErrorMsg('');
                    }}
                    className="text-[11px] font-sans text-[#FFBD59] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFBD59] focus:ring-1 focus:ring-[#FFBD59] text-sm font-sans transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 bg-[#FFBD59] text-[#052322] font-heading font-black uppercase tracking-wider text-sm rounded-xl hover:bg-[#FFE0A3] transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {loading
                ? 'Validating...'
                : view === 'sign_up'
                ? 'Create Member Account →'
                : 'Sign In to Portal →'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setView(view === 'sign_up' ? 'sign_in' : 'sign_up');
                  setErrorMsg('');
                }}
                className="text-xs font-sans text-zinc-400 hover:text-[#FFBD59] transition-colors underline cursor-pointer"
              >
                {view === 'sign_up'
                  ? 'Already have an account? Sign in'
                  : 'Need an account? Register as a member'}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-[#FFBD59]/20 text-center font-heading uppercase text-xs tracking-wider text-zinc-400">
          <Link href="/" className="hover:text-white transition-colors inline-flex items-center gap-1.5">
            <span>←</span>
            <span>Return to Club Hub</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#052322] text-white flex items-center justify-center font-mono">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
