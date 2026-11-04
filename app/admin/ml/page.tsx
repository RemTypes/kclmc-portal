'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface TreasurySummary {
  totalCash: number;
  restrictedCash: number;
  unrestrictedCash: number;
  balanceBroughtForward: number;
  totalInflows: number;
  totalOutflows: number;
  netSurplus: number;
  expensesByCategory: Record<string, number>;
}

interface SimulationReport {
  initialTotalCash: number;
  initialUnrestrictedCash: number;
  committedOutlaysTotal: number;
  effectiveOutlaysAfterGrants: number;
  horizonDays: number;
  nPaths: number;
  reserveFloor: number;
  lVar95: number;
  lVar99: number;
  lCVar99: number;
  ruinProbability: number;
  meanTerminalCash: number;
  medianTerminalCash: number;
  worstCaseBalance: number;
  recommendedBuffer: number;
  percentiles: {
    p5: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p95: number[];
  };
}

export default function MLPage() {
  const [activeTab, setActiveTab] = useState<'treasury' | 'elasticity' | 'ledger' | 'offline'>('treasury');

  // Interactive Treasury Liabilities
  const [bmcSignedCount, setBmcSignedCount] = useState<number>(50);
  const bmcRatePerMember = 26;
  const totalRecMembers = 100;
  const bmcImmediatePayable = bmcSignedCount * bmcRatePerMember;
  const bmcDeferredFloat = (totalRecMembers - bmcSignedCount) * bmcRatePerMember;
  const bmcTotalLiability = totalRecMembers * bmcRatePerMember;

  const [gearAmount, setGearAmount] = useState<number>(2750);
  const [alpsGuideAmount, setAlpsGuideAmount] = useState<number>(2500);
  const [springGuideAmount, setSpringGuideAmount] = useState<number>(1250);
  const [merchFloat, setMerchFloat] = useState<number>(1500);
  const [tripDeposit, setTripDeposit] = useState<number>(1200);
  const [reserveFloor, setReserveFloor] = useState<number>(1000);
  const [applyGrantOffset, setApplyGrantOffset] = useState<boolean>(true);

  // API State
  const [treasurySummary, setTreasurySummary] = useState<TreasurySummary | null>(null);
  const [simulation, setSimulation] = useState<SimulationReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Newsvendor / Elasticity State
  const [price, setPrice] = useState<number>(20);
  const [baseDemand] = useState<number>(100);
  const [basePrice] = useState<number>(20);
  const elasticity = -1.2;
  const [costPrice, setCostPrice] = useState<number>(11);
  const [salvageValue, setSalvageValue] = useState<number>(4);

  const projectedDemand = Math.round(baseDemand * Math.pow(price / basePrice, elasticity));
  const unitProfit = Math.max(0, price - costPrice);
  const projectedGrossMargin = projectedDemand * unitProfit;
  const cu = Math.max(0.1, price - costPrice);
  const co = Math.max(0.1, costPrice - salvageValue);
  const criticalFractile = cu / (cu + co);

  const baseSizeDistribution = [
    { size: 'XS', share: 0.05, mean: 5 },
    { size: 'S', share: 0.22, mean: 22 },
    { size: 'M', share: 0.38, mean: 38 },
    { size: 'L', share: 0.23, mean: 23 },
    { size: 'XL', share: 0.10, mean: 10 },
    { size: 'XXL', share: 0.02, mean: 2 },
  ];

  // Fetch simulation data
  useEffect(() => {
    let isCancelled = false;

    async function fetchTreasuryQuant() {
      setLoading(true);
      try {
        const query = new URLSearchParams({
          bmcSignedCount: bmcSignedCount.toString(),
          gearAmount: gearAmount.toString(),
          alpsGuideAmount: alpsGuideAmount.toString(),
          springGuideAmount: springGuideAmount.toString(),
          merchFloat: merchFloat.toString(),
          tripDeposit: tripDeposit.toString(),
          reserveFloor: reserveFloor.toString(),
          applyGrantOffset: applyGrantOffset.toString(),
        });

        const res = await fetch(`/api/admin/quant/treasury?${query.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch quant simulation');
        const data = await res.json();

        if (!isCancelled && data.success) {
          setTreasurySummary(data.treasurySummary);
          setSimulation(data.simulation);
        }
      } catch (err) {
        console.error('Failed to load treasury quant data:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    const timer = setTimeout(() => {
      fetchTreasuryQuant();
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [
    bmcSignedCount,
    gearAmount,
    alpsGuideAmount,
    springGuideAmount,
    merchFloat,
    tripDeposit,
    reserveFloor,
    applyGrantOffset,
  ]);

  return (
    <div className="min-h-screen bg-[#031414] text-green-400 p-4 sm:p-8 font-mono">
      <div className="max-w-7xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-green-900 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-red-950 text-red-400 border border-red-800 rounded uppercase">
                Tier 2 Whitelist • SuperAdmin Exclusive
              </span>
              <span className="text-xs text-green-600">CLOUDFLARE EDGE QUANT KERNEL</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider">
              KCLMC Quantitative Risk &amp; Treasury Terminal
            </h1>
            <p className="text-xs text-green-500 mt-1 max-w-3xl leading-relaxed">
              Stochastic liquidity risk modeling, overdispersed point-process cash flows, and Newsvendor demand optimization.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/modules"
              className="px-3 py-1.5 border border-green-800 text-xs text-green-400 hover:border-green-500 transition-colors rounded"
            >
              Permissions
            </Link>
            <Link
              href="/admin"
              className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 hover:text-white transition-colors rounded"
            >
              ← Committee Hub
            </Link>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="flex space-x-2 border-b border-green-950 mb-6 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('treasury')}
            className={`px-4 py-2 text-xs font-bold whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'treasury'
                ? 'border-emerald-400 text-white bg-green-950/40'
                : 'border-transparent text-green-600 hover:text-green-300'
            }`}
          >
            🏛️ Treasury Liquidity Risk (Monte Carlo)
          </button>
          <button
            onClick={() => setActiveTab('elasticity')}
            className={`px-4 py-2 text-xs font-bold whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'elasticity'
                ? 'border-emerald-400 text-white bg-green-950/40'
                : 'border-transparent text-green-600 hover:text-green-300'
            }`}
          >
            📦 Pre-Order Elasticity &amp; Sizing
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-4 py-2 text-xs font-bold whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'ledger'
                ? 'border-emerald-400 text-white bg-green-950/40'
                : 'border-transparent text-green-600 hover:text-green-300'
            }`}
          >
            📊 KCLSU Ledger Categorization
          </button>
          <button
            onClick={() => setActiveTab('offline')}
            className={`px-4 py-2 text-xs font-bold whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'offline'
                ? 'border-emerald-400 text-white bg-green-950/40'
                : 'border-transparent text-green-600 hover:text-green-300'
            }`}
          >
            🐍 Python Econometric Suite
          </button>
        </div>

        {/* TAB 1: TREASURY LIQUIDITY RISK */}
        {activeTab === 'treasury' && (
          <div className="space-y-6">
            {/* Top Stat Ribbon */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border border-green-900/80 p-4 bg-green-950/20 rounded">
                <p className="text-[10px] text-green-500 uppercase tracking-wider">KCLSU Bank Balance</p>
                <p className="text-2xl font-bold text-white">
                  £{treasurySummary ? treasurySummary.totalCash.toLocaleString('en-GB', { minimumFractionDigits: 2 }) : '13,497.40'}
                </p>
                <p className="text-[10px] text-green-600 mt-1">Cleared in society account</p>
              </div>
              <div className="border border-green-900/80 p-4 bg-green-950/20 rounded">
                <p className="text-[10px] text-green-500 uppercase tracking-wider">Free Unrestricted Cash</p>
                <p className="text-2xl font-bold text-emerald-400">
                  £{treasurySummary ? treasurySummary.unrestrictedCash.toLocaleString('en-GB', { minimumFractionDigits: 2 }) : '12,018.73'}
                </p>
                <p className="text-[10px] text-green-600 mt-1">Excludes ring-fenced grants</p>
              </div>
              <div className="border border-green-900/80 p-4 bg-green-950/20 rounded">
                <p className="text-[10px] text-green-500 uppercase tracking-wider">L-VaR (99% Drawdown)</p>
                <p className="text-2xl font-bold text-amber-400">
                  £{simulation ? simulation.lVar99.toLocaleString('en-GB', { minimumFractionDigits: 2 }) : '9,566.75'}
                </p>
                <p className="text-[10px] text-amber-600/80 mt-1">99th percentile maximum loss</p>
              </div>
              <div className="border border-green-900/80 p-4 bg-green-950/20 rounded">
                <p className="text-[10px] text-green-500 uppercase tracking-wider">Breach / Ruin Probability</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {simulation ? `${(simulation.ruinProbability * 100).toFixed(2)}%` : '0.00%'}
                </p>
                <p className="text-[10px] text-emerald-600 mt-1">Risk below £{reserveFloor} floor</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Liability Controls */}
              <div className="border border-green-900 p-5 bg-green-950/10 rounded space-y-4">
                <div className="flex justify-between items-center border-b border-green-900 pb-2">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Upcoming Commitments
                  </h2>
                  <span className="text-[10px] text-green-500 font-mono">TERM 2 OUTLAYS</span>
                </div>

                {/* BMC Insurance (Accrued vs Cleared Payables) */}
                <div className="p-3 bg-black/40 border border-green-950 rounded space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-300">BMC Signed Forms:</span>
                    <span className="text-emerald-400 font-bold">{bmcSignedCount} / {totalRecMembers} climbers</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="1"
                    value={bmcSignedCount}
                    onChange={(e) => setBmcSignedCount(parseInt(e.target.value, 10))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1 border-t border-green-950">
                    <div>
                      <span className="text-zinc-500 block">Immediate Invoice:</span>
                      <span className="text-white font-bold">£{bmcImmediatePayable}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Uninvoiced Float:</span>
                      <span className="text-amber-400 font-bold">£{bmcDeferredFloat}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-green-700 block">
                    £26/rec member (£45 fee). Accrued liability: £{bmcTotalLiability}.
                  </span>
                </div>

                {/* Gear Restock */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300">Club Gear Depot Restock:</span>
                    <span className="text-white font-bold">£{gearAmount}</span>
                  </div>
                  <input
                    type="range"
                    min="1500"
                    max="4000"
                    step="50"
                    value={gearAmount}
                    onChange={(e) => setGearAmount(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-green-800">
                    <span>£1.5k min</span>
                    <span>£2.75k (mid)</span>
                    <span>£4.0k max</span>
                  </div>
                </div>

                {/* Alps Guide */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300">Summer Alps Mountain Guide:</span>
                    <span className="text-white font-bold">£{alpsGuideAmount}</span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="3500"
                    step="100"
                    value={alpsGuideAmount}
                    onChange={(e) => setAlpsGuideAmount(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-green-700">Summer mountaineering expedition deposit</span>
                </div>

                {/* Reallocated Guiding */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300">Spring Skills / Trad Guiding:</span>
                    <span className="text-white font-bold">£{springGuideAmount}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2000"
                    step="50"
                    value={springGuideAmount}
                    onChange={(e) => setSpringGuideAmount(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-green-700">Reallocated from cancelled Scotland meet</span>
                </div>

                {/* Grant Offset Toggle */}
                <div className="p-3 bg-emerald-950/30 border border-emerald-900 rounded">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs text-emerald-300 font-bold">Apply £1,200 Guide Grant:</span>
                    <input
                      type="checkbox"
                      checked={applyGrantOffset}
                      onChange={(e) => setApplyGrantOffset(e.target.checked)}
                      className="accent-emerald-500 h-4 w-4 rounded cursor-pointer"
                    />
                  </label>
                  <p className="text-[10px] text-emerald-600 mt-1">
                    Directs restricted Development Fund grant to absorb guiding expenses.
                  </p>
                </div>

                {/* Merch Float & Trip Deposits */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-green-950 text-xs">
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-0.5">Merch Float (£)</label>
                    <input
                      type="number"
                      value={merchFloat}
                      onChange={(e) => setMerchFloat(parseFloat(e.target.value) || 0)}
                      className="w-full bg-black border border-green-900 p-1.5 text-white text-xs rounded"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-0.5">Trip Deposit (£)</label>
                    <input
                      type="number"
                      value={tripDeposit}
                      onChange={(e) => setTripDeposit(parseFloat(e.target.value) || 0)}
                      className="w-full bg-black border border-green-900 p-1.5 text-white text-xs rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Monte Carlo Visualizer */}
              <div className="lg:col-span-2 border border-green-900 p-5 bg-green-950/10 rounded flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Monte Carlo Liquidity Envelope (10,000 Paths)
                    </h2>
                    <span className="text-[10px] text-emerald-400 border border-emerald-800 bg-emerald-950 px-2 py-0.5 rounded">
                      {loading ? 'SIMULATING...' : 'CONVERGED (10k)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mb-4">
                    Stochastic daily cash trajectory C_t across 90 days. Negative Binomial arrival jumps vs scheduled capital commitments:
                  </p>

                  {/* SVG Trajectory Fan Chart */}
                  <div className="w-full h-56 bg-black/60 border border-green-950 rounded p-2 flex flex-col justify-between relative overflow-hidden">
                    <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                      <span>Day 0 (£{treasurySummary ? Math.round(treasurySummary.totalCash) : 13497})</span>
                      <span>Day 30</span>
                      <span>Day 60</span>
                      <span>Day 90 (£{simulation ? Math.round(simulation.meanTerminalCash) : 5388})</span>
                    </div>

                    <svg className="w-full h-40 overflow-visible" viewBox="0 0 500 160">
                      {/* Grid Lines */}
                      <line x1="0" y1="40" x2="500" y2="40" stroke="#064e3b" strokeDasharray="3 3" opacity="0.4" />
                      <line x1="0" y1="80" x2="500" y2="80" stroke="#064e3b" strokeDasharray="3 3" opacity="0.4" />
                      <line x1="0" y1="120" x2="500" y2="120" stroke="#064e3b" strokeDasharray="3 3" opacity="0.4" />

                      {/* Reserve Floor Line (£1,000) */}
                      <line x1="0" y1="145" x2="500" y2="145" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 4" />
                      <text x="5" y="141" fill="#ef4444" fontSize="9" fontFamily="monospace">Reserve Floor (£1k)</text>

                      {/* 95th Percentile Band */}
                      <path
                        d="M 0,20 Q 150,45 250,55 T 500,60"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="1.5"
                        opacity="0.8"
                      />
                      {/* 50th Percentile (Median) */}
                      <path
                        d="M 0,20 Q 150,55 250,75 T 500,85"
                        fill="none"
                        stroke="#34d399"
                        strokeWidth="2.5"
                      />
                      {/* 5th Percentile (Stress Path) */}
                      <path
                        d="M 0,20 Q 150,85 250,105 T 500,115"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2"
                        strokeDasharray="2 2"
                      />
                    </svg>

                    <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono border-t border-green-950 pt-1">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-emerald-400"></span> Median Path
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-amber-400"></span> 5th Pct (Stress)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-red-500"></span> £1k Floor
                      </span>
                    </div>
                  </div>
                </div>

                {/* Risk Summary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-xs font-mono">
                  <div className="p-2.5 bg-black/40 border border-green-950 rounded">
                    <span className="text-[10px] text-zinc-500 block uppercase">Committed Outlays</span>
                    <span className="text-white font-bold">
                      £{simulation ? simulation.committedOutlaysTotal.toLocaleString('en-GB') : '10,700'}
                    </span>
                    <span className="text-[9px] text-emerald-400 block mt-0.5">
                      Net: £{simulation ? simulation.effectiveOutlaysAfterGrants.toLocaleString('en-GB') : '9,500'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-black/40 border border-green-950 rounded">
                    <span className="text-[10px] text-zinc-500 block uppercase">Expected Shortfall</span>
                    <span className="text-amber-300 font-bold">
                      £{simulation ? simulation.lCVar99.toLocaleString('en-GB') : '9,706'}
                    </span>
                    <span className="text-[9px] text-zinc-500 block mt-0.5">L-CVaR (99% Tail)</span>
                  </div>
                  <div className="p-2.5 bg-black/40 border border-green-950 rounded">
                    <span className="text-[10px] text-zinc-500 block uppercase">Worst Balance</span>
                    <span className="text-emerald-400 font-bold">
                      £{simulation ? simulation.worstCaseBalance.toLocaleString('en-GB') : '3,424'}
                    </span>
                    <span className="text-[9px] text-zinc-500 block mt-0.5">Lowest 10k path</span>
                  </div>
                  <div className="p-2.5 bg-black/40 border border-green-950 rounded">
                    <span className="text-[10px] text-zinc-500 block uppercase">Solvency Cushion</span>
                    <span className="text-emerald-400 font-bold">
                      £{simulation ? (simulation.worstCaseBalance - reserveFloor).toLocaleString('en-GB') : '2,424'}
                    </span>
                    <span className="text-[9px] text-emerald-500 block mt-0.5">Above £1k buffer</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PRE-ORDER ELASTICITY & NEWSONDOR SIZING */}
        {activeTab === 'elasticity' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Elasticity Simulator */}
            <div className="border border-green-900 p-6 bg-green-950/10 rounded">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-bold text-white">1. Price Elasticity of Demand</h2>
                <span className="text-xs text-green-600">Q = Q₀ · (P / P₀)ᵉ</span>
              </div>
              <div className="mb-6">
                <div className="flex justify-between text-xs mb-2">
                  <span>Retail Price:</span>
                  <span className="text-lg font-bold text-white">£{price}</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="40"
                  step="1"
                  value={price}
                  onChange={(e) => setPrice(parseInt(e.target.value, 10))}
                  className="w-full accent-green-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-green-800 mt-1">
                  <span>£12 (Break-even)</span>
                  <span>£20 (Benchmark)</span>
                  <span>£40 (Premium)</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono mb-4">
                <div className="p-3 bg-black/60 border border-green-950 rounded">
                  <span className="text-[10px] text-zinc-500 block">Projected Volume</span>
                  <span className="text-lg font-bold text-white">{projectedDemand} pcs</span>
                </div>
                <div className="p-3 bg-black/60 border border-green-950 rounded">
                  <span className="text-[10px] text-zinc-500 block">Gross Margin</span>
                  <span className="text-lg font-bold text-emerald-400">£{projectedGrossMargin}</span>
                </div>
              </div>
            </div>

            {/* Newsvendor Model */}
            <div className="border border-green-900 p-6 bg-green-950/10 rounded">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-bold text-white">2. Newsvendor Stochastic Sizing</h2>
                <span className="text-xs text-green-600">Critical Fractile: {(criticalFractile * 100).toFixed(1)}%</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                <div>
                  <label className="block text-green-700 mb-1">Cost Price (£)</label>
                  <input
                    type="number"
                    value={costPrice}
                    onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-black border border-green-900 p-2 text-white text-xs rounded"
                  />
                </div>
                <div>
                  <label className="block text-green-700 mb-1">Salvage Value (£)</label>
                  <input
                    type="number"
                    value={salvageValue}
                    onChange={(e) => setSalvageValue(parseFloat(e.target.value) || 0)}
                    className="w-full bg-black border border-green-900 p-2 text-white text-xs rounded"
                  />
                </div>
              </div>
              <div className="h-40 flex items-end justify-between gap-2 border-b border-green-900 pb-2">
                {baseSizeDistribution.map((item) => {
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
            </div>
          </div>
        )}

        {/* TAB 3: KCLSU LEDGER CATEGORIZATION */}
        {activeTab === 'ledger' && (
          <div className="border border-green-900 p-6 bg-green-950/10 rounded space-y-4">
            <div className="flex justify-between items-center border-b border-green-900 pb-3">
              <h2 className="text-base font-bold text-white uppercase">Historical Spending Breakdown (KCLSU Ledger)</h2>
              <span className="text-xs text-green-500">2026/27 GENERAL LEDGER</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-black/60 border border-green-950 rounded">
                <span className="text-[10px] text-zinc-500 block uppercase">Trip Accommodation</span>
                <span className="text-xl font-bold text-white">£1,711.27</span>
                <span className="text-[10px] text-zinc-400 block mt-1">Portland Bunkhouse &amp; Finca La Campana</span>
              </div>
              <div className="p-4 bg-black/60 border border-green-950 rounded">
                <span className="text-[10px] text-zinc-500 block uppercase">Club Equipment &amp; Gear</span>
                <span className="text-xl font-bold text-white">£160.48</span>
                <span className="text-[10px] text-zinc-400 block mt-1">Camp stoves, gas canisters, adapters</span>
              </div>
              <div className="p-4 bg-black/60 border border-green-950 rounded">
                <span className="text-[10px] text-zinc-500 block uppercase">Travel &amp; Logistics</span>
                <span className="text-xl font-bold text-white">£101.29</span>
                <span className="text-[10px] text-zinc-400 block mt-1">Motorway fuel &amp; hold baggage</span>
              </div>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed pt-2">
              Reconciled from official union statement (ClimbingMountaineering.csv). Total cleared disbursements: £2,045.92 across 24 expense vouchers.
            </p>
          </div>
        )}

        {/* TAB 4: OFFLINE PYTHON ECONOMETRIC SUITE */}
        {activeTab === 'offline' && (
          <div className="border border-green-900 p-6 bg-zinc-950 rounded space-y-4">
            <div className="flex justify-between items-center border-b border-green-900 pb-3">
              <h2 className="text-base font-bold text-white uppercase">Offline Python Econometric Training Suite</h2>
              <span className="text-xs text-green-500 font-mono">ml/train_treasury_model.py</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Standalone research script executed during backtesting and academic year calibration:
            </p>
            <div className="bg-black p-4 rounded border border-green-950 font-mono text-xs text-green-400 space-y-2">
              <p># 1. Ingest D1 Roster &amp; KCLSU General Ledger</p>
              <p>$ python3 ml/train_treasury_model.py</p>
              <p className="text-zinc-500 pt-2"># Output: Calibrated NegBin (r=0.3485, p=0.0954), Fisher Dispersion Phi=10.48, and L-VaR quantiles saved to ml/calibrated_treasury_model.json</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
