import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { getUserRole } from '../lib/auth';

// Simple parser for .env.local if not already in environment
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

async function syncAllAuthUsers() {
  console.log('🔄 Fetching all real users from Supabase auth.users with pagination...');
  let page = 1;
  const allUsers: any[] = [];

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      console.error('❌ Error listing users:', error.message);
      break;
    }
    if (!data?.users?.length) break;
    allUsers.push(...data.users);
    console.log(`  ✔ Page ${page}: fetched ${data.users.length} users (total: ${allUsers.length})`);
    if (data.users.length < 100) break;
    page++;
  }

  console.log(`\n📊 Total authentic accounts found in Supabase auth.users: ${allUsers.length}`);

  const tempSqlFile = path.resolve(process.cwd(), '.d1_users_sync.sql');
  const sqlStatements: string[] = ['PRAGMA foreign_keys = OFF;'];

  for (const u of allUsers) {
    const id = u.id;
    const email = String(u.email || '').trim().toLowerCase();
    const rawRole = Number((u.app_metadata as any)?.role ?? 0);
    const emailRole = getUserRole(email);
    const role = emailRole >= 1 ? emailRole : (rawRole === 1 || rawRole === 2 ? rawRole : 0);
    const createdAt = u.created_at || new Date().toISOString();
    const updatedAt = u.updated_at || createdAt;

    const safeId = id.replace(/'/g, "''");
    const safeEmail = email.replace(/'/g, "''");
    const safeCreatedAt = createdAt.replace(/'/g, "''");
    const safeUpdatedAt = updatedAt.replace(/'/g, "''");

    // Preserve existing password_hash if already bumped to modern PBKDF2
    sqlStatements.push(`
      INSERT INTO users (id, email, password_hash, salt, role, created_at, updated_at)
      VALUES ('${safeId}', '${safeEmail}', 'MIGRATED_ACCOUNT', '', ${role}, '${safeCreatedAt}', '${safeUpdatedAt}')
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        role = excluded.role,
        updated_at = excluded.updated_at;
    `.trim());
  }

  sqlStatements.push('PRAGMA foreign_keys = ON;');
  fs.writeFileSync(tempSqlFile, sqlStatements.join('\n'), 'utf8');

  console.log(`\n🚀 Executing D1 sync on remote database kclmc-production (${sqlStatements.length - 2} users)...`);
  try {
    execSync(`npx wrangler d1 execute kclmc-production --remote --file="${tempSqlFile}" -y`, {
      stdio: 'inherit',
    });
    console.log('\n✅ Successfully synchronized all authentic Supabase auth.users into Cloudflare D1!');
  } finally {
    if (fs.existsSync(tempSqlFile)) {
      fs.unlinkSync(tempSqlFile);
    }
  }
}

syncAllAuthUsers().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
