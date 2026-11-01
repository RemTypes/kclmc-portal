import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate2FASecrets() {
  console.log('🔄 Fetching all users from Supabase auth.users to inspect 2FA metadata...');
  let page = 1;
  const allUsers: any[] = [];

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      console.error('❌ Error listing users from Supabase:', error.message);
      break;
    }
    if (!data?.users?.length) break;
    allUsers.push(...data.users);
    if (data.users.length < 100) break;
    page++;
  }

  console.log(`📊 Scanned ${allUsers.length} total user accounts in Supabase.`);

  const usersWith2FA = allUsers.filter((u) => {
    const meta = u.user_metadata || {};
    return Boolean(meta.totp_secret || meta.totpSecret || meta.two_factor_secret);
  });

  console.log(`🔑 Found ${usersWith2FA.length} accounts with existing 2FA/TOTP secrets in metadata.`);

  if (usersWith2FA.length === 0) {
    console.log('ℹ️ No existing 2FA secrets found in Supabase user_metadata.');
    console.log('Committee members will seamlessly enroll fresh 2FA on their first login via the login gate.');
    return;
  }

  const sqlStatements: string[] = [
    `CREATE TABLE IF NOT EXISTS "twoFactor" (
      id TEXT PRIMARY KEY,
      secret TEXT NOT NULL,
      backupCodes TEXT,
      userId TEXT NOT NULL UNIQUE,
      verified INTEGER DEFAULT 1
    );`,
  ];

  for (const u of usersWith2FA) {
    const meta = u.user_metadata || {};
    const secret = meta.totp_secret || meta.totpSecret || meta.two_factor_secret;
    const rawBackupCodes = meta.backup_codes || meta.backupCodes || [];
    const backupCodesJson = typeof rawBackupCodes === 'string' ? rawBackupCodes : JSON.stringify(rawBackupCodes);

    const safeId = u.id.replace(/'/g, "''");
    const safeSecret = secret.replace(/'/g, "''");
    const safeBackupCodes = backupCodesJson.replace(/'/g, "''");

    console.log(`  ✔ Prepared 2FA migration for: ${u.email} (${u.id})`);

    sqlStatements.push(`
      DELETE FROM "twoFactor" WHERE "userId" = '${safeId}';
      INSERT INTO "twoFactor" ("id", "secret", "backupCodes", "userId", "verified")
      VALUES ('tf_${safeId}', '${safeSecret}', '${safeBackupCodes}', '${safeId}', 1);
      UPDATE "user" SET "twoFactorEnabled" = 1 WHERE id = '${safeId}';
    `.trim());
  }

  const tempSqlFile = path.resolve(process.cwd(), '.d1_2fa_migration.sql');
  fs.writeFileSync(tempSqlFile, sqlStatements.join('\n'), 'utf8');

  console.log(`\n🚀 Executing 2FA migration on Cloudflare D1 remote database (kclmc-production)...`);
  try {
    execSync(`npx wrangler d1 execute kclmc-production --remote --file="${tempSqlFile}" -y`, {
      stdio: 'inherit',
    });
    console.log('\n✅ Successfully migrated all existing 2FA secrets into Cloudflare D1!');
  } finally {
    if (fs.existsSync(tempSqlFile)) {
      fs.unlinkSync(tempSqlFile);
    }
  }
}

migrate2FASecrets().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
