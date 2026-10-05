import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Update Password',
  description: 'Set a new secure password for your KCLMC account.',
};

export default function UpdatePasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
