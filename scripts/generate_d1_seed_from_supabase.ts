import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Simple parser for .env.local or wrangler.jsonc if not already in environment
function loadEnv() {
  const dir = typeof import.meta.dirname !== 'undefined' ? import.meta.dirname : process.cwd();
  const envPath = path.resolve(dir, '../.env.local');
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

  const wranglerPath = path.resolve(dir, '../wrangler.jsonc');
  if (fs.existsSync(wranglerPath)) {
    try {
      const content = fs.readFileSync(wranglerPath, 'utf8');
      const urlMatch = content.match(/"NEXT_PUBLIC_SUPABASE_URL":\s*"([^"]+)"/);
      const keyMatch = content.match(/"NEXT_PUBLIC_SUPABASE_ANON_KEY":\s*"([^"]+)"/);
      if (urlMatch && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = urlMatch[1];
      }
      if (keyMatch && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = keyMatch[1];
      }
    } catch (err: any) {
      console.warn('Wrangler read error:', err.message);
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bsvnyibipcwrcyzqilge.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Supabase credentials not found.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function escapeSqlValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function exportTableToSql(table: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.from(table).select('*');
    if (error || !data || data.length === 0) {
      console.warn(`  ⚠️ Table "${table}": 0 rows exported (${error?.message || 'Empty'})`);
      return [];
    }

    const statements: string[] = [];
    for (const row of data) {
      const cols = Object.keys(row);
      const vals = cols.map(c => escapeSqlValue(row[c]));
      statements.push(`INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});`);
    }

    console.log(`  ✔ Table "${table}": ${data.length} rows exported`);
    return statements;
  } catch (err: any) {
    console.error(`  ❌ Failed exporting ${table}:`, err.message);
    return [];
  }
}

async function runExport() {
  console.log('🔄 Exporting Supabase Data to Cloudflare D1 SQL Seed Script...');
  console.log(`📡 Connecting to: ${supabaseUrl}`);

  const tables = [
    'profiles',
    'kclsu_roster',
    'portal_links',
    'trips',
    'guides',
    'shop_items',
    'merch_orders',
    'bmc_dispatches',
  ];

  const allStatements: string[] = [
    '-- ============================================================',
    `-- KCLMC Platform: Supabase -> Cloudflare D1 Data Migration Seed`,
    `-- Exported At: ${new Date().toISOString()}`,
    '-- ============================================================',
    '',
    'PRAGMA foreign_keys = OFF;',
    '',
  ];

  const knownUserIds = new Set<string>();

  // Export auth users using admin API
  try {
    const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
    if (!authErr && authData?.users?.length) {
      console.log(`  ✔ auth.users: ${authData.users.length} accounts exported`);
      allStatements.push('-- Data for table: users (Migrated from Supabase Auth)');
      for (const u of authData.users) {
        knownUserIds.add(u.id);
        const id = escapeSqlValue(u.id);
        const email = escapeSqlValue(u.email);
        const createdAt = escapeSqlValue(u.created_at);
        const updatedAt = escapeSqlValue(u.updated_at || u.created_at);
        const meta = u.user_metadata || {};
        const role = meta.role ?? (String(u.email || '').includes('admin@kclmc.org') ? 2 : 0);
        const mfaSecret = escapeSqlValue(meta.totp_secret || null);
        const mfaBackup = escapeSqlValue(meta.backup_codes || null);

        allStatements.push(`INSERT OR REPLACE INTO users (id, email, password_hash, salt, role, mfa_secret, mfa_backup_codes, created_at, updated_at) VALUES (${id}, ${email}, 'MIGRATED_ACCOUNT', '', ${role}, ${mfaSecret}, ${mfaBackup}, ${createdAt}, ${updatedAt});`);
      }
      allStatements.push('');
    }
  } catch (err: any) {
    console.warn('  ⚠️ Could not export auth.users:', err.message);
  }

  // Pre-seed any profiles that don't have an auth.users record
  try {
    const { data: profileRows } = await supabase.from('profiles').select('id, student_id, full_name');
    if (profileRows) {
      let missingCount = 0;
      for (const p of profileRows) {
        if (!knownUserIds.has(p.id)) {
          knownUserIds.add(p.id);
          missingCount++;
          const id = escapeSqlValue(p.id);
          const emailVal = p.student_id ? `${String(p.student_id).toLowerCase()}@kcl.ac.uk` : `${p.id.slice(0, 8)}@kclmc.org`;
          const email = escapeSqlValue(emailVal);
          allStatements.push(`INSERT OR REPLACE INTO users (id, email, password_hash, salt, role, created_at, updated_at) VALUES (${id}, ${email}, 'MIGRATED_PROFILE', '', 0, datetime('now'), datetime('now'));`);
        }
      }
      if (missingCount > 0) {
        console.log(`  ✔ Synthesized ${missingCount} parent user accounts for existing profiles`);
      }
    }
  } catch (err: any) {
    console.warn('  ⚠️ Could not reconcile profile users:', err.message);
  }

  for (const table of tables) {
    const stmts = await exportTableToSql(table);
    if (stmts.length > 0) {
      allStatements.push(`-- Data for table: ${table}`);
      allStatements.push(...stmts);
      allStatements.push('');
    }
  }

  allStatements.push('PRAGMA foreign_keys = ON;');

  const outDir = path.resolve(process.cwd(), 'd1');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outFile = path.join(outDir, 'seed_data.sql');
  fs.writeFileSync(outFile, allStatements.join('\n'), 'utf8');

  console.log(`\n🎉 Seed script generated successfully at: ${outFile}`);
  console.log(`👉 To load into Cloudflare D1, run:`);
  console.log(`   npx wrangler d1 execute kclmc-production --file=d1/seed_data.sql`);
}

runExport().catch(err => {
  console.error('Fatal export error:', err);
  process.exit(1);
});
