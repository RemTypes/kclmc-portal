import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'LUBE | London University Bouldering Events',
    template: '%s | LUBE',
  },
  description: 'London University Bouldering Events official schedule, live rankings, and series apparel.',
};

export default function LubeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
