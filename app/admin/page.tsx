'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface DashboardStats {
  rosterTotal: number;
  socialCount: number;
  recreationalCount: number;
  ordersCount: number;
  totalRevenue: number;
  pendingReconciliation: number;
  itemsCollected: number;
  loading: boolean;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    rosterTotal: 0,
    socialCount: 0,
    recreationalCount: 0,
    ordersCount: 0,
    totalRevenue: 0,
    pendingReconciliation: 0,
    itemsCollected: 0,
    loading: true,
  });

  useEffect(() => {
    async function loadStats() {
      try {
        const [rosterRes, ordersRes] = await Promise.allSettled([
          fetch('/api/roster').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/orders').then((r) => (r.ok ? r.json() : null)),
        ]);

        let rosterTotal = 0;
        let socialCount = 0;
        let recreationalCount = 0;
        if (rosterRes.status === 'fulfilled' && rosterRes.value) {
          rosterTotal = rosterRes.value.total || 0;
          socialCount = rosterRes.value.socialCount || 0;
          recreationalCount = rosterRes.value.recreationalCount || 0;
        }

        let ordersCount = 0;
        let totalRevenue = 0;
        let pendingReconciliation = 0;
        let itemsCollected = 0;

        if (ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value)) {
          const orders = ordersRes.value;
          ordersCount = orders.length;
          orders.forEach((o: any) => {
            totalRevenue += o.total ? o.total : (o.totalPence ? o.totalPence / 100 : 0);
            if (o.status === 'PENDING' || !o.reconciled) pendingReconciliation++;
            if (o.status === 'COLLECTED') itemsCollected++;
          });
        }

        setStats({
          rosterTotal: rosterTotal,
          socialCount: socialCount,
          recreationalCount: recreationalCount,
          ordersCount: ordersCount,
          totalRevenue: totalRevenue,
          pendingReconciliation: pendingReconciliation,
          itemsCollected: itemsCollected,
          loading: false,
        });
      } catch (err) {
        console.error('Error loading dashboard stats:', err);
        setStats((s) => ({ ...s, loading: false }));
      }
    }

    loadStats();
  }, []);

  return (
    <div className="min-h-screen bg-[#041F1E] text-slate-100 p-6 md:p-10 font-sans relative overflow-hidden topo-pattern">
      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b border-[#084746] pb-5 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD59] animate-pulse"></span>
              <span className="text-xs font-mono uppercase tracking-wider text-[#FFBD59]">
                KCLSU Chartered Club Operations
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black font-heading uppercase tracking-wide text-white">
              Committee Admin Portal
            </h1>
            <p className="text-sm text-zinc-300 mt-1 max-w-xl leading-relaxed">
              Operational control centre for KCLSU roster validation, pre-order payment reconciliation, factory exports, and club CMS.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="px-3.5 py-1.5 bg-[#084746] text-[#FFBD59] border border-[#FFBD59]/40 text-xs rounded-full font-mono font-bold shadow-sm">
              Clearance: Tier 1 Committee
            </span>
            <span className="text-[11px] text-zinc-400 font-mono">
              Live Database Connected
            </span>
          </div>
        </div>

        {/* Live KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          <div className="bg-[#052322] p-5 rounded-2xl border border-[#084746] shadow-xl hover:border-[#FFBD59]/40 transition-colors">
            <p className="text-zinc-400 text-xs font-mono font-bold uppercase tracking-wider mb-1">
              Active Roster
            </p>
            <p className="text-3xl font-black font-heading text-white tracking-tight">
              {stats.loading ? '...' : stats.rosterTotal}
            </p>
            <p className="text-xs text-[#FFBD59] mt-2 font-mono">
              {stats.recreationalCount} Recreational • {stats.socialCount} Social
            </p>
          </div>

          <div className="bg-[#052322] p-5 rounded-2xl border border-[#084746] shadow-xl hover:border-[#FFBD59]/40 transition-colors">
            <p className="text-zinc-400 text-xs font-mono font-bold uppercase tracking-wider mb-1">
              Merch Orders
            </p>
            <p className="text-3xl font-black font-heading text-white tracking-tight">
              {stats.loading ? '...' : stats.ordersCount}
            </p>
            <p className="text-xs text-zinc-300 mt-2 font-mono">
              Est. £{stats.totalRevenue.toLocaleString()} volume
            </p>
          </div>

          <div className="bg-[#052322] p-5 rounded-2xl border border-[#084746] shadow-xl hover:border-[#FFBD59]/40 transition-colors">
            <p className="text-zinc-400 text-xs font-mono font-bold uppercase tracking-wider mb-1">
              Awaiting Reconciliation
            </p>
            <p className="text-3xl font-black font-heading text-amber-400 tracking-tight">
              {stats.loading ? '...' : stats.pendingReconciliation}
            </p>
            <p className="text-xs text-zinc-300 mt-2 font-mono">
              Unmatched CSV bank records
            </p>
          </div>

          <div className="bg-[#052322] p-5 rounded-2xl border border-[#084746] shadow-xl hover:border-[#FFBD59]/40 transition-colors">
            <p className="text-zinc-400 text-xs font-mono font-bold uppercase tracking-wider mb-1">
              Items Collected
            </p>
            <p className="text-3xl font-black font-heading text-emerald-400 tracking-tight">
              {stats.loading ? '...' : stats.itemsCollected}
            </p>
            <p className="text-xs text-zinc-300 mt-2 font-mono">
              Passes scanned at wall
            </p>
          </div>
        </div>

        {/* Operational Grid */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Operations & Finance Tools */}
          <div className="bg-[#052322] p-6 rounded-2xl border border-[#084746] shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5 border-b border-[#084746] pb-3">
                <h2 className="text-lg font-bold font-heading uppercase text-white flex items-center gap-2">
                  <span>⚡ Fulfilment &amp; Verification</span>
                </h2>
                <span className="text-[11px] font-mono text-[#FFBD59] bg-[#084746] px-2.5 py-0.5 rounded-full">
                  Primary Flow
                </span>
              </div>

              <div className="space-y-3.5">
                <Link
                  href="/admin/reconcile"
                  className="block p-4 rounded-xl bg-[#084746]/40 hover:bg-[#084746] border border-[#0D5F5E] transition-all group shadow-sm"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-base text-white group-hover:text-[#FFBD59] transition-colors font-heading tracking-wide">
                      → KCLSU Payment Reconciliation
                    </span>
                    <span className="text-[10px] bg-[#031817] text-[#FFBD59] px-2 py-0.5 rounded font-mono border border-[#FFBD59]/30">
                      CSV Engine
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Upload KCLSU transaction report to match payments against pre-orders using the 3-tier algorithm, or sync new student memberships.
                  </p>
                </Link>

                <Link
                  href="/admin/export"
                  className="block p-4 rounded-xl bg-[#084746]/40 hover:bg-[#084746] border border-[#0D5F5E] transition-all group shadow-sm"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-base text-white group-hover:text-[#FFBD59] transition-colors font-heading tracking-wide">
                      → Manufacturer Sizing Matrix Export
                    </span>
                    <span className="text-[10px] bg-[#031817] text-zinc-300 px-2 py-0.5 rounded font-mono border border-[#084746]">
                      Factory CSV
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Download the garment size breakdown (XS–XXL) formatted for bulk screen-printers with automated MOQ thresholds.
                  </p>
                </Link>

                <Link
                  href="/admin/scan"
                  className="block p-4 rounded-xl bg-[#084746]/40 hover:bg-[#084746] border border-[#0D5F5E] transition-all group shadow-sm"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-base text-white group-hover:text-[#FFBD59] transition-colors font-heading tracking-wide">
                      → Pass Scanner &amp; Check-in
                    </span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded font-mono border border-emerald-800">
                      At The Wall
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Scan digital QR passes or search KCL student IDs to verify recreational membership and mark merch collection.
                  </p>
                </Link>

                <Link
                  href="/admin/bmc"
                  className="block p-4 rounded-xl bg-[#084746]/40 hover:bg-[#084746] border border-[#0D5F5E] transition-all group shadow-sm"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-base text-white group-hover:text-[#FFBD59] transition-colors font-heading tracking-wide">
                      → BMC Insurance Form Release
                    </span>
                    <span className="text-[10px] bg-amber-950 text-amber-300 px-2 py-0.5 rounded font-mono border border-amber-800">
                      Safety &amp; Compliance
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Filter recreational climbing members from KCLSU sales reports, auto-generate KCL student emails, and broadcast or mail-merge BMC registration links.
                  </p>
                </Link>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#084746] flex items-center justify-between text-xs text-zinc-400 font-mono">
              <span>All changes persist to Supabase DB</span>
              <span className="text-[#FFBD59]">Cloudflare Edge Synced</span>
            </div>
          </div>

          {/* CMS & Security */}
          <div className="space-y-6 flex flex-col justify-between">
            <div className="bg-[#052322] p-6 rounded-2xl border border-[#084746] shadow-2xl">
              <div className="flex items-center justify-between mb-5 border-b border-[#084746] pb-3">
                <h2 className="text-lg font-bold font-heading uppercase text-white flex items-center gap-2">
                  <span>📝 Content Management &amp; System</span>
                </h2>
                <span className="text-[11px] font-mono text-[#FFBD59] bg-[#084746] px-2.5 py-0.5 rounded-full">
                  Live CMS
                </span>
              </div>

              <div className="space-y-3.5">
                <Link
                  href="/admin/content"
                  className="block p-4 rounded-xl bg-[#084746]/40 hover:bg-[#084746] border border-[#0D5F5E] transition-all group shadow-sm"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-base text-white group-hover:text-[#FFBD59] transition-colors font-heading tracking-wide">
                      → CMS Content Manager
                    </span>
                    <span className="text-[10px] bg-[#031817] text-[#FFBD59] px-2 py-0.5 rounded font-mono border border-[#FFBD59]/30">
                      Database Tables
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Create and publish club meets, crags &amp; gym discount guides, UKC topo links, and active merch items directly without code deploys.
                  </p>
                </Link>

                <Link
                  href="/admin/modules"
                  className="block p-4 rounded-xl bg-[#084746]/40 hover:bg-[#084746] border border-[#0D5F5E] transition-all group shadow-sm"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-base text-white group-hover:text-[#FFBD59] transition-colors font-heading tracking-wide">
                      → Modular Permissions &amp; RBAC
                    </span>
                    <span className="text-[10px] bg-[#031817] text-zinc-300 px-2 py-0.5 rounded font-mono border border-[#084746]">
                      Access Guard
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Control module enablement, route-level role requirements, and view officer whitelist boundaries.
                  </p>
                </Link>
              </div>
            </div>

            {/* SuperAdmin Callout */}
            <div className="bg-[#052322] border border-red-900/50 p-6 rounded-2xl shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold font-heading uppercase text-red-400 flex items-center gap-2">
                  <span>🔒 SuperAdmin ML Suite</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-red-950 text-red-400 border border-red-800 rounded font-bold">
                  Tier 2 Whitelist
                </span>
              </div>
              <p className="text-xs text-zinc-300 mb-4 leading-relaxed">
                Proprietary demand price elasticity models and Newsvendor safety stock optimization tools for bulk garment orders.
              </p>
              <Link
                href="/admin/ml"
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-950/80 hover:bg-red-900/80 border border-red-700 text-red-300 hover:text-white rounded-xl text-xs font-mono font-bold transition-colors"
              >
                Launch ML Telemetry Suite →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
