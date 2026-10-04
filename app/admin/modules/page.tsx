'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { modulesConfig, ModuleDefinition } from '@/config/modules.config';
import { ROLE_NAMES, Role } from '@/lib/auth';

export default function AdminModulesPage() {
  const [modules, setModules] = useState<Record<string, ModuleDefinition>>(modulesConfig);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.authenticated && data?.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggle = (id: string) => {
    setModules(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        enabled: !prev[id].enabled,
      },
    }));
  };

  const handleRoleChange = (id: string, newRole: 0 | 1 | 2) => {
    setModules(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        requiredRole: newRole,
      },
    }));
  };

  return (
    <div className="min-h-screen bg-[#041F1E] text-slate-100 p-6 md:p-10 font-sans relative overflow-hidden topo-pattern">
      <div className="max-w-6xl mx-auto relative z-10">
        {/* Breadcrumb / Top Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b border-[#084746] pb-4 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/admin" className="text-zinc-400 hover:text-[#FFBD59] text-xs font-mono transition-colors">
                ← Back to Dashboard
              </Link>
              <span className="text-zinc-600">/</span>
              <span className="text-xs font-mono font-bold text-[#FFBD59]">Modules &amp; RBAC Security</span>
            </div>
            <h1 className="text-3xl font-black font-heading uppercase tracking-wide text-white mt-2">
              Modular Architecture &amp; Permissions
            </h1>
            <p className="text-sm text-zinc-300 mt-1">
              Configure route access, toggle live modules, and enforce clearance boundaries.
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#084746] border border-[#FFBD59]/40 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-[#FFBD59]"></span>
            <span className="text-zinc-300">
              {currentUser?.email ? currentUser.email : 'Committee Session'}
            </span>
          </div>
        </div>

        {/* Security Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#052322] border border-red-900/60 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider">SuperAdmin Restriction</h3>
              <span className="px-2 py-0.5 bg-red-950 text-red-400 border border-red-800 text-[10px] rounded font-mono font-bold">
                Tier 2 Strict
              </span>
            </div>
            <p className="text-xl font-bold font-heading text-white mb-2">/admin/ml &amp; /api/telemetry</p>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Only accessible by the whitelisted SuperAdmin personal email. Non-superadmins receive an instant 403 guard redirect.
            </p>
          </div>

          <div className="bg-[#052322] border border-[#084746] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-mono font-bold text-[#FFBD59] uppercase tracking-wider">Committee Workspace</h3>
              <span className="px-2 py-0.5 bg-[#084746] text-[#FFBD59] border border-[#FFBD59]/40 text-[10px] rounded font-mono font-bold">
                Tier 1 Committee
              </span>
            </div>
            <p className="text-xl font-bold font-heading text-white mb-2">Reconcile, CMS, Export, Scan</p>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Committee-level tools for handling KCLSU shop payment matching, QR pass check-ins, and factory sizing exports.
            </p>
          </div>

          <div className="bg-[#052322] border border-[#084746] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">Public Modules</h3>
              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] rounded font-mono font-bold">
                Tier 0 Public
              </span>
            </div>
            <p className="text-xl font-bold font-heading text-white mb-2">Club Hub, Trips &amp; Guides</p>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Open to all university students for meet information, wall discounts, pass verification, and merch pre-orders.
            </p>
          </div>
        </div>

        {/* Modules Table */}
        <div className="bg-[#052322] border border-[#084746] rounded-2xl overflow-hidden shadow-2xl mb-12">
          <div className="p-5 border-b border-[#084746] flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-[#041F1E]/80">
            <div>
              <h2 className="text-lg font-bold font-heading uppercase text-white tracking-wide">
                Registered Platform Modules ({Object.keys(modules).length})
              </h2>
              <p className="text-xs text-zinc-400">Configured via config/modules.config.ts</p>
            </div>
            <span className="text-xs font-mono text-[#FFBD59] bg-[#084746] px-3 py-1 rounded-full border border-[#FFBD59]/30">
              Live Governance
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#041F1E] text-zinc-400 text-xs font-mono uppercase tracking-wider border-b border-[#084746]">
                <tr>
                  <th className="p-4">Module / Route</th>
                  <th className="p-4">Brand</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Required Role</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#084746]/60 text-sm">
                {Object.values(modules).map(mod => (
                  <tr key={mod.id} className="hover:bg-[#084746]/30 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white font-heading text-base">{mod.name}</div>
                      <div className="text-xs text-zinc-300 mt-0.5">{mod.description}</div>
                      <div className="font-mono text-xs text-[#FFBD59] mt-1">{mod.route}</div>
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-block px-2.5 py-1 text-xs font-black uppercase rounded ${
                          mod.brand === 'kclmc'
                            ? 'bg-[#084746] text-[#FFBD59] border border-[#FFBD59]/40'
                            : mod.brand === 'lube'
                            ? 'bg-zinc-800 text-white border border-zinc-600'
                            : 'bg-[#041F1E] text-zinc-300 border border-[#084746]'
                        }`}
                      >
                        {mod.brand}
                      </span>
                    </td>

                    <td className="p-4">
                      <button
                        onClick={() => handleToggle(mod.id)}
                        className={`px-3 py-1 rounded-full text-xs font-bold font-mono transition-colors ${
                          mod.enabled
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 hover:bg-emerald-900'
                            : 'bg-red-950 text-red-400 border border-red-800 hover:bg-red-900'
                        }`}
                      >
                        {mod.enabled ? '● Active' : '○ Disabled'}
                      </button>
                    </td>

                    <td className="p-4">
                      <select
                        value={mod.requiredRole}
                        onChange={e => handleRoleChange(mod.id, parseInt(e.target.value, 10) as any)}
                        className={`p-1.5 rounded text-xs font-bold font-mono border ${
                          mod.requiredRole === 2
                            ? 'bg-red-950 border-red-800 text-red-300'
                            : mod.requiredRole === 1
                            ? 'bg-[#084746] border-[#FFBD59]/40 text-[#FFBD59]'
                            : 'bg-[#041F1E] border-[#084746] text-zinc-300'
                        }`}
                      >
                        <option value={0}>Tier 0: Public</option>
                        <option value={1}>Tier 1: Committee</option>
                        <option value={2}>Tier 2: SuperAdmin Only</option>
                      </select>
                    </td>

                    <td className="p-4 text-right">
                      <Link
                        href={mod.route}
                        className="inline-block text-xs font-heading uppercase font-bold tracking-wider text-[#FFBD59] hover:text-[#FFE0A3] border border-[#FFBD59]/30 px-3 py-1.5 rounded-lg hover:bg-[#FFBD59]/10 transition-colors"
                      >
                        Open Route →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SuperAdmin Personal Email Whitelist Box */}
        <div className="bg-[#052322] border border-[#084746] rounded-2xl p-6 shadow-xl">
          <h3 className="text-base font-bold font-heading uppercase text-white mb-2">
            SuperAdmin Whitelist Configuration
          </h3>
          <p className="text-xs text-zinc-300 mb-4 leading-relaxed">
            The telemetry and admin access clearance is checked against your Supabase profile role and email whitelists configured in <code className="text-[#FFBD59] font-mono">.env.local</code>:
          </p>

          <div className="bg-[#041F1E] border border-[#084746] rounded-xl p-4 font-mono text-xs mb-4 text-[#FFBD59] space-y-1">
            <div className="text-zinc-500"># In kclmc-platform/.env.local</div>
            <div>SUPERADMIN_EMAIL=your.email@kcl.ac.uk</div>
            <div>COMMITTEE_EMAILS=president@kclmc.org,treasurer@kclmc.org,gear@kclmc.org</div>
          </div>

          <p className="text-xs text-zinc-400 font-mono">
            Officers in this list or with role &gt;= 1 in Supabase profiles automatically receive Tier 1 Committee clearance.
          </p>
        </div>
      </div>
    </div>
  );
}
