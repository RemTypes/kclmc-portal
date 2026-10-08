'use client';

import React, { useState, useEffect } from 'react';
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

interface RenderedCard {
  file: File;
  blob: Blob;
  dataUrl: string;
  fileName: string;
}

async function generateCardArtifacts(
  cardImageSrc: string,
  userName: string,
  studentId: string,
  cardType: string
): Promise<RenderedCard> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Non-blocking fallback if custom web font fails or times out
    }
  }

  const img = new Image();
  img.src = cardImageSrc;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
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
  try {
    (ctx as any).letterSpacing = '2px';
  } catch {
    // Fallback for Safari/WebKit where Canvas letterSpacing parsing throws SYNTAX_ERR
  }
  ctx.fillText(studentId, 178, 352);

  // High-res Base64 Data URL (guarantees iOS Safari displays "Save to Photos" on long press)
  const dataUrl = canvas.toDataURL('image/png');

  // Binary PNG Blob (for Web Share API File and clean Desktop/Android downloads)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  );
  if (!blob) throw new Error('Could not create card image blob');

  const fileName = `KCLMC-${cardType.toUpperCase()}-CARD-${studentId}.png`;
  let file: File;
  try {
    file = new File([blob], fileName, { type: 'image/png' });
  } catch {
    file = Object.assign(blob, { name: fileName, lastModified: Date.now() }) as File;
  }

  return { file, blob, dataUrl, fileName };
}

