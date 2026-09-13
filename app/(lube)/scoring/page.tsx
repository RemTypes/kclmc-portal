import { redirect } from 'next/navigation';

/**
 * Scorecard section has been retired from public access in favor of Griptonite.
 * The full original implementation is preserved at components/legacy/ScorecardEngine.tsx
 */
export default function ScoringPage() {
  redirect('/lube');
}
