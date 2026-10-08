'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNav({ userRole }: { userRole: number }) {
  const pathname = usePathname();

  const links = [
    { label: '📊 Dashboard', href: '/admin' },
    { label: '★ My Membership Pass', href: '/membership' },
    { label: '📝 Content CMS', href: '/admin/content' },
    { label: '💳 KCLSU Reconcile', href: '/admin/reconcile' },
    { label: '🛡️ BMC Form Release', href: '/admin/bmc' },
    { label: '📦 Operations Export', href: '/admin/export' },
    { label: '📷 Pass Scanner', href: '/admin/scan' },
    { label: '🛡️ Modules & RBAC', href: '/admin/modules' },
    ...(userRole >= 2 ? [{ label: '🔒 ML Telemetry', href: '/admin/ml' }] : []),
  ];

  return (
    <div className="bg-[#031817] border-b border-[#084746] sticky top-[95px] z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12 overflow-x-auto no-scrollbar">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#FFBD59]/10 text-[#FFBD59] border border-[#FFBD59]/30 mr-2">
              Admin Portal
            </span>
            {links.map((link) => {
              const isActive =
                link.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-[#084746] text-[#FFBD59] border border-[#FFBD59]/40 shadow-sm'
                      : 'text-zinc-300 hover:text-white hover:bg-[#052322]'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-3 text-xs font-mono text-zinc-400 pl-4">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Committee Clearance Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
}