export default function MembershipCard({ profile, membership }: MembershipCardProps) {
  // Card tier is locked based on official SU record
  const cardType: 'recreational' | 'social' =
    membership.tier?.toLowerCase().includes('social') ? 'social' : 'recreational';

  const [isBigFormat, setIsBigFormat] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [mobilePreviewUrl, setMobilePreviewUrl] = useState<string | null>(null);
  const [cachedCard, setCachedCard] = useState<RenderedCard | null>(null);

  const cardImageSrc = cardType === 'social'
    ? '/images/membership/social-card.jpg'
    : '/images/membership/recreational-card.jpg';

  const userName = profile.full_name || 'KCL Climber';
  const studentId = profile.student_id || membership.membership_number || 'K-STUDENT';

  // Verification URL
  const verifyUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/verify/${studentId}`
    : `/api/verify/${studentId}`;

  // Pre-render card canvas on mount or when details change
  // This allows navigator.share to run synchronously upon user click, preventing iOS Safari gesture expiration
  useEffect(() => {
    let cancelled = false;
    generateCardArtifacts(cardImageSrc, userName, studentId, cardType)
      .then((card) => {
        if (!cancelled) {
          setCachedCard(card);
        }
      })
      .catch((err) => {
        console.warn('Card canvas pre-render warning:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [cardImageSrc, userName, studentId, cardType]);

  const isIOSDevice = () => {
    if (typeof navigator === 'undefined') return false;
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  };

  const triggerDownload = (blob: Blob, fileName: string) => {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  };

  // Download high-resolution card (Web Share API for iOS, Blob for Desktop & Android)
  const handleDownload = async () => {
    const isIOS = isIOSDevice();

    if (isIOS) {
      // 1. If card is already pre-rendered, invoke Web Share API SYNCHRONOUSLY
      // Zero await before navigator.share preserves transient user activation in iOS Safari
      if (cachedCard) {
        if (
          typeof navigator !== 'undefined' &&
          typeof navigator.canShare === 'function' &&
          navigator.canShare({ files: [cachedCard.file] }) &&
          typeof navigator.share === 'function'
        ) {
          try {
            await navigator.share({
              files: [cachedCard.file],
              title: 'KCLMC Digital Climbing Pass',
              text: `Official KCLMC Climbing Pass for ${userName} (${studentId})`,
            });
            return;
          } catch (shareErr: any) {
            if (shareErr?.name === 'AbortError') {
              return; // User intentionally dismissed the share sheet
            }
            console.warn('Web Share failed, opening iOS preview modal:', shareErr);
          }
        }

        // Web Share unsupported or errored: display high-res Base64 preview modal
        setMobilePreviewUrl(cachedCard.dataUrl);
        return;
      }

      // If not cached yet, generate now and show modal
      setDownloading(true);
      try {
        const card = await generateCardArtifacts(cardImageSrc, userName, studentId, cardType);
        setCachedCard(card);
        setMobilePreviewUrl(card.dataUrl);
      } catch (err: any) {
        console.error('Error generating card:', err);
        alert('Could not generate card image. Please try again.');
      } finally {
        setDownloading(false);
      }
      return;
    }

    // Non-iOS (Desktop & Android):
    if (cachedCard) {
      triggerDownload(cachedCard.blob, cachedCard.fileName);
      return;
    }

    setDownloading(true);
    try {
      const card = await generateCardArtifacts(cardImageSrc, userName, studentId, cardType);
      setCachedCard(card);
      triggerDownload(card.blob, card.fileName);
    } catch (err: any) {
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

      {/* Mobile Save to Photos Fallback Modal (for iOS when Web Share is unavailable or dismissed) */}
      {mobilePreviewUrl && (
        <div 
          onClick={() => setMobilePreviewUrl(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#052322] border-2 border-[#FFBD59]/50 rounded-3xl max-w-lg w-full p-6 text-center space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 cursor-default"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#FFBD59]/20">
              <h3 className="font-heading font-black text-lg text-white uppercase tracking-wider flex items-center gap-2">
                <span>📱</span>
                <span>Save to Photos</span>
              </h3>
              <button
                type="button"
                onClick={() => setMobilePreviewUrl(null)}
                className="text-zinc-400 hover:text-white p-1 text-sm font-mono cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-3 bg-[#084746]/40 rounded-2xl border border-[#FFBD59]/30 text-xs text-[#FFBD59] font-sans">
              <p className="font-bold mb-1">Save to your iPhone Photos:</p>
              <p className="text-zinc-300 text-[11px]">
                Tap the button below or <strong>press &amp; hold the card image</strong> to select <strong>&quot;Save to Photos&quot;</strong>.
              </p>
            </div>

            {/* Direct iOS Share Sheet Button */}
            {cachedCard && typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.share({
                      files: [cachedCard.file],
                      title: 'KCLMC Digital Climbing Pass',
                      text: `Official KCLMC Climbing Pass for ${userName} (${studentId})`,
                    });
                  } catch (err: any) {
                    if (err?.name === 'AbortError') return;
                    console.warn('Share sheet failed:', err);
                  }
                }}
                className="w-full py-3 bg-[#FFBD59] hover:bg-[#FFE0A3] text-[#052322] font-mono text-xs uppercase font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <span>📱</span>
                <span>Open iOS Share Sheet / Save Image</span>
              </button>
            )}

            {/* High-Res Base64 Image with Explicit Touch Callout enabled */}
            <div className="rounded-2xl overflow-hidden border border-[#FFBD59]/40 shadow-xl bg-black p-1">
              <img
                src={mobilePreviewUrl}
                alt="KCLMC Membership Card"
                className="w-full h-auto block select-auto"
                style={{
                  WebkitTouchCallout: 'default',
                  WebkitUserSelect: 'auto',
                  userSelect: 'auto',
                  touchAction: 'auto',
                  pointerEvents: 'auto',
                }}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <a
                href={mobilePreviewUrl}
                download={cachedCard?.fileName || `KCLMC-CARD-${studentId}.png`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 bg-[#084746] hover:bg-[#0a5a58] border border-[#FFBD59]/40 text-[#FFBD59] font-mono text-xs uppercase font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Open Full Image</span>
                <span>↗</span>
              </a>
              <button
                type="button"
                onClick={() => setMobilePreviewUrl(null)}
                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-xs uppercase font-bold rounded-xl transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
