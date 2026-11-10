import type { Metadata } from 'next';
import React from 'react';
import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth/server';

export const metadata: Metadata = {
  title: 'ML Telemetry & Analytics',
  description: 'SuperAdmin demand elasticity and inventory optimization models.',
};

export default async function MlLayout({ children }: { children: React.ReactNode }) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      redirect('/login');
    }

    if (user.role < 2) {
      redirect('/admin?error=insufficient_clearance');
    }

    return <>{children}</>;
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    redirect('/login');
  }
}

