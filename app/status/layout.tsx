import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUserRole } from '@/lib/auth';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'System Status | Committee Access',
  description: 'Real-time operational status, service health, and uptime monitoring for KCLMC platform services.',
};

export default async function StatusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      redirect('/login?next=/status');
    }

    const role = await getAuthenticatedUserRole(supabase, user);
    if (role < 1) {
      redirect('/403?req=committee&from=/status');
    }

    return <>{children}</>;
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    redirect('/login?next=/status');
  }
}
