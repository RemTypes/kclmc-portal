/**
 * KCLMC Platform - Production Environment & Secrets Guard
 * Validates that production environments do NOT run with test keys or insecure defaults.
 */

export interface EnvValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

export function validateProductionSecrets(): EnvValidationResult {
  const isProd = process.env.NODE_ENV === 'production';
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Stripe & Payment Provider Verification
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

  if (isProd) {
    if (stripeSecretKey.startsWith('sk_test_')) {
      errors.push('CRITICAL: STRIPE_SECRET_KEY is configured with a test key (sk_test_...) in production environment!');
    }
    if (stripePublishableKey.startsWith('pk_test_')) {
      errors.push('CRITICAL: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is configured with a test key (pk_test_...) in production environment!');
    }
  }

  // 2. Supabase URL & Keys Verification
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (isProd && supabaseUrl.includes('localhost')) {
    errors.push('CRITICAL: NEXT_PUBLIC_SUPABASE_URL points to localhost in production.');
  }

  // 3. Platform Site Canonical URL Verification (Kill localhost URLs)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  if (isProd && siteUrl.includes('localhost')) {
    errors.push('CRITICAL: NEXT_PUBLIC_SITE_URL points to localhost in production.');
  }

  // 4. Admin credentials
  const superadminEmail = process.env.SUPERADMIN_EMAIL || '';
  if (!superadminEmail) {
    warnings.push('NOTICE: SUPERADMIN_EMAIL is not explicitly defined; falling back to default committee whitelist.');
  }

  if (isProd && errors.length > 0) {
    console.error('[ENV GUARD CRITICAL ERROR]', errors.join('; '));
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}
