'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function MLPage() {
  const [price, setPrice] = useState<number>(20);
  const [baseDemand] = useState<number>(100);
  const [basePrice] = useState<number>(20);
  const elasticity = -1.2;

  // Underage and overage costs for Newsvendor
  const [costPrice, setCostPrice] = useState<number>(11);
  const [salvageValue, setSalvageValue] = useState<number>(4);

  // Elasticity calculations: Q = Q0 * (P / P0)^elasticity
  const projectedDemand = Math.round(baseDemand * Math.pow(price / basePrice, elasticity));
  const projectedRevenue = projectedDemand * price;
  const unitProfit = Math.max(0, price - costPrice);
  const projectedGrossMargin = projectedDemand * unitProfit;

  // Newsvendor critical fractile
  const cu = Math.max(0.1, price - costPrice); // Underage cost (lost profit)
  const co = Math.max(0.1, costPrice - salvageValue); // Overage cost (dead inventory loss)
  const criticalFractile = cu / (cu + co);

  const baseSizeDistribution = [
    { size: 'XS', share: 0.05, mean: 5 },
    { size: 'S', share: 0.22, mean: 22 },
    { size: 'M', share: 0.38, mean: 38 },
    { size: 'L', share: 0.23, mean: 23 },
    { size: 'XL', share: 0.10, mean: 10 },
    { size: 'XXL', share: 0.02, mean: 2 },
  ];

  return (
    <div className="min-h-screen bg-black text-green-400 p-6 md:p-10 font-mono">
      <div className="max-w-6xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b border-green-900 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs px-2.5 py-0.5 bg-red-950 text-red-400 border border-red-800 rounded uppercase font-bold">
                Tier 2 Whitelist
              </span>
              <span className="text-xs text-green-700">SUPERADMIN EXCLUSIVE</span>
            </div>
            <h1 className="text-3xl font-black text-red-500 mt-2">
              ML Demand Forecasting & Sizing Engine
            </h1>
            <p className="text-xs text-green-600 mt-1">
              Mathematical models for pre-order pricing elasticity and Newsvendor stochastic sizing.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/admin/modules"
              className="px-3 py-1.5 border border-green-800 text-xs text-green-400 hover:border-green-500 transition-colors"
            >
              Permissions
            </Link>
            <Link
              href="/admin"
              className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 hover:text-white transition-colors"
            >
              ← Committee Hub
            </Link>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="border border-green-900 p-4 bg-green-950/20">
            <p className="text-xs text-green-700 uppercase">Fitted Elasticity</p>
            <p className="text-2xl font-bold text-white">{elasticity}</p>
            <p className="text-[10px] text-green-600 mt-1">log-log regression</p>
          </div>
          <div className="border border-green-900 p-4 bg-green-950/20">
            <p className="text-xs text-green-700 uppercase">Critical Fractile</p>
            <p className="text-2xl font-bold text-white">{(criticalFractile * 100).toFixed(1)}%</p>
            <p className="text-[10px] text-green-600 mt-1">Service level target</p>
          </div>
          <div className="border border-green-900 p-4 bg-green-950/20">
            <p className="text-xs text-green-700 uppercase">Projected Units</p>
            <p className="text-2xl font-bold text-white">{projectedDemand} pcs</p>
            <p className="text-[10px] text-green-600 mt-1">At £{price} retail</p>
          </div>
          <div className="border border-green-900 p-4 bg-green-950/20">
            <p className="text-xs text-green-700 uppercase">Projected Gross Margin</p>
            <p className="text-2xl font-bold text-emerald-400">£{projectedGrossMargin}</p>
            <p className="text-[10px] text-green-600 mt-1">Net profit to club</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Demand Elasticity Simulator */}
          <div className="border border-green-900 p-6 bg-green-950/10 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white">1. Price Elasticity Simulator</h2>
              <span className="text-xs text-green-600">Q = Q₀ · (P / P₀)ᵉ</span>
            </div>

            <div className="mb-6">
              <div className="flex justify-between text-xs mb-2">
                <span>Test Retail Price:</span>
                <span className="text-lg font-bold text-white">£{price}</span>
              </div>
              <input
                type="range"
                min="12"
                max="40"
                step="1"
                value={price}
                onChange={e => setPrice(parseInt(e.target.value, 10))}
                className="w-full accent-green-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-green-800 mt-1">
                <span>£12 (Break-even)</span>
                <span>£20 (Benchmark)</span>
                <span>£40 (Premium)</span>
              </div>
            </div>

            {/* Elasticity Curve Chart */}
            <div className="h-44 flex items-end justify-between gap-2 border-b border-green-900 pb-2 mb-4">
              {[15, 18, 20, 22, 25, 28, 32, 36].map(testP => {
                const q = Math.round(baseDemand * Math.pow(testP / basePrice, elasticity));
                const heightPercent = Math.min(100, Math.max(10, (q / 140) * 100));
                const isSelected = testP === price;

                return (
                  <div key={testP} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-gray-400">{q}</span>
                    <div
                      className={`w-full transition-all rounded-t ${
                        isSelected ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-green-600/60'
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    ></div>
                    <span className={`text-[10px] ${isSelected ? 'text-white font-bold' : 'text-green-800'}`}>
                      £{testP}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-green-700">
              Demand elasticity is moderately elastic (e = -1.2). Raising prices above £25 causes volume to drop steeply below the 50-unit manufacturer MOQ threshold.
            </p>
          </div>

          {/* Newsvendor Sizing Distribution */}
          <div className="border border-green-900 p-6 bg-green-950/10 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white">2. Newsvendor Sizing Optimization</h2>
              <span className="text-xs text-green-600">F(Q*) = Cu / (Cu + Co)</span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
              <div>
                <label className="block text-green-700 mb-1">Manufacturer Cost (£)</label>
                <input
                  type="number"
                  value={costPrice}
                  onChange={e => setCostPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-black border border-green-900 p-2 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-green-700 mb-1">Dead-Stock Salvage (£)</label>
                <input
                  type="number"
                  value={salvageValue}
                  onChange={e => setSalvageValue(parseFloat(e.target.value) || 0)}
                  className="w-full bg-black border border-green-900 p-2 text-white text-xs"
                />
              </div>
            </div>

            {/* Sizing Distribution Bars */}
            <div className="h-44 flex items-end justify-between gap-2 border-b border-green-900 pb-2 mb-4">
              {baseSizeDistribution.map(item => {
                const optimalStock = Math.round(projectedDemand * item.share * (1 + (criticalFractile - 0.5) * 0.4));
                const heightPercent = item.share * 220;

                return (
                  <div key={item.size} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-blue-300 font-bold">{optimalStock}</span>
                    <div
                      className="w-full bg-blue-500/80 hover:bg-blue-400 transition-all rounded-t"
                      style={{ height: `${heightPercent}%` }}
                    ></div>
                    <span className="text-xs text-white font-bold">{item.size}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-green-700">
              Optimal safety stock: Medium (38%) and Large (23%) hold the highest critical safety buffer to eliminate stockout loss without risking capital on outlier sizes.
            </p>
          </div>
        </div>

        {/* Python Sandbox Execution Reference */}
        <div className="border border-green-900/60 p-6 bg-zinc-950 rounded-lg mb-8">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-white">Local Python Execution Environment</h3>
            <span className="text-xs font-mono text-green-600">ml/*.py</span>
          </div>
          <p className="text-xs text-zinc-400 mb-4">
            Standalone scripts located in <code className="text-green-400">kclmc-platform/ml/</code> execute offline model retraining:
          </p>
          <div className="bg-black p-3 rounded border border-green-950 font-mono text-xs text-green-400 space-y-1">
            <div>$ python3 ml/export_dataset.py &nbsp;&nbsp;&nbsp;&nbsp;# Pull live order telemetry into CSV</div>
            <div>$ python3 ml/01_demand_elasticity.py # Fit log-log price elasticity regression</div>
            <div>$ python3 ml/02_sizing_optimization.py # Solve Newsvendor stochastic quantile</div>
          </div>
        </div>

        {/* AI Spending Cap & Cost Guard Panel */}
        <div className="border border-emerald-900/60 p-6 bg-emerald-950/20 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">AI Spending Cap &amp; Budget Guard</h3>
            </div>
            <span className="text-xs font-mono text-emerald-400 border border-emerald-800 bg-emerald-950 px-2 py-0.5 rounded">
              ENFORCED
            </span>
          </div>
          <p className="text-xs text-zinc-300 mb-4">
            Financial safeguards protect KCLMC society accounts against runaway API usage or automated loop billing:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="bg-black/60 border border-emerald-900 p-3 rounded">
              <span className="text-zinc-500 block text-[10px] uppercase">Monthly Hard Cap</span>
              <span className="text-emerald-400 font-bold text-base">$10.00 / mo</span>
              <span className="text-[10px] text-zinc-500 block mt-0.5">Society budget cap</span>
            </div>
            <div className="bg-black/60 border border-emerald-900 p-3 rounded">
              <span className="text-zinc-500 block text-[10px] uppercase">Daily Rate Limit</span>
              <span className="text-emerald-400 font-bold text-base">$1.00 / day</span>
              <span className="text-[10px] text-zinc-500 block mt-0.5">Resets 00:00 UTC</span>
            </div>
            <div className="bg-black/60 border border-emerald-900 p-3 rounded">
              <span className="text-zinc-500 block text-[10px] uppercase">Emergency Killswitch</span>
              <span className="text-emerald-400 font-bold text-base">Armed &amp; Ready</span>
              <span className="text-[10px] text-zinc-500 block mt-0.5">Env: AI_EMERGENCY_KILLSWITCH</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
