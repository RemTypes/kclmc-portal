import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BMC Insurance Portal',
  description: 'British Mountaineering Council insurance verification, member roster matching, and compliance email dispatches.',
};

export default function BmcInsuranceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
