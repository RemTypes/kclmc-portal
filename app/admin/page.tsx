import React from 'react';
import Link from 'next/link';

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-3xl font-black">Committee Admin Portal</h1>
            <p className="text-sm text-gray-400 mt-1">
              KCLMC & LUBE operational suite for payments, manufacturing exports, and permissions.
            </p>
          </div>
          <span className="px-3 py-1 bg-blue-950 text-blue-400 border border-blue-800 text-xs rounded-full font-mono">
            Clearance: Tier 1 Committee
          </span>
        </div>
        
        {/* KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          {[
            { label: 'Total Merch Revenue', value: '£2,450', hint: 'KCLSU Group Buy' },
            { label: 'Orders Logged', value: '124', hint: 'Active drop window' },
            { label: 'Pending Reconciliation', value: '12', hint: 'Awaiting CSV match' },
            { label: 'Items Collected', value: '89', hint: 'Checked in at gym' }
          ].map((stat, i) => (
            <div key={i} className="bg-gray-900/80 p-6 rounded-xl border border-gray-800">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">{stat.label}</p>
              <p className="text-3xl font-black text-white">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.hint}</p>
            </div>
          ))}
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Operations Tools */}
          <div className="bg-gray-900/80 p-6 rounded-xl border border-gray-800">
            <h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
              <span>⚡ Committee Operations</span>
            </h2>
            <div className="space-y-3">
              <Link 
                href="/admin/reconcile" 
                className="block p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700/60 transition-colors group"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-blue-400 group-hover:text-blue-300">
                    → KCLSU Payment Reconciliation
                  </span>
                  <span className="text-xs bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800">
                    CSV Engine
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Upload KCLSU transaction report to match payments against pre-orders using the 3-tier algorithm.
                </p>
              </Link>

              <Link 
                href="/admin/export" 
                className="block p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700/60 transition-colors group"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-blue-400 group-hover:text-blue-300">
                    → Manufacturer Sizing Matrix Export
                  </span>
                  <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded border border-gray-700">
                    Factory CSV
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Download the size-by-garment breakdown (XS–XXL) formatted for bulk screen-printers.
                </p>
              </Link>

              <Link 
                href="/admin/scan" 
                className="block p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700/60 transition-colors group"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-blue-400 group-hover:text-blue-300">
                    → Mobile Pass Scanner & Check-in
                  </span>
                  <span className="text-xs bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                    At the Wall
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Scan QR codes or lookup order IDs to verify payment and mark items as collected.
                </p>
              </Link>
            </div>
          </div>

          {/* Governance & Strict SuperAdmin */}
          <div className="space-y-6">
            <div className="bg-gray-900/80 p-6 rounded-xl border border-gray-800">
              <h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
                <span>⚙️ System Governance</span>
              </h2>
              <Link 
                href="/admin/content" 
                className="block p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700/60 transition-colors group mb-3"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-emerald-400 group-hover:text-emerald-300">
                    → CMS Content Manager (Database)
                  </span>
                  <span className="text-xs bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                    Supabase
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Edit Trips, Guides, and Leaderboards directly without touching code.
                </p>
              </Link>
              <Link 
                href="/admin/modules" 
                className="block p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700/60 transition-colors group"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-emerald-400 group-hover:text-emerald-300">
                    → Modules & Page Permissions Manager
                  </span>
                  <span className="text-xs bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                    RBAC
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Toggle platform features (like Circuit Engine scoring), route access rules, and email whitelists.
                </p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
