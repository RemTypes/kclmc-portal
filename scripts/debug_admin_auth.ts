/**
 * KCLMC Platform - Automated Playwright Network & Auth Header Tracer
 * 
 * Intercepts and logs:
 * - Every HTTP request/response to /login, /api/auth/*, and /admin
 * - Detailed Set-Cookie headers, cookie jars, SameSite attributes, and domains
 * - Exact redirects and location headers
 * - Page console logs and unhandled runtime errors
 * 
 * Usage:
 *   EMAIL="your-email" PASSWORD="your-password" npx tsx scripts/debug_admin_auth.ts [TARGET_URL]
 * 
 * Options:
 *   HEADLESS=false   Open visible browser window on your Mac screen (recommended if Cloudflare Access is active)
 *   CF_AUTHORIZATION Pass CF_Authorization cookie token directly
 */

import { chromium } from 'playwright';
import { calculateTOTP } from '../lib/security/two-factor';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Helper to load .env.local
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...values] = trimmed.split('=');
        if (key && values.length > 0) {
          const val = values.join('=').replace(/(^["']|["']$)/g, '');
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = val.trim();
          }
        }
      }
    }
  }
}
loadEnv();

const TARGET_URL = process.argv[2] || process.env.TARGET_URL || 'https://epic-replace-supabase-kclmc-portal.remy-preston.workers.dev';
const EMAIL = process.env.EMAIL || process.env.TEST_EMAIL || 'remy.preston@kcl.ac.uk';
const PASSWORD = process.env.PASSWORD || process.env.TEST_PASSWORD || '';
const IS_HEADLESS = process.env.HEADLESS !== 'false' && process.env.HEADLESS !== '0';

console.log('================================================================');
console.log('🔍 KCLMC Auth Diagnostic & Network Tracer');
console.log(`🌐 Target:   ${TARGET_URL}`);
console.log(`👤 User:     ${EMAIL}`);
console.log(`🖥️  Headless: ${IS_HEADLESS ? 'true' : 'false (interactive Mac window)'}`);
console.log('================================================================\n');

async function getTotpSecretFromD1(email: string): Promise<string | null> {
  try {
    const out = execSync(
      `npx wrangler d1 execute kclmc-production --remote --json --command "
        SELECT tf.secret FROM \\"twoFactor\\" tf
        JOIN \\"user\\" u ON tf.userId = u.id
        WHERE LOWER(u.email) = LOWER('${email}')
        LIMIT 1;
      "`,
      { encoding: 'utf8' }
    );
    const parsed = JSON.parse(out);
    const rows = parsed[0]?.results || [];
    return rows[0]?.secret || null;
  } catch (err: any) {
    console.warn('⚠️ Could not query TOTP secret from D1 automatically:', err.message);
    return null;
  }
}

