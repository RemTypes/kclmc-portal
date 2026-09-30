import fs from 'fs';
import path from 'path';
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

const TABLES = [
  'kclsu_roster',
  'profiles',
  'shop_items',
  'merch_orders',
  'trips',
  'guides',
];

async function runBackup() {
  console.log('📦 Starting KCLMC Database Redundancy Backup (UK GDPR Art. 32)...');
  console.log(`📡 Connecting to: ${supabaseUrl}`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'backups');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupData: Record<string, any[]> = {
    _metadata: [{
      backupTimestamp: new Date().toISOString(),
      version: '1.0.0',
      compliance: 'UK GDPR Article 32 Resilience & Redundancy',
      tablesBackedUp: TABLES,
    }],
  };

  const summary: Record<string, number> = {};

  for (const table of TABLES) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        console.warn(`⚠️ Warning: Could not fetch table "${table}": ${error.message}`);
        backupData[table] = [];
        summary[table] = 0;
      } else {
        backupData[table] = data || [];
        summary[table] = data?.length || 0;
        console.log(`  ✔ ${table.padEnd(16)}: ${summary[table]} records`);
      }
    } catch (err: any) {
      console.error(`❌ Error fetching ${table}:`, err.message);
      backupData[table] = [];
      summary[table] = 0;
    }
  }

  const filename = `backup_${timestamp}.json`;
  const filePath = path.join(backupDir, filename);

  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf8');

  const stats = fs.statSync(filePath);
  const sizeKb = (stats.size / 1024).toFixed(2);

  console.log('\n🎉 Backup Completed Successfully!');
  console.log(`📁 File: ${filePath}`);
  console.log(`📊 Size: ${sizeKb} KB`);
  console.log('\nAudit Record Counts:');
  console.table(summary);
}

runBackup().catch((err) => {
  console.error('Fatal backup error:', err);
  process.exit(1);
});
