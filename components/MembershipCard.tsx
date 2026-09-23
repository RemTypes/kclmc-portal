'use client';

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface MembershipCardProps {
  profile: {
    full_name: string;
    student_id: string | null;
    avatar_url: string | null;
  };
  membership: {
    id: string;
    membership_number: string;
    tier: string;
    valid_from: string;
    valid_until: string;
    is_active: boolean;
    payment_reference?: string | null;
  };
}

export default function MembershipCard({ profile, membership }: MembershipCardProps) {
  // Card tier is locked based on official SU record
  const cardType: 'recreational' | 'social' =
    membership.tier?.toLowerCase().includes('social') ? 'social' : 'recreational';

  const [isBigFormat, setIsBigFormat] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const cardImageSrc = cardType === 'social'
    ? '/images/membership/social-card.jpg'
    : '/images/membership/recreational-card.jpg';

  const userName = profile.full_name || 'KCL Climber';
  const studentId = profile.student_id || membership.membership_number || 'K-STUDENT';

  // Verification URL
  const verifyUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/verify/${studentId}`
    : `/api/verify/${studentId}`;

  // Download high-resolution card with canvas overlay
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = cardImageSrc;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 585;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Canvas context unavailable');

      // Draw background template
      ctx.drawImage(img, 0, 0, 1024, 585);

      // Setup typography for the parchment boxes
      ctx.fillStyle = '#08261F';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Draw Full Name (Top Box - center x=178, y=222)
      const nameLength = userName.length;
      const nameFontSize = nameLength > 24 ? 18 : nameLength > 18 ? 22 : 26;
      ctx.font = `bold ${nameFontSize}px "Bitter", Georgia, serif`;
      ctx.fillText(userName, 178, 222);

      // Draw Student ID (Bottom Box - center x=178, y=352)
      ctx.font = 'bold 24px "Space_Mono", monospace, monospace';
      ctx.letterSpacing = '2px';
      ctx.fillText(studentId, 178, 352);

      // Generate download
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `KCLMC-${cardType.toUpperCase()}-CARD-${studentId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error generating card download:', err);
      alert('Could not generate download image. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {/* Official Status Bar & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#084746]/80 backdrop-blur-md rounded-2xl border border-[#FFBD59]/30 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-bold text-white uppercase">
            {cardType === 'social' ? 'Social Membership' : 'Recreational Membership'}
          </span>
          <span className="text-[10px] text-zinc-400 font-normal">
            (Locked via KCLSU)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsBigFormat(true)}
            className="px-3 py-1.5 bg-[#041F1E] hover:bg-[#06302e] border border-[#FFBD59]/40 text-[#FFBD59] rounded-lg transition-colors flex items-center gap-1.5"
            title="Expand to Fullscreen View"
          >
            <span>🔍</span>
            <span>Enlarge</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="px-3 py-1.5 bg-[#FFBD59] hover:bg-[#FFE0A3] text-[#052322] font-bold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <span>⬇</span>
            <span>{downloading ? 'Exporting...' : 'Download Card'}</span>
          </button>
        </div>
      </div>

      {/* Official Membership Card Display */}
      <div 
        onClick={() => setIsBigFormat(true)}
        className="cursor-pointer relative w-full aspect-[1024/585] rounded-2xl overflow-hidden shadow-2xl border-2 border-[#FFBD59]/50 group transition-all hover:scale-[1.01] hover:border-[#FFBD59]"
      >
        {/* Base Official Template Image */}
        <img
          src={cardImageSrc}
          alt={`KCLMC ${cardType} Membership Card`}
          className="w-full h-full object-cover select-none pointer-events-none"
        />

        {/* Top Box: Climber Name */}
        <div className="absolute left-[3.5%] top-[27.5%] w-[27.5%] h-[19%] flex items-center justify-center p-2 text-center overflow-hidden">
          <p className="font-serif font-black text-[#08261F] text-xs sm:text-sm md:text-base leading-tight drop-shadow-sm select-none">
            {userName}
          </p>
        </div>

        {/* Bottom Box: KCL ID Number */}
        <div className="absolute left-[3.5%] top-[50%] w-[27.5%] h-[19%] flex items-center justify-center p-2 text-center overflow-hidden">
          <p className="font-mono font-black text-[#08261F] text-xs sm:text-sm md:text-base tracking-wider select-none">
            {studentId}
          </p>
        </div>

        {/* Hover Hint Overlay */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <span className="px-3 py-1.5 bg-[#052322]/90 border border-[#FFBD59] text-[#FFBD59] text-xs font-mono rounded-lg shadow-lg">
            Click to view in Big Format ↗
          </span>
        </div>
      </div>

      {/* Auxiliary Verification Bar */}
      <div className="bg-[#084746]/60 border border-[#FFBD59]/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center gap-3">
          <div className="bg-white p-1.5 rounded-lg shadow shrink-0">
            <QRCodeSVG value={verifyUrl} size={48} bgColor="#FFFFFF" fgColor="#052322" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${membership.is_active ? 'bg-emerald-400' : 'bg-red-500'}`}></span>
              <span className={membership.is_active ? 'text-emerald-300 font-bold' : 'text-red-400 font-bold'}>
                {membership.is_active ? 'KCLSU VERIFIED PASS' : 'EXPIRED / INACTIVE'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              ID: {studentId} • Season 2026/27 {membership.payment_reference ? `• Tx: ${membership.payment_reference}` : ''}
            </p>
          </div>
        </div>

        <button
          onClick={handleDownload}
          disabled={downloading}
          className="text-xs text-[#FFBD59] hover:underline underline-offset-4 flex items-center gap-1"
        >
          <span>Save PNG to Photos / Wallet</span>
          <span>↗</span>
        </button>
      </div>

      {/* Big Format Modal */}
      {isBigFormat && (
        <div 
          onClick={() => setIsBigFormat(false)}
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-8"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="relative max-w-4xl w-full bg-[#052322] border-2 border-[#FFBD59] rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden"
          >
            {/* Close Button */}
            <button
              onClick={() => setIsBigFormat(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#041F1E] border border-[#FFBD59]/40 text-zinc-300 hover:text-white flex items-center justify-center text-lg z-10"
            >
              ✕
            </button>

            <div className="mb-4">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-[#084746] border border-[#FFBD59]/40 text-[#FFBD59] text-[10px] font-mono uppercase tracking-widest mb-1">
                KCLSU Verified // Season 2026/27
              </div>
              <h2 className="text-xl font-bold font-serif text-white">
                Official KCLMC {cardType === 'social' ? 'Social' : 'Recreational'} Card
              </h2>
              <p className="text-xs font-mono text-zinc-400 mt-1">
                Display this card at host wall receptions or download for offline access.
              </p>
            </div>

            {/* Large Card Representation */}
            <div className="relative w-full aspect-[1024/585] rounded-2xl overflow-hidden shadow-2xl border border-[#FFBD59]/40 mb-6">
              <img
                src={cardImageSrc}
                alt={`KCLMC ${cardType} Membership Card Large`}
                className="w-full h-full object-cover select-none"
              />

              {/* Large Top Box: Climber Name */}
              <div className="absolute left-[3.5%] top-[27.5%] w-[27.5%] h-[19%] flex items-center justify-center p-3 text-center">
                <p className="font-serif font-black text-[#08261F] text-base sm:text-xl md:text-2xl leading-tight">
                  {userName}
                </p>
              </div>

              {/* Large Bottom Box: KCL ID Number */}
              <div className="absolute left-[3.5%] top-[50%] w-[27.5%] h-[19%] flex items-center justify-center p-3 text-center">
                <p className="font-mono font-black text-[#08261F] text-sm sm:text-lg md:text-xl tracking-wider">
                  {studentId}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
              <div className="text-zinc-400">
                King's College London Mountaineering and Climbing Club
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="px-5 py-2.5 bg-[#FFBD59] text-[#052322] font-bold rounded-xl hover:bg-[#FFE0A3] transition-colors"
                >
                  {downloading ? 'Generating...' : 'Download Card Image (PNG) ↓'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsBigFormat(false)}
                  className="px-5 py-2.5 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
