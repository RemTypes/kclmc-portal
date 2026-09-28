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

  const [mode, setMode] = useState<'password' | 'magic_link'>('password');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(urlError ? 'Authentication failed. Please try again.' : '');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (!isSupabaseConfigured()) {
      setErrorMsg('Supabase credentials are not connected yet. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Cloudflare Settings > Variables and Secrets, then trigger a new deployment.');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'magic_link') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;
        setMagicLinkSent(true);
      } else if (isSignUp) {
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

  return (
    <div className="min-h-screen bg-[#041F1E] text-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans topo-pattern">
      <div className="max-w-md w-full bg-[#052322] border-2 border-[#FFBD59]/35 rounded-3xl p-6 sm:p-10 shadow-2xl relative z-10">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#084746] border border-[#FFBD59]/50 flex items-center justify-center text-2xl shadow-sm mb-3">
            ⛰️
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#084746] border border-[#FFBD59]/30 text-[#FFBD59] font-heading font-bold text-xs uppercase tracking-wider mb-2">
            Member Access // 2026/27
          </div>
          <h1 className="text-3xl sm:text-4xl font-black font-heading uppercase tracking-tight text-[#FFBD59]">
            KCLMC Member Portal
          </h1>
          <p className="text-sm text-zinc-300 font-sans mt-2 max-w-xs leading-relaxed">
            Sign in to access your verified climbing pass, meet signups &amp; society perks.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex rounded-xl bg-[#041F1E] p-1 mb-6 border border-[#FFBD59]/30">
          <button
            type="button"
            onClick={() => { setMode('password'); setMagicLinkSent(false); }}
            className={`flex-1 py-2.5 rounded-lg transition-all font-heading font-bold uppercase tracking-wider text-xs ${
              mode === 'password' ? 'bg-[#FFBD59] text-[#052322] shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => { setMode('magic_link'); setIsSignUp(false); }}
            className={`flex-1 py-2.5 rounded-lg transition-all font-heading font-bold uppercase tracking-wider text-xs ${
              mode === 'magic_link' ? 'bg-[#FFBD59] text-[#052322] shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Magic Link
          </button>
        </div>

        {magicLinkSent ? (
          <div className="bg-[#041F1E] border border-[#FFBD59]/30 rounded-2xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#FFBD59]/20 text-[#FFBD59] flex items-center justify-center mx-auto text-xl">
              ✉️
            </div>
            <h3 className="text-lg font-heading font-bold uppercase tracking-wide text-white">Check your email</h3>
            <p className="text-xs text-zinc-300 font-sans leading-relaxed">
              We sent a secure login link to <strong className="text-[#FFBD59]">{email}</strong>.
            </p>
            <button
              type="button"
              onClick={() => setMagicLinkSent(false)}
              className="text-xs font-sans text-[#FFBD59] underline hover:text-[#FFE0A3] mt-2 block mx-auto"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3.5 bg-red-950/70 border border-red-500/50 rounded-xl text-red-300 text-xs font-sans leading-relaxed">
                {errorMsg}
              </div>
            )}

            {mode === 'password' && isSignUp && (
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

            {mode === 'password' && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-heading font-bold uppercase tracking-wider text-zinc-300">
                    Password
                  </label>
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
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 bg-[#FFBD59] text-[#052322] font-heading font-black uppercase tracking-wider text-sm rounded-xl hover:bg-[#FFE0A3] transition-all shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {loading
                ? 'Validating...'
                : mode === 'magic_link'
                ? 'Send Magic Link →'
                : isSignUp
                ? 'Create Member Account →'
                : 'Sign In to Portal →'}
            </button>

            {mode === 'password' && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-xs font-sans text-zinc-400 hover:text-[#FFBD59] transition-colors underline"
                >
                  {isSignUp
                    ? 'Already have an account? Sign in'
                    : 'Need an account? Register as a member'}
                </button>
              </div>
            )}
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
