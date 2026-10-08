'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { getSafeRedirectUrl, sanitizeEmail, sanitizeStudentId, UNIVERSITIES, DEFAULT_UNIVERSITY, sanitizeUniversity } from '@/lib/auth';
import { validatePasswordStrength, PasswordValidationResult } from '@/lib/security/password-validator';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = getSafeRedirectUrl(searchParams.get('next'), '/membership');
  const urlError = searchParams.get('error');

  const initialView = searchParams.get('view') === 'sign_up' || searchParams.get('mode') === 'register' ? 'sign_up' : 'sign_in';
  const [mode, setMode] = useState<'password' | 'magic_link'>('password');
  const [view, setView] = useState<'sign_in' | 'two_factor' | 'two_factor_setup' | 'sign_up' | 'forgot_password'>(initialView);
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [university, setUniversity] = useState<string>(DEFAULT_UNIVERSITY);
  const [customUniversity, setCustomUniversity] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // 2FA state
  const [challengeToken, setChallengeToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorMessage, setTwoFactorMessage] = useState('');
  const [twoFactorExpiresAt, setTwoFactorExpiresAt] = useState<number>(0);
  const [twoFactorExpirySeconds, setTwoFactorExpirySeconds] = useState<number>(300);

  // 2FA First-time Setup state
  const [setupSecret, setSetupSecret] = useState('');
  const [setupTotpUri, setSetupTotpUri] = useState('');
  const [setupBackupCodes, setSetupBackupCodes] = useState<string[]>([]);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [setupCode, setSetupCode] = useState('');

  // Rate Limiting & CAPTCHA state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(
    urlError === 'reset_link_expired'
      ? 'Your password reset link has expired or is invalid. Please request a new one below.'
      : urlError
      ? 'Authentication failed. Please try again.'
      : ''
  );
  const [warningMsg, setWarningMsg] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);
  const [requiresCaptcha, setRequiresCaptcha] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // Real-time password strength validation
  const pwdValidation = useMemo<PasswordValidationResult>(() => {
    return validatePasswordStrength(password);
  }, [password]);

  // Active session detection: auto-forward already-authenticated users to their destination
  useEffect(() => {
    let isMounted = true;
    async function checkActiveSession() {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            const dest = searchParams.get('next')
              ? next
              : ((data.user.role ?? 0) >= 1 ? '/admin' : '/membership');
            window.location.href = dest;
          }
        }
      } catch {
        // Non-fatal
      }
    }
    checkActiveSession();
    return () => {
      isMounted = false;
    };
  }, [next, searchParams]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSecondsLeft <= 0) {
      if (isLocked) setIsLocked(false);
      return;
    }
    const timer = setInterval(() => {
      setLockoutSecondsLeft(prev => {
        if (prev <= 1) {
          setIsLocked(false);
          setErrorMsg('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSecondsLeft, isLocked]);

  // 2FA countdown timer
  useEffect(() => {
    if ((view !== 'two_factor' && view !== 'two_factor_setup') || !twoFactorExpiresAt) return;
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.floor((twoFactorExpiresAt - Date.now()) / 1000));
      setTwoFactorExpirySeconds(remaining);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [view, twoFactorExpiresAt]);

  const copyToClipboard = async (text: string, type: 'secret' | 'codes') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'secret') {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2500);
      } else {
        setCopiedCodes(true);
        setTimeout(() => setCopiedCodes(false), 2500);
      }
    } catch {
      // Fallback
    }
  };

  const handleCaptchaVerify = () => {
    const token = `kclmc_captcha_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    setCaptchaToken(token);
    setCaptchaVerified(true);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setWarningMsg('');

    const cleanEmail = sanitizeEmail(email);
    const cleanStudentId = sanitizeStudentId(studentId);
    const cleanFullName = (fullName || '').trim().slice(0, 100);
    const cleanUniversity = sanitizeUniversity(
      university === 'Other UK Institution' ? customUniversity : university
    );

    if (view === 'sign_up') {
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        setErrorMsg("Please enter a valid King's or personal email address.");
        setLoading(false);
        return;
      }
      if (university === 'Other UK Institution' && !customUniversity.trim()) {
        setErrorMsg('Please enter the name of your university or institution.');
        setLoading(false);
        return;
      }
      if (!pwdValidation.isValid) {
        setErrorMsg(pwdValidation.errors[0] || 'Password does not meet the security requirements.');
        setLoading(false);
        return;
      }
      if (!acceptedTerms) {
        setErrorMsg('You must agree to the Terms & Conditions, Privacy Policy, and acknowledge the BMC Climbing Risk Statement.');
        setLoading(false);
        return;
      }
    }

    if (requiresCaptcha && !captchaVerified) {
      setErrorMsg('Please complete the anti-bot security verification before submitting.');
      setLoading(false);
      return;
    }

    try {
      if (view === 'sign_up') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password,
            fullName: cleanFullName,
            studentId: cleanStudentId,
            university: cleanUniversity,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (data.details && Array.isArray(data.details)) {
            setErrorMsg(data.details.join('. '));
          } else {
            setErrorMsg(data.error || 'Failed to create account.');
          }
          return;
        }

        window.location.href = next;
      } else {
        // Sign In submission through server-side rate-limited route with httpOnly cookies
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password,
            captchaToken: captchaVerified ? captchaToken : undefined,
            next: searchParams.get('next'),
          }),
        });

        const data = await res.json();

        if (res.status === 429 || data.isLocked) {
          setIsLocked(true);
          const retrySec = data.retryAfterSeconds || 900;
          setLockoutSecondsLeft(retrySec);
          setErrorMsg(data.error || `Account temporarily locked. Please try again in ${Math.ceil(retrySec / 60)} minutes.`);
          if (data.requiresCaptcha) setRequiresCaptcha(true);
          return;
        }

        if (data.requiresCaptcha) {
          setRequiresCaptcha(true);
        }

        if (!res.ok) {
          if (data.remainingAttempts !== undefined && data.remainingAttempts <= 2) {
            setWarningMsg(`Warning: ${data.remainingAttempts} login attempt${data.remainingAttempts === 1 ? '' : 's'} remaining before account lockout.`);
          }
          setErrorMsg(data.error || 'Invalid email or password.');
          return;
        }

        // Two-Factor Authentication Setup Challenge Triggered (Unenrolled committee member)
        if (data.requires2FASetup) {
          setChallengeToken(data.challengeToken);
          setSetupSecret(data.secret || '');
          setSetupTotpUri(data.totpUri || '');
          setSetupBackupCodes(data.backupCodes || []);
          setTwoFactorMessage(data.message || 'Two-factor authentication is required for committee accounts. Please scan the QR code into your authenticator app to complete activation.');
          setTwoFactorExpiresAt(data.expiresAt || Date.now() + 10 * 60 * 1000);
          setView('two_factor_setup');
          return;
        }

        // Two-Factor Authentication Challenge Triggered (Already enrolled)
        if (data.requires2FA) {
          setChallengeToken(data.challengeToken);
          setTwoFactorMessage(data.message || 'Two-Factor Authentication is required for your account.');
          setTwoFactorExpiresAt(data.expiresAt || Date.now() + 5 * 60 * 1000);
          setView('two_factor');
          return;
        }

        // Standard Login Succeeded (httpOnly cookies issued by server)
        const targetUrl = searchParams.get('next') ? next : (data.destination || next);
        window.location.href = targetUrl;
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error during authentication. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetup2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const cleanCode = setupCode.trim().replace(/[^0-9]/g, '');
    if (cleanCode.length !== 6) {
      setErrorMsg('Please enter the 6-digit code shown in your authenticator app.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeToken,
          code: cleanCode,
          next: searchParams.get('next'),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Invalid 6-digit code. Please verify the code displayed on your device and try again.');
        return;
      }

      // 2FA Verified & setup complete! httpOnly session cookies attached to response
      const targetUrl = searchParams.get('next') ? next : (data.destination || next);
      window.location.href = targetUrl;
    } catch (err: any) {
      setErrorMsg(err.message || 'Error verifying setup code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (!twoFactorCode.trim()) {
      setErrorMsg('Please enter your 6-digit verification code or single-use backup code.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeToken,
          code: twoFactorCode.trim(),
          next: searchParams.get('next'),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Verification code failed. Please check the code and try again.');
        return;
      }

      // 2FA Verified! httpOnly session cookies attached to response
      const targetUrl = searchParams.get('next') ? next : (data.destination || next);
      window.location.href = targetUrl;
    } catch (err: any) {
      setErrorMsg(err.message || 'Error verifying two-factor challenge.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const cleanEmail = sanitizeEmail(email);
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    if (requiresCaptcha && !captchaVerified) {
      setErrorMsg('Please verify you are human before requesting a password reset.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          captchaToken: captchaVerified ? captchaToken : undefined,
        }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setErrorMsg(data.error || 'Too many reset attempts. Please wait before retrying.');
        return;
      }

      if (data.requiresCaptcha) {
        setRequiresCaptcha(true);
        if (!captchaVerified) {
          setErrorMsg('Security check required. Please complete the verification.');
          return;
        }
      }

      setResetEmailSent(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch password recovery email.');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const cleanEmail = sanitizeEmail(email);
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      if (!res.ok) throw new Error('Failed to dispatch magic link');
      setMagicLinkSent(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send magic link. Please try password login.');
    } finally {
      setLoading(false);
    }
  };

  let badgeText = 'Member Access // 2026/27';
  let titleText = 'KCLMC Member Portal';
  let descText = 'Sign in to access your verified climbing pass, meet signups & society perks.';

  if (view === 'two_factor_setup') {
    badgeText = 'Committee Security Setup';
    titleText = 'Activate 2FA';
    descText = 'Scan the QR code with your authenticator app to enable your committee account.';
  } else if (view === 'two_factor') {
    badgeText = 'Two-Factor Verification';
    titleText = 'Security Check';
    descText = 'Enter the 6-digit code or an 8-character single-use backup code.';
  } else if (mode === 'magic_link') {
    badgeText = 'Instant Sign-In';
    titleText = 'Magic Link Access';
    descText = 'We will email you a secure one-click link to log into your account.';
  } else if (view === 'sign_up') {
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
      <div className={`w-full ${view === 'two_factor_setup' ? 'max-w-lg' : 'max-w-md'} bg-[#052322] border-2 border-[#FFBD59]/35 rounded-3xl p-6 sm:p-10 shadow-2xl relative z-10 transition-all`}>
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#084746] border border-[#FFBD59]/50 flex items-center justify-center text-2xl shadow-sm mb-3">
            {view === 'two_factor' || view === 'two_factor_setup' ? '🔐' : '⛰️'}
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

        {/* Lockout Banner */}
        {isLocked && (
          <div className="mb-6 p-4 bg-red-950/90 border-2 border-red-500 rounded-2xl text-red-200 text-xs font-sans space-y-2">
            <div className="flex items-center gap-2 font-bold text-red-100 uppercase tracking-wide font-heading">
              <span>⛔</span>
              <span>Account Temporarily Restricted</span>
            </div>
            <p className="leading-relaxed">
              Multiple failed authentication attempts detected. To safeguard your account, access has been restricted.
            </p>
            <div className="font-mono text-center py-2 bg-red-900/60 rounded-xl text-white font-bold text-sm border border-red-700">
              Retry available in: {Math.floor(lockoutSecondsLeft / 60)}m {lockoutSecondsLeft % 60}s
            </div>
          </div>
        )}

        {/* Warning Banner */}
        {warningMsg && (
          <div className="mb-4 p-3 bg-amber-950/70 border border-amber-500/50 rounded-xl text-amber-300 text-xs font-sans leading-relaxed flex items-center gap-2">
            <span>⚠️</span>
            <span>{warningMsg}</span>
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && !isLocked && (
          <div className="mb-4 p-3.5 bg-red-950/70 border border-red-500/50 rounded-xl text-red-300 text-xs font-sans leading-relaxed">
            {errorMsg}
          </div>
        )}

        {/* Anti-Bot Challenge Box */}
        {requiresCaptcha && !isLocked && (
          <div className="mb-5 p-4 bg-[#041F1E] border border-[#FFBD59]/40 rounded-2xl">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={captchaVerified}
                  onChange={e => {
                    if (e.target.checked) handleCaptchaVerify();
                  }}
                  className="w-5 h-5 rounded border border-[#FFBD59]/50 bg-[#052322] text-[#FFBD59] focus:ring-0 cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-zinc-200">
                  {captchaVerified ? '✓ Verification Successful' : 'I am a human climber'}
                </span>
              </label>
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                Shield v2
              </div>
            </div>
          </div>
        )}

        {/* Mode Selector (Password vs Magic Link) */}
        {view !== 'forgot_password' && view !== 'two_factor' && view !== 'two_factor_setup' && (
          <div className="flex rounded-xl bg-[#041F1E] p-1 mb-6 border border-[#FFBD59]/30">
            <button
              type="button"
              onClick={() => {
                setMode('password');
                setMagicLinkSent(false);
                setErrorMsg('');
              }}
              className={`flex-1 py-2.5 rounded-lg transition-all font-heading font-bold uppercase tracking-wider text-xs cursor-pointer ${
                mode === 'password'
                  ? 'bg-[#FFBD59] text-[#052322] shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('magic_link');
                setView('sign_in');
                setMagicLinkSent(false);
                setErrorMsg('');
              }}
              className={`flex-1 py-2.5 rounded-lg transition-all font-heading font-bold uppercase tracking-wider text-xs cursor-pointer ${
                mode === 'magic_link'
                  ? 'bg-[#FFBD59] text-[#052322] shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Magic Link
            </button>
          </div>
        )}

        {/* View Handling */}
        {view === 'two_factor_setup' ? (
          <form onSubmit={handleSetup2FASubmit} className="space-y-4">
            <div className="p-3.5 bg-[#084746]/50 border border-[#FFBD59]/30 rounded-2xl text-center space-y-1">
              <p className="text-xs text-zinc-200 font-sans leading-relaxed">
                {twoFactorMessage}
              </p>
              <div className="text-[11px] font-mono text-[#FFBD59]">
                Session expires in: {Math.floor(twoFactorExpirySeconds / 60)}:{(twoFactorExpirySeconds % 60).toString().padStart(2, '0')}
              </div>
            </div>

            {/* Step 1: Scan QR Code */}
            <div className="p-4 bg-[#041F1E] border border-[#FFBD59]/40 rounded-2xl space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-wider text-[#FFBD59]">
                <span className="w-5 h-5 rounded-full bg-[#FFBD59] text-[#052322] flex items-center justify-center text-[10px] font-black">1</span>
                <span>Scan QR with Authenticator App</span>
              </div>
              <p className="text-[11px] text-zinc-300 font-sans leading-relaxed">
                Open Google Authenticator, Apple Passwords, 1Password, or Microsoft Authenticator and scan this code:
              </p>

              {setupTotpUri && (
                <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-inner mx-auto w-fit">
                  <QRCodeSVG value={setupTotpUri} size={150} level="M" />
                </div>
              )}

              {/* Manual Secret Key Fallback */}
              <div className="pt-0.5 text-center">
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="text-[11px] text-[#FFBD59] hover:underline cursor-pointer font-sans"
                >
                  {showSecretKey ? 'Hide manual secret key' : 'Cannot scan? Enter key manually'}
                </button>

                {showSecretKey && (
                  <div className="mt-2 p-2.5 bg-[#052322] border border-[#FFBD59]/30 rounded-xl space-y-1.5 text-center">
                    <div className="text-[10px] text-zinc-400 font-heading uppercase tracking-wider">
                      Base32 Secret Key
                    </div>
                    <div className="font-mono text-xs text-amber-300 select-all break-all tracking-widest bg-[#041F1E] p-2 rounded border border-[#FFBD59]/20">
                      {setupSecret}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(setupSecret, 'secret')}
                      className="text-[10px] py-1 px-3 bg-[#084746] text-[#FFBD59] rounded hover:bg-[#0a5a59] transition-colors border border-[#FFBD59]/30 font-heading font-bold uppercase tracking-wider cursor-pointer"
                    >
                      {copiedSecret ? '✓ Key Copied!' : 'Copy Secret Key'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Emergency Backup Codes */}
            {setupBackupCodes.length > 0 && (
              <div className="p-4 bg-[#041F1E] border border-amber-500/40 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-wider text-amber-400">
                    <span className="w-5 h-5 rounded-full bg-amber-400 text-[#052322] flex items-center justify-center text-[10px] font-black">2</span>
                    <span>Emergency Backup Codes</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(setupBackupCodes.join('\n'), 'codes')}
                    className="text-[10px] py-0.5 px-2 bg-amber-950/80 text-amber-300 border border-amber-500/40 rounded hover:bg-amber-900 transition-colors font-mono cursor-pointer"
                  >
                    {copiedCodes ? '✓ Copied All' : 'Copy All Codes'}
                  </button>
                </div>

                <p className="text-[11px] text-zinc-300 font-sans leading-relaxed">
                  Save these 8 single-use codes in a safe place. If you lose your phone, each code can be used once to access your account.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-2 bg-[#052322] rounded-xl border border-amber-500/20 font-mono text-xs text-amber-200 text-center">
                  {setupBackupCodes.map(code => (
                    <div key={code} className="py-1 px-1 bg-[#041F1E] rounded border border-amber-500/10 tracking-wider">
                      {code}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Confirmation Code */}
            <div className="p-4 bg-[#041F1E] border border-[#FFBD59]/40 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-wider text-[#FFBD59]">
                <span className="w-5 h-5 rounded-full bg-[#FFBD59] text-[#052322] flex items-center justify-center text-[10px] font-black">3</span>
                <span>Enter 6-Digit Code to Confirm</span>
              </div>
              <input
                type="text"
                required
                autoFocus
                value={setupCode}
                onChange={e => setSetupCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="123456"
                maxLength={6}
                className="w-full bg-[#052322] border-2 border-[#FFBD59]/50 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFBD59] text-center font-mono text-2xl tracking-[0.3em] font-black transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading || setupCode.length !== 6 || twoFactorExpirySeconds <= 0}
              className="w-full py-3.5 bg-[#FFBD59] text-[#052322] font-heading font-black uppercase tracking-wider text-sm rounded-xl hover:bg-[#FFE0A3] transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Activating 2FA...' : 'Activate 2FA & Complete Sign In →'}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setView('sign_in');
                  setSetupCode('');
                  setErrorMsg('');
                }}
                className="text-xs font-sans text-zinc-400 hover:text-[#FFBD59] transition-colors underline cursor-pointer"
              >
                ← Cancel and Return to Sign In
              </button>
            </div>
          </form>
        ) : view === 'two_factor' ? (
          <form onSubmit={handle2FASubmit} className="space-y-5">
            <div className="p-4 bg-[#084746]/40 border border-[#FFBD59]/30 rounded-2xl text-center space-y-2">
              <p className="text-xs text-zinc-200 font-sans leading-relaxed">
                {twoFactorMessage}
              </p>
              <div className="text-[11px] font-mono text-[#FFBD59]">
                Code expires in: {Math.floor(twoFactorExpirySeconds / 60)}:{(twoFactorExpirySeconds % 60).toString().padStart(2, '0')}
              </div>
            </div>

            <div>
              <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-300 mb-1.5 flex justify-between">
                <span>Verification Code</span>
                <span className="text-[10px] text-zinc-400 font-sans font-normal">6-digit OTP, Authenticator, or XXXX-XXXX</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                value={twoFactorCode}
                onChange={e => setTwoFactorCode(e.target.value.toUpperCase())}
                placeholder="e.g. 123456 or ABCD-EFGH"
                maxLength={12}
                className="w-full bg-[#041F1E] border border-[#FFBD59]/40 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFBD59] text-center font-mono text-lg tracking-widest uppercase transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading || twoFactorExpirySeconds <= 0}
              className="w-full py-3.5 bg-[#FFBD59] text-[#052322] font-heading font-black uppercase tracking-wider text-sm rounded-xl hover:bg-[#FFE0A3] transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Verifying 2FA...' : 'Confirm Authentication →'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setView('sign_in');
                  setTwoFactorCode('');
                  setErrorMsg('');
                }}
                className="text-xs font-sans text-zinc-400 hover:text-[#FFBD59] transition-colors underline cursor-pointer"
              >
                ← Back to Password Login
              </button>
            </div>
          </form>
        ) : mode === 'magic_link' ? (
          magicLinkSent ? (
            <div className="bg-[#041F1E] border border-[#FFBD59]/30 rounded-2xl p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#FFBD59]/20 text-[#FFBD59] flex items-center justify-center mx-auto text-xl">
                ✉️
              </div>
              <h3 className="text-lg font-heading font-bold uppercase tracking-wide text-white">
                Check your email
              </h3>
              <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                We sent a secure login link to <strong className="text-[#FFBD59]">{email}</strong>. Click the link to log into your account instantly.
              </p>
              <button
                type="button"
                onClick={() => setMagicLinkSent(false)}
                className="text-xs font-sans text-[#FFBD59] underline hover:text-[#FFE0A3] mt-2 block mx-auto cursor-pointer"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
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

              <button
                type="submit"
                disabled={loading || isLocked}
                className="w-full py-3.5 mt-2 bg-[#FFBD59] text-[#052322] font-heading font-black uppercase tracking-wider text-sm rounded-xl hover:bg-[#FFE0A3] transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Sending link...' : 'Send Magic Link →'}
              </button>
            </form>
          )
        ) : view === 'forgot_password' ? (
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
                disabled={loading || isLocked}
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
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
                  <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-300 mb-1.5 flex items-center justify-between">
                    <span>Student ID Number</span>
                    <span className="text-[10px] text-zinc-400 font-sans lowercase font-normal">(optional for guests / non-KCL)</span>
                  </label>
                  <input
                    type="text"
                    value={studentId}
                    onChange={e => setStudentId(e.target.value.toUpperCase())}
                    placeholder="e.g. K23158797 or external ID"
                    className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFBD59] focus:ring-1 focus:ring-[#FFBD59] text-sm font-mono uppercase tracking-wider transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                    University / Institution
                  </label>
                  <select
                    value={university}
                    onChange={e => setUniversity(e.target.value)}
                    className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FFBD59] focus:ring-1 focus:ring-[#FFBD59] text-sm font-sans transition-colors cursor-pointer"
                  >
                    {UNIVERSITIES.map(u => (
                      <option key={u} value={u} className="bg-[#041F1E] text-white">
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                {university === 'Other UK Institution' && (
                  <div>
                    <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                      Specify Institution Name
                    </label>
                    <input
                      type="text"
                      required
                      value={customUniversity}
                      onChange={e => setCustomUniversity(e.target.value)}
                      placeholder="e.g. University of Cambridge"
                      className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFBD59] focus:ring-1 focus:ring-[#FFBD59] text-sm font-sans transition-colors"
                    />
                  </div>
                )}
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
                placeholder={view === 'sign_up' ? 'Min 12 chars, upper, lower, #, symbol' : '••••••••••••'}
                className="w-full bg-[#041F1E] border border-[#FFBD59]/30 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFBD59] focus:ring-1 focus:ring-[#FFBD59] text-sm font-sans transition-colors"
              />
            </div>

            {/* Real-time Password Strength Meter on Registration */}
            {view === 'sign_up' && password.length > 0 && (
              <div className="p-3 bg-[#041F1E] border border-[#FFBD59]/20 rounded-xl space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-heading font-bold uppercase tracking-wider text-zinc-400 text-[10px]">
                    Strength
                  </span>
                  <span className="font-bold text-xs" style={{ color: pwdValidation.color }}>
                    {pwdValidation.label} ({pwdValidation.entropyBits} bits)
                  </span>
                </div>

                {/* Progress bar */}
                <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  {[1, 2, 3, 4].map(step => (
                    <div
                      key={step}
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        backgroundColor: step <= pwdValidation.score ? pwdValidation.color : 'transparent',
                      }}
                    />
                  ))}
                </div>

                {/* Requirements Checklist */}
                <div className="grid grid-cols-2 gap-1 text-[11px] pt-1 font-sans">
                  <div className={`flex items-center gap-1.5 ${pwdValidation.hasMinLength ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    <span>{pwdValidation.hasMinLength ? '✓' : '○'}</span>
                    <span>12+ characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${pwdValidation.hasUpperCase ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    <span>{pwdValidation.hasUpperCase ? '✓' : '○'}</span>
                    <span>Uppercase (A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${pwdValidation.hasLowerCase ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    <span>{pwdValidation.hasLowerCase ? '✓' : '○'}</span>
                    <span>Lowercase (a-z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${pwdValidation.hasNumber ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    <span>{pwdValidation.hasNumber ? '✓' : '○'}</span>
                    <span>Number (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${pwdValidation.hasSymbol ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    <span>{pwdValidation.hasSymbol ? '✓' : '○'}</span>
                    <span>Symbol (!@#$)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${pwdValidation.isNotCommon ? 'text-emerald-400' : 'text-red-400'}`}>
                    <span>{pwdValidation.isNotCommon ? '✓' : '✗'}</span>
                    <span>Not breached</span>
                  </div>
                </div>
              </div>
            )}

            {view === 'sign_up' && (
              <div className="flex items-start gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="terms-consent"
                  required
                  checked={acceptedTerms}
                  onChange={e => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded bg-[#041F1E] border border-[#FFBD59]/40 accent-[#FFBD59] cursor-pointer"
                />
                <label htmlFor="terms-consent" className="text-xs text-zinc-300 font-sans leading-relaxed select-none">
                  I agree to the{' '}
                  <Link href="/terms" target="_blank" className="text-[#FFBD59] underline hover:text-[#FFE0A3]">
                    Terms &amp; Conditions
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" target="_blank" className="text-[#FFBD59] underline hover:text-[#FFE0A3]">
                    Privacy Policy
                  </Link>
                  , and accept the{' '}
                  <Link href="/safety" target="_blank" className="text-amber-400 underline hover:text-amber-300">
                    BMC Climbing Risk Statement
                  </Link>.
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || isLocked || (view === 'sign_up' && !pwdValidation.isValid)}
              className="w-full py-3.5 mt-2 bg-[#FFBD59] text-[#052322] font-heading font-black uppercase tracking-wider text-sm rounded-xl hover:bg-[#FFE0A3] transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {loading
                ? 'Validating...'
                : view === 'sign_up'
                ? 'Create Secure Account →'
                : 'Sign In to Portal →'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setView(view === 'sign_up' ? 'sign_in' : 'sign_up');
                  setErrorMsg('');
                  setWarningMsg('');
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
