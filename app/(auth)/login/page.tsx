'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

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

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

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
    <div className="min-h-screen bg-[#052322] text-[#F7F7F7] flex items-center justify-center p-4 relative overflow-hidden font-sans topo-pattern">
      <div className="max-w-md w-full bg-[#084746]/80 backdrop-blur-md border border-[#FFBD59]/30 rounded-3xl p-8 shadow-2xl relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#041F1E] border border-[#FFBD59]/40 text-[#FFBD59] text-[10px] font-mono uppercase tracking-widest mb-3">
            Member Access
          </div>
          <h1 className="text-3xl font-black font-serif text-[#FFBD59] tracking-tight">
            KCLMC Logbook
          </h1>
          <p className="text-xs text-zinc-300 font-mono mt-1">
            Sign in to access your digital membership card &amp; member benefits
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex rounded-xl bg-[#041F1E] p-1 mb-6 border border-[#FFBD59]/20 text-xs font-mono">
          <button
            type="button"
            onClick={() => { setMode('password'); setMagicLinkSent(false); }}
            className={`flex-1 py-2 rounded-lg transition-colors font-bold ${
              mode === 'password' ? 'bg-[#FFBD59] text-[#052322]' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => { setMode('magic_link'); setIsSignUp(false); }}
            className={`flex-1 py-2 rounded-lg transition-colors font-bold ${
              mode === 'magic_link' ? 'bg-[#FFBD59] text-[#052322]' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Magic Link
          </button>
        </div>

        {magicLinkSent ? (
          <div className="bg-[#041F1E]/90 border border-[#FFBD59]/40 rounded-2xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#FFBD59]/20 text-[#FFBD59] flex items-center justify-center mx-auto text-xl">
              ✉️
            </div>
            <h3 className="text-lg font-bold text-white">Check your email</h3>
            <p className="text-xs text-zinc-300">
              We sent a secure login link to <strong className="text-[#FFBD59]">{email}</strong>.
            </p>
            <button
              type="button"
              onClick={() => setMagicLinkSent(false)}
              className="text-xs text-[#FFBD59] underline hover:text-[#FFE0A3] mt-2 block mx-auto"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-red-300 text-xs font-mono">
                {errorMsg}
              </div>
            )}

            {mode === 'password' && isSignUp && (
              <>
                <div>
                  <label className="block text-xs font-mono uppercase text-zinc-300 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Alex Honnold"
                    className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFBD59] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-zinc-300 mb-1">
                    KCL Student Number
                  </label>
                  <input
                    type="text"
                    value={studentId}
                    onChange={e => setStudentId(e.target.value)}
                    placeholder="e.g. K24001234"
                    className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFBD59] text-sm font-mono"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-mono uppercase text-zinc-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your.name@kcl.ac.uk"
                className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFBD59] text-sm"
              />
            </div>

            {mode === 'password' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-mono uppercase text-zinc-300">
                    Password
                  </label>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFBD59] text-sm"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 bg-[#FFBD59] text-[#052322] font-black rounded-xl hover:bg-[#FFE0A3] transition-all shadow-lg hover:shadow-[0_0_20px_rgba(255,189,89,0.3)] disabled:opacity-50 text-sm font-mono uppercase tracking-wider"
            >
              {loading
                ? 'Validating...'
                : mode === 'magic_link'
                ? 'Send Magic Link'
                : isSignUp
                ? 'Create Member Account'
                : 'Sign In'}
            </button>

            {mode === 'password' && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-xs text-zinc-400 hover:text-[#FFBD59] transition-colors underline"
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
        <div className="mt-8 pt-4 border-t border-[#FFBD59]/20 text-center text-xs text-zinc-400">
          <Link href="/" className="hover:text-white transition-colors">
            ← Return to Club Hub
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
