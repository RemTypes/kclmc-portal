'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function ScanPage() {
  const [code, setCode] = useState('');
  const [resultType, setResultType] = useState<'order' | 'membership' | null>(null);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const lookup = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    setData(null);
    setResultType(null);

    try {
      let lookupCode = trimmed;
      // Handle scanned URLs like https://.../api/verify/K25008223
      if (lookupCode.includes('/verify/')) {
        const parts = lookupCode.split('/verify/');
        lookupCode = parts[parts.length - 1].replace(/\/+$/, '');
      }

      const isStudentIdOrMembership = 
        lookupCode.toUpperCase().startsWith('KCLMC-') ||
        /^K\d{7,8}$/i.test(lookupCode) ||
        lookupCode.length > 15;

      if (isStudentIdOrMembership) {
        const res = await fetch(`/api/verify/${encodeURIComponent(lookupCode)}`);
        const json = await res.json();
        if (res.ok && json.member) {
          setData(json);
          setResultType('membership');
        } else {
          setError(json.error || 'Membership not found');
        }
      } else {
        // Assume it's a merch order pass
        const res = await fetch(`/api/orders?code=${encodeURIComponent(lookupCode)}`);
        const json = await res.json();
        if (res.ok && json && !json.error) {
          setData(json);
          setResultType('order');
        } else {
          // If not found as order, try membership verification as fallback
          const verifyRes = await fetch(`/api/verify/${encodeURIComponent(lookupCode)}`);
          const verifyJson = await verifyRes.json();
          if (verifyRes.ok && verifyJson.member) {
            setData(verifyJson);
            setResultType('membership');
          } else {
            setError('Code not recognized as order pass or KCL membership ID');
          }
        }
      }
    } catch (err) {
      setError('Network error verifying code');
    } finally {
      setLoading(false);
    }
  };

  const markCollected = async () => {
    if (!data || resultType !== 'order') return;
    try {
      const res = await fetch('/api/orders', {
        method: 'PUT',
        body: JSON.stringify({ code: data.orderCode, status: 'COLLECTED' }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setData({ ...data, status: 'COLLECTED' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-12 flex flex-col items-center justify-center font-mono">
      <div className="w-full max-w-md flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold font-serif text-[#FFBD59]">Pass &amp; ID Scanner</h1>
        <Link href="/admin" className="text-xs text-zinc-400 hover:text-white underline">
          ← Admin Hub
        </Link>
      </div>

      {!data ? (
        <div className="w-full max-w-md aspect-square bg-black border-4 border-gray-800 rounded-3xl mb-8 flex items-center justify-center relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 border-2 border-emerald-500 m-8 rounded-2xl opacity-40"></div>
          <div className="absolute w-full h-1 bg-emerald-400 shadow-[0_0_20px_#10b981] animate-[scan_2s_ease-in-out_infinite]"></div>
          <div className="text-center z-10 bg-black/70 px-4 py-3 rounded-xl border border-zinc-800">
            <p className="text-xs text-zinc-300 font-bold">Awaiting Camera / Input</p>
            <p className="text-[10px] text-zinc-500 mt-1">Scan QR or enter pass code below</p>
          </div>
        </div>
      ) : resultType === 'membership' ? (
        /* Membership verification card */
        <div className="w-full max-w-md bg-zinc-900 rounded-3xl mb-8 overflow-hidden border border-zinc-700 shadow-2xl">
          <div className={`p-4 text-center font-bold text-lg ${
            data.valid ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {data.valid ? '✔ ACTIVE KCLMC MEMBER' : '✖ EXPIRED / INVALID MEMBERSHIP'}
          </div>
          <div className="p-6 space-y-4">
            <div>
              <span className="text-[10px] uppercase text-zinc-400">Climber Name</span>
              <h2 className="text-2xl font-bold text-white font-sans">{data.member.name}</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[10px] uppercase text-zinc-400">Membership No</span>
                <p className="font-bold text-[#FFBD59]">{data.member.membership_number}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-zinc-400">Tier</span>
                <p className="font-bold uppercase text-emerald-400">{data.member.tier}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-zinc-400">Student ID</span>
                <p className="text-zinc-200">{data.member.student_id || 'N/A'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-zinc-400">Valid Until</span>
                <p className="text-zinc-200">{data.member.expires}</p>
              </div>
            </div>

            <button
              onClick={() => { setData(null); setCode(''); }}
              className="w-full mt-4 bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 rounded-xl font-bold transition-colors text-xs"
            >
              Scan Another Code
            </button>
          </div>
        </div>
      ) : (
        /* Merch order verification card */
        <div className="w-full max-w-md bg-zinc-900 rounded-3xl mb-8 overflow-hidden border border-zinc-700 shadow-2xl">
          <div className={`p-4 text-center font-bold text-lg ${
            data.status === 'COLLECTED' ? 'bg-blue-600 text-white' :
            data.status === 'PAID' ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
          }`}>
            ORDER STATUS: {data.status}
          </div>
          <div className="p-6">
            <h2 className="text-2xl font-mono mb-1 text-white">{data.orderCode}</h2>
            <p className="text-zinc-400 text-xs mb-6">{data.customerName}</p>

            <h3 className="font-bold mb-2 text-xs text-zinc-400 uppercase tracking-wider">Line Items</h3>
            <ul className="mb-6 space-y-2">
              {data.items?.map((item: any, i: number) => (
                <li key={i} className="flex justify-between bg-black/60 p-3 rounded-xl border border-zinc-800 text-xs">
                  <span>{item.name}</span>
                  <span className="font-bold text-amber-400">Size: {item.size}</span>
                </li>
              ))}
            </ul>

            {data.status === 'PAID' && (
              <button
                onClick={markCollected}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors text-xs uppercase tracking-wider mb-3"
              >
                Mark as Collected
              </button>
            )}

            <button
              onClick={() => { setData(null); setCode(''); }}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 rounded-xl font-bold transition-colors text-xs"
            >
              Scan Another Code
            </button>
          </div>
        </div>
      )}

      {!data && (
        <div className="w-full max-w-md">
          <p className="text-center text-zinc-400 text-xs mb-3">
            Or enter Pass / Order Code manually:
          </p>
          <div className="flex">
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookup()}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-l-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-[#FFBD59] uppercase"
              placeholder="e.g. KCLMC-25-0042 or KCL-1234"
            />
            <button
              onClick={lookup}
              disabled={loading}
              className="bg-[#FFBD59] text-[#052322] px-6 py-3 rounded-r-xl font-bold hover:bg-[#FFE0A3] transition-colors disabled:opacity-50 text-xs uppercase"
            >
              {loading ? '...' : 'Verify'}
            </button>
          </div>
          {error && <p className="text-red-400 text-center text-xs mt-3">{error}</p>}
        </div>
      )}
    </div>
  );
}
