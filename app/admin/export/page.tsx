'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ExportPage() {
  const [matrix, setMatrix] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/orders')
      .then((res) => res.json())
      .then((data) => {
        // Build matrix: Garment x Size
        const breakdown: Record<string, Record<string, number>> = {};

        if (Array.isArray(data)) {
          data.forEach((order: any) => {
            order.items?.forEach((item: any) => {
              if (!breakdown[item.name]) {
                breakdown[item.name] = { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0, Total: 0 };
              }
              if (breakdown[item.name][item.size] !== undefined) {
                breakdown[item.name][item.size]++;
                breakdown[item.name].Total++;
              }
            });
          });
        }

        const rows = Object.keys(breakdown).map((garment) => ({
          name: garment,
          ...breakdown[garment],
        }));
        setMatrix(rows);
      })
      .catch((err) => {
        console.error('Error fetching orders for sizing export:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const downloadCSV = () => {
    if (matrix.length === 0) return;
    const header = ['Garment', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'Total'];
    const rows = matrix.map((row) => [
      row.name,
      row.XS,
      row.S,
      row.M,
      row.L,
      row.XL,
      row.XXL,
      row.Total,
    ]);

    const csvContent = [header, ...rows].map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `kclmc_printer_spec_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#041F1E] text-slate-100 p-6 md:p-10 font-sans relative overflow-hidden topo-pattern">
      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b border-[#084746] pb-4 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/admin" className="text-zinc-400 hover:text-[#FFBD59] text-xs font-mono transition-colors">
                ← Back to Dashboard
              </Link>
              <span className="text-zinc-600">/</span>
              <span className="text-xs font-mono font-bold text-[#FFBD59]">Manufacturer Export</span>
            </div>
            <h1 className="text-3xl font-black font-heading uppercase tracking-wide text-white mt-2">
              Factory Sizing Matrix
            </h1>
            <p className="text-sm text-zinc-300 mt-1">
              Garment size breakdown aggregated across active pre-orders for screen printers.
            </p>
          </div>

          <button
            onClick={downloadCSV}
            disabled={matrix.length === 0}
            className="px-5 py-2.5 bg-[#FFBD59] hover:bg-[#FFE0A3] disabled:opacity-50 text-[#052322] font-heading font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <span>📥 Download Printer Spec CSV</span>
          </button>
        </div>

        {/* Matrix Table */}
        <div className="bg-[#052322] border border-[#084746] rounded-2xl overflow-hidden shadow-2xl mb-8">
          <div className="p-5 border-b border-[#084746] flex justify-between items-center bg-[#041F1E]/80">
            <div>
              <h2 className="text-base font-bold font-heading uppercase text-white tracking-wide">
                Garment Breakdown Matrix
              </h2>
              <p className="text-xs text-zinc-400">Total garments: {matrix.reduce((acc, r) => acc + (r.Total || 0), 0)} units</p>
            </div>
            <span className="text-xs font-mono text-[#FFBD59] bg-[#084746] px-3 py-1 rounded-full border border-[#FFBD59]/30">
              Auto-Aggregated
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono">
              <thead className="bg-[#041F1E] text-zinc-400 text-xs uppercase tracking-wider border-b border-[#084746]">
                <tr>
                  <th className="p-4 font-bold text-white">Garment</th>
                  <th className="p-4 text-center">XS</th>
                  <th className="p-4 text-center">S</th>
                  <th className="p-4 text-center">M</th>
                  <th className="p-4 text-center">L</th>
                  <th className="p-4 text-center">XL</th>
                  <th className="p-4 text-center">XXL</th>
                  <th className="p-4 text-right font-bold text-[#FFBD59]">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#084746]/60 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-zinc-400">
                      Loading orders data...
                    </td>
                  </tr>
                ) : matrix.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-zinc-400">
                      No orders found in current drop window.
                    </td>
                  </tr>
                ) : (
                  matrix.map((row, i) => (
                    <tr key={i} className="hover:bg-[#084746]/30 transition-colors">
                      <td className="p-4 font-bold text-white font-sans">{row.name}</td>
                      <td className="p-4 text-center text-zinc-300">{row.XS || 0}</td>
                      <td className="p-4 text-center text-zinc-300">{row.S || 0}</td>
                      <td className="p-4 text-center text-zinc-300">{row.M || 0}</td>
                      <td className="p-4 text-center text-zinc-300">{row.L || 0}</td>
                      <td className="p-4 text-center text-zinc-300">{row.XL || 0}</td>
                      <td className="p-4 text-center text-zinc-300">{row.XXL || 0}</td>
                      <td className="p-4 text-right font-bold text-[#FFBD59] text-base">{row.Total || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-[#052322] border border-[#084746] rounded-2xl p-5 text-xs text-zinc-300 font-mono flex items-center justify-between">
          <span>Format: Standard CSV compliant with AS Colour and UK bulk printers.</span>
          <span className="text-[#FFBD59]">Live database linked</span>
        </div>
      </div>
    </div>
  );
}
