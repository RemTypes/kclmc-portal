import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserRole, getAuthenticatedUserRole } from '@/lib/auth';
import type { Metadata } from 'next';
import AdminNav from '@/components/AdminNav';

export const metadata: Metadata = {
  title: 'Committee Admin Portal',
  description: 'Official KCLMC committee administration, payment reconciliation, and membership verification.',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      redirect('/login?next=/admin');
    }

    // Unified role resolution: checks email whitelist & Supabase profiles table
    const role = await getAuthenticatedUserRole(supabase, user);

    // Clearance check: Must be at least Committee (role >= 1)
    if (role < 1) {
      redirect('/403?req=committee&from=/admin');
    }

    return (
      <div className="min-h-screen bg-[#041F1E] text-slate-100 flex flex-col font-sans">
        <AdminNav userRole={role} />
        <div className="flex-1">
          {children}
        </div>
      </div>
    );
  } catch (err: any) {
    // If redirect was thrown by Next.js, rethrow it
    if (err?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    // Otherwise, redirect to login for safety
    redirect('/login?next=/admin');
  }
}
