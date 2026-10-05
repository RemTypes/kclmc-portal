import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Digital Membership Pass',
  description: 'Official KCLMC digital membership card, climber verification, and emergency safety profile.',
};

export default function MembershipLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
