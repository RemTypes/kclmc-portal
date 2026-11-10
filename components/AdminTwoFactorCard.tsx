'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface SetupData {
  secret: string;
  totpUri: string;
  backupCodes: string[];
  challengeToken: string;
  expiresAt: number;
}

export default function AdminTwoFactorCard() {
  const [loading, setLoading] = useState(true);
  const [enrolled, setEnrolled] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [setupMode, setSetupMode] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/setup-2fa');
      if (res.ok) {
        const data = await res.json();
        setEnrolled(!!data.enrolled);
        if (data.user?.email) {
          setUserEmail(data.user.email);
        }
      }
    } catch (err) {
      console.error('Failed to fetch 2FA status:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartSetup() {
    setSetupLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/auth/setup-2fa', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to initialize 2FA setup.');
        return;
      }
      setSetupData(data);
      setSetupMode(true);
      setVerificationCode('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error connecting to 2FA service.');
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleVerifySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!setupData) return;

    const cleanCode = verificationCode.trim().replace(/[^0-9]/g, '');
    if (cleanCode.length !== 6) {
      setErrorMsg('Please enter a 6-digit verification code.');
      return;
    }

    setVerifying(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeToken: setupData.challengeToken,
          code: cleanCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Invalid 6-digit code. Please check your authenticator app and try again.');
        return;
      }

      setSuccessMsg('✓ Two-factor authentication successfully activated and saved in Cloudflare D1!');
      setEnrolled(true);
      setSetupMode(false);
      setSetupData(null);
      setVerificationCode('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error verifying 2FA code.');
    } finally {
      setVerifying(false);
    }
  }

  function copyToClipboard(text: string, type: 'secret' | 'codes') {
    navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2500);
    } else {
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2500);
    }
  }

  return (
    <div className="bg-[#052322] p-6 rounded-2xl border border-[#084746] shadow-2xl">
      <div className="flex items-center justify-between mb-4 border-b border-[#084746] pb-3">
        <h2 className="text-lg font-bold font-heading uppercase text-white flex items-center gap-2">
          <span>🛡️ Committee Two-Factor Authentication</span>
        </h2>
        {loading ? (
          <span className="text-xs font-mono text-zinc-400">Checking...</span>
        ) : enrolled ? (
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-800">
            ✓ D1 Active
          </span>
        ) : (
          <span className="text-[11px] font-mono text-amber-400 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-800">
            ⚠️ Not Configured
          </span>
        )}
      </div>

      <p className="text-xs text-zinc-300 leading-relaxed mb-4">
        RFC 6238 TOTP authenticator security for committee accounts. Stored natively in Cloudflare D1 for fast, edge-isolated verification across all regions.
      </p>

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-mono">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-red-300 text-xs font-mono">
          {errorMsg}
        </div>
      )}

      {!setupMode ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 bg-[#031817] rounded-xl border border-[#084746]">
            <div>
              <p className="text-xs font-bold text-white font-mono">
                {userEmail || 'Committee Member'}
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5 font-sans">
                {enrolled
                  ? 'Your account has active 2FA credentials in Cloudflare D1.'
                  : 'Re-enroll your authenticator app below to link fresh 2FA keys.'}
              </p>
            </div>
            <button
              onClick={handleStartSetup}
              disabled={setupLoading}
              className="px-4 py-2 bg-[#FFBD59] hover:bg-[#FFE0A3] text-[#052322] font-heading font-black uppercase text-xs rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {setupLoading ? 'Preparing...' : enrolled ? '↻ Re-enroll 2FA' : '+ Setup 2FA'}
            </button>
          </div>
        </div>
      ) : setupData ? (
        <form onSubmit={handleVerifySubmit} className="space-y-5 bg-[#031817] p-5 rounded-xl border border-[#FFBD59]/30">
          {/* Step 1: Scan QR Code */}
          <div className="p-4 bg-[#052322] border border-[#084746] rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-wider text-[#FFBD59]">
              <span className="w-5 h-5 rounded-full bg-[#FFBD59] text-[#052322] flex items-center justify-center text-[10px] font-black">1</span>
              <span>Scan QR Code with Authenticator App</span>
            </div>

            <div className="flex justify-center p-3 bg-white rounded-xl mx-auto w-fit shadow-md">
              <QRCodeSVG
                value={setupData.totpUri}
                size={170}
                level="M"
                includeMargin={false}
              />
            </div>

            {/* Manual Secret Key Fallback */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowSecretKey(!showSecretKey)}
                className="text-[11px] text-[#FFBD59] hover:underline cursor-pointer font-sans"
              >
                {showSecretKey ? 'Hide manual secret key' : 'Cannot scan? Enter key manually'}
              </button>

              {showSecretKey && (
                <div className="mt-2 p-2.5 bg-[#031817] border border-[#FFBD59]/30 rounded-xl space-y-1.5 text-center">
                  <div className="text-[10px] text-zinc-400 font-heading uppercase tracking-wider">
                    Base32 Secret Key
                  </div>
                  <div className="font-mono text-xs text-amber-300 select-all break-all tracking-widest bg-[#052322] p-2 rounded border border-[#FFBD59]/20">
                    {setupData.secret}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(setupData.secret, 'secret')}
                    className="text-[10px] py-1 px-3 bg-[#084746] text-[#FFBD59] rounded hover:bg-[#0a5a59] transition-colors border border-[#FFBD59]/30 font-heading font-bold uppercase tracking-wider cursor-pointer"
                  >
                    {copiedSecret ? '✓ Key Copied!' : 'Copy Secret Key'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Emergency Backup Codes */}
          {setupData.backupCodes && setupData.backupCodes.length > 0 && (
            <div className="p-4 bg-[#052322] border border-amber-500/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-wider text-amber-400">
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-[#052322] flex items-center justify-center text-[10px] font-black">2</span>
                  <span>Emergency Backup Codes</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(setupData.backupCodes.join('\n'), 'codes')}
                  className="text-[10px] py-0.5 px-2 bg-amber-950/80 text-amber-300 border border-amber-500/40 rounded hover:bg-amber-900 transition-colors font-mono cursor-pointer"
                >
                  {copiedCodes ? '✓ Copied All' : 'Copy All Codes'}
                </button>
              </div>

              <p className="text-[11px] text-zinc-300 font-sans leading-relaxed">
                Save these 8 single-use codes in a password manager. If you lose your device, each code can be used once.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-2 bg-[#031817] rounded-xl border border-amber-500/20 font-mono text-xs text-amber-200 text-center">
                {setupData.backupCodes.map((code) => (
                  <div key={code} className="py-1 px-1 bg-[#052322] rounded border border-amber-500/10 tracking-wider">
                    {code}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Enter 6-Digit Code */}
          <div className="p-4 bg-[#052322] border border-[#FFBD59]/40 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-wider text-[#FFBD59]">
              <span className="w-5 h-5 rounded-full bg-[#FFBD59] text-[#052322] flex items-center justify-center text-[10px] font-black">3</span>
              <span>Enter 6-Digit Code to Confirm</span>
            </div>
            <input
              type="text"
              required
              autoFocus
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="123456"
              maxLength={6}
              className="w-full bg-[#031817] border-2 border-[#FFBD59]/50 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFBD59] text-center font-mono text-2xl tracking-[0.3em] font-black transition-colors"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={verifying || verificationCode.length !== 6}
              className="flex-1 py-3 bg-[#FFBD59] hover:bg-[#FFE0A3] text-[#052322] font-heading font-black uppercase text-xs rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {verifying ? 'Verifying & Saving...' : 'Verify & Activate in D1 →'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSetupMode(false);
                setSetupData(null);
                setVerificationCode('');
                setErrorMsg('');
              }}
              className="px-4 py-3 bg-[#084746] hover:bg-[#0a5a59] text-zinc-300 hover:text-white font-heading font-bold uppercase text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
