'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { modulesConfig, ModuleDefinition } from '@/config/modules.config';
import { ROLE_NAMES, Role } from '@/lib/auth';

export default function AdminModulesPage() {
  const [modules, setModules] = useState<Record<string, ModuleDefinition>>(modulesConfig);
  const [currentRole, setCurrentRole] = useState<Role>(1);
  const [userEmail, setUserEmail] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    // Read cookie for active role override and email
    const cookies = document.cookie.split(';').reduce((acc, c) => {
      const [k, v] = c.trim().split('=');
      if (k && v) acc[k] = decodeURIComponent(v);
      return acc;
    }, {} as Record<string, string>);

    if (cookies['user_role_override']) {
      const parsed = parseInt(cookies['user_role_override'], 10);
      if (parsed === 0 || parsed === 1 || parsed === 2) setCurrentRole(parsed as Role);
    } else {
      setCurrentRole(1); // Default inside admin
    }

    if (cookies['user_email']) {
      setUserEmail(cookies['user_email']);
    }
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

  const handleSimulateRole = (role: Role) => {
    setCurrentRole(role);
    document.cookie = `user_role_override=${role}; path=/; max-age=86400`;
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleSetEmail = (email: string) => {
    setUserEmail(email);
    document.cookie = `user_email=${encodeURIComponent(email)}; path=/; max-age=86400`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Breadcrumb / Top Bar */}
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/admin" className="text-gray-400 hover:text-white text-sm">
                ← Back to Dashboard
              </Link>
              <span className="text-gray-600">/</span>
              <span className="text-sm font-semibold text-blue-400">Modules & RBAC Security</span>
            </div>
            <h1 className="text-3xl font-black mt-2">Modular Architecture & Page Permissions</h1>
            <p className="text-sm text-gray-400 mt-1">
              Configure route access, toggle live modules, and enforce SuperAdmin privacy boundaries.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider text-gray-400">Simulated Identity:</span>
            <div className="inline-flex rounded-lg border border-gray-700 bg-gray-800 p-1">
              {([0, 1, 2] as Role[]).map(r => (
                <button
                  key={r}
                  onClick={() => handleSimulateRole(r)}
                  className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                    currentRole === r
                      ? r === 2
                        ? 'bg-red-600 text-white shadow-sm'
                        : r === 1
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {ROLE_NAMES[r]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {savedNotice && (
          <div className="mb-6 p-3 bg-emerald-900/60 border border-emerald-500 rounded-lg text-emerald-200 text-sm">
            ✓ Session security role updated! Active test identity is now <strong>{ROLE_NAMES[currentRole]}</strong>.
          </div>
        )}

        {/* Security Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">SuperAdmin Restriction</h3>
              <span className="px-2 py-0.5 bg-red-950 text-red-400 border border-red-800 text-xs rounded font-mono">
                Tier 2 Strict
              </span>
            </div>
            <p className="text-2xl font-bold text-white mb-2">/admin/modules & Security</p>
            <p className="text-xs text-gray-400">
              Only accessible by whitelisted SuperAdmin accounts. Non-superadmins receive an instant 403 redirect.
            </p>
          </div>

          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Committee Workspace</h3>
              <span className="px-2 py-0.5 bg-blue-950 text-blue-400 border border-blue-800 text-xs rounded font-mono">
                Tier 1 Committee
              </span>
            </div>
            <p className="text-2xl font-bold text-white mb-2">/admin/reconcile, /export, /scan</p>
            <p className="text-xs text-gray-400">
              Committee-level tools for handling KCLSU shop payment matching, QR scanner check-ins, and factory sizing exports.
            </p>
          </div>

          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Public Modules</h3>
              <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded font-mono">
                Tier 0 Public
              </span>
            </div>
            <p className="text-2xl font-bold text-white mb-2">Equal-Split Hub & Drops</p>
            <p className="text-xs text-gray-400">
              Open to all university students for pre-orders, passes, and Circuit Engine circuit scorecards.
            </p>
          </div>
        </div>

        {/* Modules Table */}
        <div className="bg-gray-800/90 border border-gray-700 rounded-xl overflow-hidden shadow-xl mb-12">
          <div className="p-5 border-b border-gray-700 flex justify-between items-center">
            <h2 className="text-lg font-bold">Registered Platform Modules ({Object.keys(modules).length})</h2>
            <span className="text-xs text-gray-400">
              Configured via <code className="text-gray-300 font-mono">config/modules.config.ts</code>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-900/60 text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700">
                <tr>
                  <th className="p-4">Module / Route</th>
                  <th className="p-4">Brand</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Required Role</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/60 text-sm">
                {Object.values(modules).map(mod => (
                  <tr key={mod.id} className="hover:bg-gray-750 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white">{mod.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{mod.description}</div>
                      <div className="font-mono text-xs text-blue-400 mt-1">{mod.route}</div>
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-block px-2.5 py-1 text-xs font-black uppercase rounded ${
                          mod.brand === 'kclmc'
                            ? 'bg-[#D40026]/20 text-[#D40026] border border-[#D40026]/40'
                            : mod.brand === 'lube'
                            ? 'bg-zinc-800 text-[#F5F5F0] border border-zinc-600'
                            : 'bg-blue-900/30 text-blue-300 border border-blue-800'
                        }`}
                      >
                        {mod.brand}
                      </span>
                    </td>

                    <td className="p-4">
                      <button
                        onClick={() => handleToggle(mod.id)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                          mod.enabled
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-red-950 text-red-400 border border-red-800'
                        }`}
                      >
                        {mod.enabled ? '● Active' : '○ Disabled'}
                      </button>
                    </td>

                    <td className="p-4">
                      <select
                        value={mod.requiredRole}
                        onChange={e => handleRoleChange(mod.id, parseInt(e.target.value, 10) as any)}
                        className={`p-1.5 rounded text-xs font-bold border ${
                          mod.requiredRole === 2
                            ? 'bg-red-950 border-red-800 text-red-300'
                            : mod.requiredRole === 1
                            ? 'bg-blue-950 border-blue-800 text-blue-300'
                            : 'bg-gray-800 border-gray-600 text-gray-300'
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
                        className="inline-block text-xs font-semibold text-blue-400 hover:text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded hover:bg-blue-500/10 transition-colors"
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
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-6">
          <h3 className="text-base font-bold mb-2 text-white">SuperAdmin Whitelist Configuration</h3>
          <p className="text-xs text-gray-400 mb-4">
            To make sure you are the only one who can access the ML Telemetry workspace, specify your personal or King's email address in <code className="text-gray-300">.env.local</code>:
          </p>

          <div className="bg-black/80 border border-gray-800 rounded-lg p-4 font-mono text-xs mb-4 text-emerald-400">
            <div># In kclmc-platform/.env.local</div>
            <div>SUPERADMIN_EMAIL=your.email@kcl.ac.uk</div>
            <div>COMMITTEE_EMAILS=president@kclmc.org,treasurer@kclmc.org</div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="email"
              placeholder="Test email address (e.g. your email)"
              value={userEmail}
              onChange={e => handleSetEmail(e.target.value)}
              className="flex-1 w-full sm:w-auto bg-gray-900 border border-gray-700 px-3 py-2 text-xs rounded text-white focus:outline-none focus:border-blue-500"
            />
            <span className="text-xs text-gray-400">
              Active identity cookie: <strong>{userEmail || '(None - anonymous)'}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