async function runDiagnostic() {
  const browser = await chromium.launch({
    headless: IS_HEADLESS,
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  // Attach CF_Authorization cookie if provided
  if (process.env.CF_AUTHORIZATION) {
    try {
      const urlHost = new URL(TARGET_URL).hostname;
      await context.addCookies([
        {
          name: 'CF_Authorization',
          value: process.env.CF_AUTHORIZATION,
          domain: urlHost,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'None',
        },
      ]);
      console.log(`🛡️ Injected CF_Authorization cookie for ${urlHost}`);
    } catch {}
  }

  const page = await context.newPage();

  // Log client-side console output
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      console.log(`🖥️  [Browser Console ${type.toUpperCase()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    console.log(`💥 [Browser Uncaught Exception] ${err.message}`);
  });

  // Intercept and trace relevant network requests
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/auth') || url.includes('/admin') || url.includes('/login') || url.includes('/403')) {
      const headers = req.headers();
      console.log(`➡️  [REQUEST] ${req.method()} ${url}`);
      if (headers['cookie']) {
        console.log(`   🍪 Cookie Header: ${headers['cookie']}`);
      } else {
        console.log(`   ⚠️  No Cookie Header sent!`);
      }
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/auth') || url.includes('/admin') || url.includes('/login') || url.includes('/403')) {
      const status = res.status();
      const headers = res.headers();
      console.log(`⬅️  [RESPONSE] ${status} ${url}`);
      if (headers['location']) {
        console.log(`   ↪️  Location Redirect: ${headers['location']}`);
      }
      if (headers['set-cookie']) {
        console.log(`   📥 Set-Cookie: ${headers['set-cookie']}`);
      }
    }
  });

  try {
    // 1. Navigate to login
    console.log(`\n--- Step 1: Navigating to ${TARGET_URL}/login ---`);
    const loginRes = await page.goto(`${TARGET_URL}/login`, { waitUntil: 'domcontentloaded' });
    console.log(`📍 Landed on: ${page.url()} (Status: ${loginRes?.status()})`);

    // Check Cloudflare Access intercept
    if (page.url().includes('cloudflareaccess.com') || page.url().includes('cdn-cgi/access')) {
      console.log('🛑 Cloudflare Access zero-trust gate detected on this domain.');
      if (IS_HEADLESS) {
        console.log('   The preview domain requires Cloudflare Access authentication.');
        console.log('   👉 Please run with HEADLESS=false so a browser window pops up for you to complete Access:');
        console.log(`   HEADLESS=false EMAIL="${EMAIL}" PASSWORD="your-password" npx tsx scripts/debug_admin_auth.ts "${TARGET_URL}"\n`);
        await browser.close();
        return;
      } else {
        console.log('⏳ Interactive browser window opened on your screen!');
        console.log('   Please complete Cloudflare Access login in the window now (waiting up to 120s)...');
        await page.waitForURL((url) => !url.href.includes('cloudflareaccess.com') && !url.href.includes('cdn-cgi/access'), {
          timeout: 120000,
        });
        console.log(`✅ Passed Cloudflare Access! Landed on: ${page.url()}`);
        if (!page.url().includes('/login')) {
          await page.goto(`${TARGET_URL}/login`, { waitUntil: 'networkidle' });
        }
      }
    }

    if (!PASSWORD) {
      console.log('\n⚠️ No PASSWORD environment variable provided.');
      console.log('To run the automated credential + 2FA trace, run with your password:');
      console.log(`  HEADLESS=false EMAIL="${EMAIL}" PASSWORD="your-password" npx tsx scripts/debug_admin_auth.ts "${TARGET_URL}"\n`);
      await browser.close();
      return;
    }

    // 2. Fill login form
    console.log(`\n--- Step 2: Submitting credentials for ${EMAIL} ---`);
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for response or 2FA view
    await page.waitForTimeout(2500);
    console.log(`📍 Current URL after credential submission: ${page.url()}`);

    // Check if 2FA view appeared
    const has2FAInput = await page.$('input[placeholder*="000000"], input[autocomplete="one-time-code"], input[name="twoFactorCode"], input[placeholder*="6-digit"]');
    if (has2FAInput) {
      console.log('\n--- Step 3: Two-Factor Authentication Prompt Detected ---');
      const totpSecret = await getTotpSecretFromD1(EMAIL);
      if (totpSecret) {
        const liveCode = calculateTOTP(totpSecret);
        console.log(`🔑 Automatically generated live TOTP code from D1 secret: ${liveCode}`);
        await has2FAInput.fill(liveCode);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
      } else {
        console.log('⚠️ Could not resolve TOTP secret from D1. Please enter code in the browser window.');
        await page.waitForTimeout(10000);
      }
    }

    // 3. Inspect Browser Cookie Jar
    console.log('\n--- Step 4: Inspecting Stored Browser Cookies ---');
    const cookies = await context.cookies();
    for (const c of cookies) {
      console.log(`   🍪 ${c.name} = ${c.value.slice(0, 20)}... (Domain: ${c.domain}, Path: ${c.path}, SameSite: ${c.sameSite}, Secure: ${c.secure}, HttpOnly: ${c.httpOnly})`);
    }

    // 4. Navigate directly to /admin
    console.log(`\n--- Step 5: Navigating to ${TARGET_URL}/admin ---`);
    const adminRes = await page.goto(`${TARGET_URL}/admin`, { waitUntil: 'networkidle' });
    console.log(`📍 Final URL: ${page.url()} (Status: ${adminRes?.status()})`);
    const pageTitle = await page.title();
    console.log(`📄 Page Title: "${pageTitle}"`);

    const pageHeading = await page.$eval('h1', (el) => el.textContent).catch(() => null);
    if (pageHeading) {
      console.log(`🏷️  Page Heading (H1): "${pageHeading.trim()}"`);
    }

    const bodySnippet = await page.content();
    if (bodySnippet.includes('Clearance') || bodySnippet.includes('Admin') || bodySnippet.includes('Committee')) {
      console.log('🎉 SUCCESS: Admin portal content detected on page!');
    } else if (bodySnippet.includes('403') || bodySnippet.includes('Forbidden')) {
      console.log('🚫 FAILURE: 403 Forbidden page displayed!');
    } else if (page.url().includes('/login')) {
      console.log('🔄 FAILURE: Bounced back to /login!');
    }

    if (!IS_HEADLESS) {
      console.log('\nKeeping browser window open for 15 seconds so you can inspect state...');
      await page.waitForTimeout(15000);
    }

  } catch (err: any) {
    console.error('❌ Diagnostic error:', err.message);
  } finally {
    await browser.close();
  }
}

runDiagnostic();