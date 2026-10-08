import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Digital Climbing Pass',
  description: "Official verified digital climbing pass for King's College London Mountaineering Club.",
};

export default function PassLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
