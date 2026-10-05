import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: '403 Access Denied',
  description: 'Committee officer clearance required to access this resource.',
};

export default function ForbiddenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
