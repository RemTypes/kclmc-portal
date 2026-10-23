import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL or API key is not configured.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SUPABASE_TABLES = [
  'kclsu_roster',
  'profiles',
  'shop_items',
  'merch_orders',
  'trips',
  'guides',
];

const D1_TABLES = [
  'kclsu_roster',
  'profiles',
  'users',
  'portal_links',
  'guides',
];

async function runBackup() {
  console.log('📦 Starting KCLMC Database Redundancy Backup & Parity Audit (UK GDPR Art. 32)...');
  console.log(`📡 Connecting to Supabase: ${supabaseUrl}`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'backups');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // 1. BACKUP SUPABASE
  const supabaseData: Record<string, any[]> = {
    _metadata: [{
      backupTimestamp: new Date().toISOString(),
      source: 'supabase',
      version: '1.0.0',
      compliance: 'UK GDPR Article 32 Resilience & Redundancy',
      tablesBackedUp: SUPABASE_TABLES,
    }],
  };

  const supabaseSummary: Record<string, number> = {};

  for (const table of SUPABASE_TABLES) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        console.warn(`⚠️ Warning: Could not fetch Supabase table "${table}": ${error.message}`);
        supabaseData[table] = [];
        supabaseSummary[table] = 0;
      } else {
        supabaseData[table] = data || [];
        supabaseSummary[table] = data?.length || 0;
        console.log(`  ✔ [Supabase] ${table.padEnd(16)}: ${supabaseSummary[table]} records`);
      }
    } catch (err: any) {
      console.error(`❌ Error fetching Supabase ${table}:`, err.message);
      supabaseData[table] = [];
      supabaseSummary[table] = 0;
    }
  }

  const supabaseFilename = `backup_supabase_${timestamp}.json`;
  const supabaseFilePath = path.join(backupDir, supabaseFilename);
  fs.writeFileSync(supabaseFilePath, JSON.stringify(supabaseData, null, 2), 'utf8');

  // 2. BACKUP CLOUDFLARE D1 (FAILSAFE TIER 4)
  console.log('\n📡 Connecting to Cloudflare D1 (kclmc-production)...');
  const d1Data: Record<string, any[]> = {
    _metadata: [{
      backupTimestamp: new Date().toISOString(),
      source: 'cloudflare_d1',
      database: 'kclmc-production',
      version: '1.0.0',
      compliance: 'UK GDPR Article 32 Resilience & Redundancy',
      tablesBackedUp: D1_TABLES,
    }],
  };
  const d1Summary: Record<string, number> = {};

  for (const table of D1_TABLES) {
    try {
      const cmd = `npx wrangler d1 execute kclmc-production --remote --command="SELECT * FROM ${table};" --json`;
      const stdout = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      // Find JSON block in stdout
      const jsonStart = stdout.indexOf('[');
      if (jsonStart >= 0) {
        const parsed = JSON.parse(stdout.slice(jsonStart));
        const rows = parsed[0]?.results || [];
        d1Data[table] = rows;
        d1Summary[table] = rows.length;
        console.log(`  ✔ [Cloudflare D1] ${table.padEnd(14)}: ${rows.length} records`);
      } else {
        d1Data[table] = [];
        d1Summary[table] = 0;
        console.warn(`  ⚠️ Could not parse JSON from D1 export for ${table}`);
      }
    } catch (err: any) {
      console.warn(`  ⚠️ Cloudflare D1 backup skipped for "${table}": ${err.message}`);
      d1Data[table] = [];
      d1Summary[table] = 0;
    }
  }

  const d1Filename = `backup_d1_${timestamp}.json`;
  const d1FilePath = path.join(backupDir, d1Filename);
  fs.writeFileSync(d1FilePath, JSON.stringify(d1Data, null, 2), 'utf8');

  // 3. PARITY COMPARISON TABLE
  const parityRows: Array<{ Table: string; 'Supabase Count': number | string; 'D1 Count': number | string; Status: string }> = [];
  const commonTables = Array.from(new Set([...SUPABASE_TABLES, ...D1_TABLES]));

  for (const t of commonTables) {
    const suCount = supabaseSummary[t] !== undefined ? supabaseSummary[t] : 'N/A';
    const d1Count = d1Summary[t] !== undefined ? d1Summary[t] : 'N/A';
    let status = 'Unknown';
    if (typeof suCount === 'number' && typeof d1Count === 'number') {
      if (suCount === d1Count) {
        status = '✅ In Sync';
      } else {
        status = `⚠️ Diff (${d1Count - suCount})`;
      }
    } else if (suCount === 'N/A') {
      status = 'ℹ️ D1 Only';
    } else {
      status = 'ℹ️ Supabase Only';
    }
    parityRows.push({ Table: t, 'Supabase Count': suCount, 'D1 Count': d1Count, Status: status });
  }

  console.log('\n🎉 Backup Completed Successfully!');
  console.log(`📁 Supabase Backup: ${supabaseFilePath}`);
  console.log(`📁 D1 Backup:       ${d1FilePath}`);
  console.log('\n📊 Database Parity Audit:');
  console.table(parityRows);
}

runBackup().catch((err) => {
  console.error('Fatal backup error:', err);
  process.exit(1);
});
