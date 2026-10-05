import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to access your KCLMC digital membership pass or committee portal.',
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
