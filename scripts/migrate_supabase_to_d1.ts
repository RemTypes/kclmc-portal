import fs from 'fs';
import path from 'path';
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bsvnyibipcwrcyzqilge.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function escapeSql(str: any): string {
  if (str === null || str === undefined) return 'NULL';
  if (typeof str === 'number') return String(str);
  if (typeof str === 'boolean') return str ? '1' : '0';
  if (typeof str === 'object') return `'${JSON.stringify(str).replace(/'/g, "''")}'`;
  return `'${String(str).replace(/'/g, "''")}'`;
}

async function run() {
  console.log('🔄 Preparing Supabase -> Cloudflare D1 Migration Script...');

  let rosterData: any[] = [];
  let profilesData: any[] = [];
  let guidesData: any[] = [];

  // Try live Supabase first
  if (supabaseUrl && supabaseKey) {
    try {
      console.log(`📡 Fetching live records from ${supabaseUrl}...`);
      const supabase = createClient(supabaseUrl, supabaseKey);

      const [rosterRes, profilesRes, guidesRes] = await Promise.all([
        supabase.from('kclsu_roster').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('guides').select('*'),
      ]);

      if (!rosterRes.error && rosterRes.data) rosterData = rosterRes.data;
      if (!profilesRes.error && profilesRes.data) profilesData = profilesRes.data;
      if (!guidesRes.error && guidesRes.data) guidesData = guidesRes.data;

      console.log(`  ✔ Found ${rosterData.length} roster members`);
      console.log(`  ✔ Found ${profilesData.length} profiles`);
      console.log(`  ✔ Found ${guidesData.length} guides`);
    } catch (err: any) {
      console.warn('⚠️ Could not connect to live Supabase, checking local backups...', err.message);
    }
  }

  // Fallback to latest backup file if empty
  if (rosterData.length === 0) {
    const backupDir = path.resolve(process.cwd(), 'backups');
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).sort().reverse();
      if (files.length > 0) {
        console.log(`📂 Reading latest backup file: ${files[0]}`);
        const backup = JSON.parse(fs.readFileSync(path.join(backupDir, files[0]), 'utf8'));
        rosterData = backup.kclsu_roster || [];
        profilesData = backup.profiles || [];
        guidesData = backup.guides || [];
      }
    }
  }

  const sqlStatements: string[] = [
    '-- ============================================================',
    '-- KCLMC Platform — Supabase to Cloudflare D1 Seed Migration',
    `-- Generated: ${new Date().toISOString()}`,
    '-- ============================================================',
    '',
  ];

  if (profilesData.length > 0) {
    sqlStatements.push('-- Profiles');
    for (const p of profilesData) {
      sqlStatements.push(
        `INSERT OR REPLACE INTO profiles (id, full_name, student_id, university, phone, emergency_contact_name, emergency_contact_phone, dietary_requirements, medical_notes, role, avatar_url, created_at, updated_at) VALUES (${escapeSql(p.id)}, ${escapeSql(p.full_name)}, ${escapeSql(p.student_id)}, ${escapeSql(p.university)}, ${escapeSql(p.phone)}, ${escapeSql(p.emergency_contact_name)}, ${escapeSql(p.emergency_contact_phone)}, ${escapeSql(p.dietary_requirements)}, ${escapeSql(p.medical_notes)}, ${p.role || 0}, ${escapeSql(p.avatar_url)}, ${escapeSql(p.created_at)}, ${escapeSql(p.updated_at)});`
      );
    }
    sqlStatements.push('');
  }

  if (rosterData.length > 0) {
    sqlStatements.push('-- KCLSU Roster');
    for (const r of rosterData) {
      sqlStatements.push(
        `INSERT OR REPLACE INTO kclsu_roster (id, card_number, full_name, raw_purchaser, tier, product_name, transaction_id, purchase_date, academic_year, user_id, created_at, updated_at) VALUES (${escapeSql(r.id)}, ${escapeSql(r.card_number)}, ${escapeSql(r.full_name)}, ${escapeSql(r.raw_purchaser)}, ${escapeSql(r.tier)}, ${escapeSql(r.product_name)}, ${escapeSql(r.transaction_id)}, ${escapeSql(r.purchase_date)}, ${escapeSql(r.academic_year || '2026/27')}, ${escapeSql(r.user_id)}, ${escapeSql(r.created_at)}, ${escapeSql(r.updated_at)});`
      );
    }
    sqlStatements.push('');
  }

  if (guidesData.length > 0) {
    sqlStatements.push('-- Guides');
    for (const g of guidesData) {
      sqlStatements.push(
        `INSERT OR REPLACE INTO guides (id, title, description, category, location, grade_range, discount_info, website_url, image_url, sort_order, is_published, created_at) VALUES (${escapeSql(g.id)}, ${escapeSql(g.title)}, ${escapeSql(g.description)}, ${escapeSql(g.category)}, ${escapeSql(g.location)}, ${escapeSql(g.grade_range)}, ${escapeSql(g.discount_info)}, ${escapeSql(g.website_url)}, ${escapeSql(g.image_url)}, ${g.sort_order || 0}, ${g.is_published ? 1 : 0}, ${escapeSql(g.created_at)});`
      );
    }
    sqlStatements.push('');
  }

  const outPath = path.resolve(process.cwd(), 'migrations', '0002_d1_seed_from_supabase.sql');
  fs.writeFileSync(outPath, sqlStatements.join('\n'), 'utf8');

  console.log(`\n🎉 Seed migration generated successfully!`);
  console.log(`📁 File: ${outPath}`);
  console.log(`📊 Exported: ${rosterData.length} members, ${profilesData.length} profiles, ${guidesData.length} guides`);
}

run().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
