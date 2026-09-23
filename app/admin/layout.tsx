import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserRole } from '@/lib/auth';

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

    // Check role from profiles table, with fallback to email whitelist in lib/auth
    let role = getUserRole(user.email);

    if (role === 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.role) {
        role = profile.role;
      }
    }

    // Clearance check: Must be at least Committee (role >= 1)
    if (role < 1) {
      redirect('/403?req=committee');
    }

    return (
      <div className="min-h-screen bg-gray-950 text-white">
        {children}
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
