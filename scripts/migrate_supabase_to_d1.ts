import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { getUserRole } from '../lib/auth';

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
  console.error('❌ Error: Supabase credentials not found in .env.local.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function escapeSql(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

function fetchD1(tableName: string): any[] {
  try {
    const cleanName = tableName.replace(/["`]/g, '');
    const cmd = `npx wrangler d1 execute kclmc-production --remote --command="SELECT * FROM \\\`${cleanName}\\\`;" --json`;
    const stdout = execSync(cmd, { cwd: process.cwd(), encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], maxBuffer: 15 * 1024 * 1024 });
    const jsonStart = stdout.indexOf('[');
    if (jsonStart >= 0) {
      const parsed = JSON.parse(stdout.slice(jsonStart));
      return parsed[0]?.results || [];
    }
  } catch (err: any) {
    console.warn(`  ⚠️ Could not fetch D1 table "${tableName}": ${err.message}`);
  }
  return [];
}

async function runMigration() {
  console.log('=======================================================');
  console.log(' 🔄 KCLMC PLATFORM: SUPABASE -> CLOUDFLARE D1 SYNC');
  console.log(` 📡 Supabase: ${supabaseUrl}`);
  console.log(' 🗄️ D1 Target: kclmc-production (Remote)');
  console.log('=======================================================\n');

  // 1. Fetch current D1 state
  console.log('⏳ Step 1: Fetching existing state from Cloudflare D1...');
  const d1Users = fetchD1('users');
  const d1BetterUsers = fetchD1('user');
  const d1Accounts = fetchD1('account');
  const d1Profiles = fetchD1('profiles');
  const d1Roster = fetchD1('kclsu_roster');
  const d1Orders = fetchD1('merch_orders');
  const d1Telemetry = fetchD1('telemetry_events');

  console.log(`  ✔ Existing D1 records:`);
  console.log(`     - "user" (Better Auth): ${d1BetterUsers.length}`);
  console.log(`     - "account" (Better Auth): ${d1Accounts.length}`);
  console.log(`     - users (legacy): ${d1Users.length}`);
  console.log(`     - profiles: ${d1Profiles.length}`);
  console.log(`     - kclsu_roster: ${d1Roster.length}`);
  console.log(`     - merch_orders: ${d1Orders.length}`);
  console.log(`     - telemetry_events: ${d1Telemetry.length}`);

  const d1UserMap = new Map(d1BetterUsers.map((u: any) => [u.id, u]));
  const d1UserEmailMap = new Map(d1BetterUsers.map((u: any) => [u.email.toLowerCase(), u]));
  const d1AccountMap = new Map(d1Accounts.map((a: any) => [a.userId, a]));
  const d1ProfileMap = new Map(d1Profiles.map((p: any) => [p.id, p]));
  const d1RosterMap = new Map(d1Roster.map((r: any) => [r.card_number, r]));
  const d1OrderCodes = new Set(d1Orders.map((o: any) => o.order_code));
  const d1TelemetryIds = new Set(d1Telemetry.map((t: any) => t.id));

  // 2. Fetch Supabase Data
  console.log('\n⏳ Step 2: Fetching full dataset from Supabase...');

  // Auth Users
  let suUsers: any[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error || !data?.users?.length) break;
    suUsers.push(...data.users);
    if (data.users.length < 100) break;
    page++;
  }
  console.log(`  ✔ Supabase auth.users: ${suUsers.length}`);

  // Profiles
  const { data: suProfiles, error: profErr } = await supabase.from('profiles').select('*');
  if (profErr) throw new Error(`Failed to fetch profiles: ${profErr.message}`);
  console.log(`  ✔ Supabase profiles: ${suProfiles.length}`);
  const suProfileMap = new Map(suProfiles.map((p: any) => [p.id, p]));

  // Roster
  const { data: suRoster, error: rosterErr } = await supabase.from('kclsu_roster').select('*');
  if (rosterErr) throw new Error(`Failed to fetch kclsu_roster: ${rosterErr.message}`);
  console.log(`  ✔ Supabase kclsu_roster: ${suRoster.length}`);

  // Orders
  const { data: suOrders } = await supabase.from('merch_orders').select('*');
  console.log(`  ✔ Supabase merch_orders: ${suOrders?.length || 0}`);

  // Telemetry
  const { data: suTelemetry } = await supabase.from('telemetry_events').select('*');
  console.log(`  ✔ Supabase telemetry_events: ${suTelemetry?.length || 0}`);

  // 3. Build Migration Statements
  console.log('\n⏳ Step 3: Generating SQL upsert statements with data-preservation rules...');

  const sqlStatements: string[] = [
    '-- KCLMC Supabase -> Cloudflare D1 Incremental Sync',
    'PRAGMA foreign_keys = OFF;',
    '',
  ];

  let staleUsersPruned = 0;
  let usersToSync = 0;
  let accountsToSync = 0;
  let profilesToSync = 0;
  let rosterToUpdate = 0;
  let rosterToInsert = 0;
  let ordersToSync = 0;
  let telemetryToSync = 0;

  // Pre-cleanup: resolve any ID mismatch where a user exists in D1 under a nanoid but matches a Supabase email
  for (const u of suUsers) {
    const email = String(u.email || '').trim().toLowerCase();
    const existingD1User = d1UserEmailMap.get(email);
    if (existingD1User && existingD1User.id !== u.id) {
      console.log(`  ℹ️ Resolving mismatched ID for ${email}: replacing stale D1 id ${existingD1User.id} with Supabase canonical id ${u.id}`);
      sqlStatements.push(`DELETE FROM "session" WHERE "userId" = ${escapeSql(existingD1User.id)};`);
      sqlStatements.push(`DELETE FROM "account" WHERE "userId" = ${escapeSql(existingD1User.id)};`);
      sqlStatements.push(`DELETE FROM "user" WHERE "id" = ${escapeSql(existingD1User.id)};`);
      staleUsersPruned++;
    }
  }

  // A. USERS & "user" & "account"
  for (const u of suUsers) {
    const userId = u.id;
    const email = String(u.email || '').trim().toLowerCase();
    const prof = suProfileMap.get(userId);
    const fullName = prof?.full_name || u.user_metadata?.full_name || email.split('@')[0];
    const emailRole = getUserRole(email);
    const profRole = Number(prof?.role ?? (u.app_metadata as any)?.role ?? 0);
    const role = Math.max(emailRole, profRole);
    const createdAt = u.created_at || new Date().toISOString();
    const updatedAt = u.updated_at || createdAt;
    const existingD1User = d1UserMap.get(userId);
    const twoFactorEnabled = (existingD1User?.twoFactorEnabled === 1 || u.user_metadata?.totp_secret || u.user_metadata?.is_2fa_enrolled) ? 1 : 0;

    // 1) D1 legacy "users" table
    sqlStatements.push(`
INSERT INTO users (id, email, password_hash, salt, role, mfa_secret, mfa_backup_codes, created_at, updated_at)
VALUES (${escapeSql(userId)}, ${escapeSql(email)}, 'MIGRATED_ACCOUNT', '', ${role}, NULL, NULL, ${escapeSql(createdAt)}, ${escapeSql(updatedAt)})
ON CONFLICT(id) DO UPDATE SET
  email = excluded.email,
  role = MAX(users.role, excluded.role),
  updated_at = excluded.updated_at;
`.trim());

    // 2) D1 Better Auth "user" table
    sqlStatements.push(`
INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt, twoFactorEnabled, role)
VALUES (${escapeSql(userId)}, ${escapeSql(fullName)}, ${escapeSql(email)}, 1, ${escapeSql(createdAt)}, ${escapeSql(updatedAt)}, ${twoFactorEnabled}, ${role})
ON CONFLICT(id) DO UPDATE SET
  name = COALESCE(NULLIF(excluded.name, ''), "user".name),
  email = excluded.email,
  role = MAX("user".role, excluded.role),
  twoFactorEnabled = MAX("user".twoFactorEnabled, excluded.twoFactorEnabled),
  updatedAt = excluded.updatedAt;
`.trim());

    usersToSync++;

    // 3) D1 Better Auth "account" table
    // DO NOT overwrite if account already exists with bumped password!
    const existingAccount = d1AccountMap.get(userId);
    if (!existingAccount) {
      const accountId = `acc_${userId}`;
      sqlStatements.push(`
INSERT INTO "account" (id, accountId, providerId, userId, password, createdAt, updatedAt)
VALUES (${escapeSql(accountId)}, ${escapeSql(userId)}, 'credential', ${escapeSql(userId)}, 'MIGRATED_ACCOUNT', ${escapeSql(createdAt)}, ${escapeSql(updatedAt)})
ON CONFLICT(id) DO NOTHING;
`.trim());
      accountsToSync++;
    }
  }

  // B. PROFILES
  for (const p of suProfiles) {
    const emailRole = suUsers.find(u => u.id === p.id)?.email ? getUserRole(suUsers.find(u => u.id === p.id).email) : 0;
    const role = Math.max(emailRole, Number(p.role ?? 0));

    sqlStatements.push(`
INSERT INTO profiles (id, full_name, student_id, university, phone, emergency_contact_name, emergency_contact_phone, dietary_requirements, medical_notes, role, avatar_url, created_at, updated_at)
VALUES (
  ${escapeSql(p.id)},
  ${escapeSql(p.full_name || '')},
  ${escapeSql(p.student_id || null)},
  ${escapeSql(p.university || "King's College London")},
  ${escapeSql(p.phone || null)},
  ${escapeSql(p.emergency_contact_name || null)},
  ${escapeSql(p.emergency_contact_phone || null)},
  ${escapeSql(p.dietary_requirements || null)},
  ${escapeSql(p.medical_notes || null)},
  ${role},
  ${escapeSql(p.avatar_url || null)},
  ${escapeSql(p.created_at || new Date().toISOString())},
  ${escapeSql(p.updated_at || new Date().toISOString())}
)
ON CONFLICT(id) DO UPDATE SET
  full_name = COALESCE(NULLIF(excluded.full_name, ''), profiles.full_name),
  student_id = COALESCE(NULLIF(excluded.student_id, ''), profiles.student_id),
  university = COALESCE(NULLIF(excluded.university, ''), profiles.university),
  phone = COALESCE(NULLIF(excluded.phone, ''), profiles.phone),
  emergency_contact_name = COALESCE(NULLIF(excluded.emergency_contact_name, ''), profiles.emergency_contact_name),
  emergency_contact_phone = COALESCE(NULLIF(excluded.emergency_contact_phone, ''), profiles.emergency_contact_phone),
  dietary_requirements = COALESCE(NULLIF(excluded.dietary_requirements, ''), profiles.dietary_requirements),
  medical_notes = COALESCE(NULLIF(excluded.medical_notes, ''), profiles.medical_notes),
  role = MAX(profiles.role, excluded.role),
  avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), profiles.avatar_url),
  updated_at = excluded.updated_at;
`.trim());
    profilesToSync++;
  }

  // C. KCLSU ROSTER (Survivor Rule applied)
  for (const r of suRoster) {
    const isAssociate = r.is_associate ? 1 : 0;
    const suStatus = (r.su_status && ['verified', 'awaiting_su', 'revoked'].includes(r.su_status)) ? r.su_status : 'verified';
    const tier = (r.tier && ['social', 'recreational'].includes(r.tier.toLowerCase())) ? r.tier.toLowerCase() : 'social';

    if (d1RosterMap.has(r.card_number)) {
      sqlStatements.push(`
UPDATE kclsu_roster SET
  full_name = COALESCE(NULLIF(${escapeSql(r.full_name || '')}, ''), kclsu_roster.full_name),
  tier = CASE WHEN kclsu_roster.tier = 'recreational' THEN 'recreational' ELSE ${escapeSql(tier)} END,
  product_name = ${escapeSql(r.product_name || '')},
  transaction_id = COALESCE(${escapeSql(r.transaction_id || '')}, kclsu_roster.transaction_id),
  purchase_date = COALESCE(${escapeSql(r.purchase_date || null)}, kclsu_roster.purchase_date),
  academic_year = ${escapeSql(r.academic_year || '2026/27')},
  user_id = COALESCE(kclsu_roster.user_id, ${escapeSql(r.user_id || null)}),
  is_associate = ${isAssociate},
  member_email = COALESCE(${escapeSql(r.member_email || null)}, kclsu_roster.member_email),
  university = COALESCE(${escapeSql(r.university || "King's College London")}, kclsu_roster.university),
  su_status = ${escapeSql(suStatus)},
  updated_at = ${escapeSql(r.updated_at || new Date().toISOString())}
WHERE card_number = ${escapeSql(r.card_number)};
`.trim());
      rosterToUpdate++;
    } else {
      sqlStatements.push(`
INSERT INTO kclsu_roster (id, card_number, full_name, raw_purchaser, tier, product_name, transaction_id, purchase_date, academic_year, user_id, is_associate, member_email, university, su_status, created_at, updated_at)
VALUES (
  ${escapeSql(r.id)},
  ${escapeSql(r.card_number)},
  ${escapeSql(r.full_name || '')},
  ${escapeSql(r.raw_purchaser || r.full_name || '')},
  ${escapeSql(tier)},
  ${escapeSql(r.product_name || '')},
  ${escapeSql(r.transaction_id || '')},
  ${escapeSql(r.purchase_date || null)},
  ${escapeSql(r.academic_year || '2026/27')},
  ${escapeSql(r.user_id || null)},
  ${isAssociate},
  ${escapeSql(r.member_email || null)},
  ${escapeSql(r.university || "King's College London")},
  ${escapeSql(suStatus)},
  ${escapeSql(r.created_at || new Date().toISOString())},
  ${escapeSql(r.updated_at || new Date().toISOString())}
);
`.trim());
      rosterToInsert++;
    }
  }

  // D. MERCH ORDERS
  for (const o of (suOrders || [])) {
    if (!d1OrderCodes.has(o.order_code)) {
      const itemsStr = typeof o.items === 'string' ? o.items : JSON.stringify(o.items || []);
      sqlStatements.push(`
INSERT INTO merch_orders (id, user_id, order_code, customer_name, customer_email, items, total_pence, brand, status, created_at, updated_at)
VALUES (
  ${escapeSql(o.id)},
  ${escapeSql(o.user_id || null)},
  ${escapeSql(o.order_code)},
  ${escapeSql(o.customer_name || 'Member')},
  ${escapeSql(o.customer_email)},
  ${escapeSql(itemsStr)},
  ${Number(o.total_pence || 0)},
  ${escapeSql(o.brand || 'KCL')},
  ${escapeSql(o.status || 'pending')},
  ${escapeSql(o.created_at || new Date().toISOString())},
  ${escapeSql(o.updated_at || new Date().toISOString())}
)
ON CONFLICT(order_code) DO NOTHING;
`.trim());
      ordersToSync++;
    }
  }

  // E. TELEMETRY EVENTS
  for (const t of (suTelemetry || [])) {
    if (!d1TelemetryIds.has(t.id)) {
      const payloadStr = typeof t.payload === 'string' ? t.payload : JSON.stringify(t.payload || {});
      sqlStatements.push(`
INSERT INTO telemetry_events (id, event_type, payload, session_id, user_id, created_at)
VALUES (
  ${escapeSql(t.id)},
  ${escapeSql(t.event_type)},
  ${escapeSql(payloadStr)},
  ${escapeSql(t.session_id || null)},
  ${escapeSql(t.user_id || null)},
  ${escapeSql(t.created_at || new Date().toISOString())}
)
ON CONFLICT(id) DO NOTHING;
`.trim());
      telemetryToSync++;
    }
  }

  sqlStatements.push('');
  sqlStatements.push('PRAGMA foreign_keys = ON;');

  console.log(`  ✔ Prepared migration payload:`);
  console.log(`     - Stale users pruned:  ${staleUsersPruned}`);
  console.log(`     - Users to sync:       ${usersToSync}`);
  console.log(`     - New Accounts to add: ${accountsToSync}`);
  console.log(`     - Profiles to sync:    ${profilesToSync}`);
  console.log(`     - Roster to update:    ${rosterToUpdate}`);
  console.log(`     - Roster to insert:    ${rosterToInsert}`);
  console.log(`     - Orders to sync:      ${ordersToSync}`);
  console.log(`     - Telemetry to sync:   ${telemetryToSync}`);
  console.log(`     - Total SQL statements:${sqlStatements.length - 3}`);

  // Write temporary migration SQL file
  const migrationFile = path.resolve(process.cwd(), 'd1/migration_delta.sql');
  fs.writeFileSync(migrationFile, sqlStatements.join('\n'), 'utf8');
  console.log(`\n💾 Saved SQL delta to: ${migrationFile} (${(fs.statSync(migrationFile).size / 1024).toFixed(1)} KB)`);

  // 4. Execute on remote Cloudflare D1
  console.log('\n⏳ Step 4: Applying migration delta to remote Cloudflare D1 (kclmc-production)...');
  try {
    execSync(`npx wrangler d1 execute kclmc-production --remote --file="${migrationFile}" -y`, {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    console.log('\n✅ Remote Cloudflare D1 migration executed successfully!');
  } catch (err: any) {
    console.error('❌ Migration execution error:', err.message);
    throw err;
  }

  // 5. Verify Parity After Migration
  console.log('\n⏳ Step 5: Verifying final database parity...');
  const finalUsers = fetchD1('users');
  const finalBetterUsers = fetchD1('user');
  const finalAccounts = fetchD1('account');
  const finalProfiles = fetchD1('profiles');
  const finalRoster = fetchD1('kclsu_roster');
  const finalOrders = fetchD1('merch_orders');
  const finalTelemetry = fetchD1('telemetry_events');

  const report = [
    { Table: '"user" (Better Auth)', Supabase: suUsers.length, 'D1 Before': d1BetterUsers.length, 'D1 After': finalBetterUsers.length, Status: finalBetterUsers.length >= suUsers.length ? '✅ Synced' : '⚠️ Deficit' },
    { Table: '"account" (Better Auth)', Supabase: suUsers.length, 'D1 Before': d1Accounts.length, 'D1 After': finalAccounts.length, Status: finalAccounts.length >= suUsers.length ? '✅ Synced' : '⚠️ Deficit' },
    { Table: 'users (legacy)', Supabase: suUsers.length, 'D1 Before': d1Users.length, 'D1 After': finalUsers.length, Status: finalUsers.length >= suUsers.length ? '✅ Synced' : '⚠️ Deficit' },
    { Table: 'profiles', Supabase: suProfiles.length, 'D1 Before': d1Profiles.length, 'D1 After': finalProfiles.length, Status: finalProfiles.length >= suProfiles.length ? '✅ Synced' : '⚠️ Deficit' },
    { Table: 'kclsu_roster', Supabase: suRoster.length, 'D1 Before': d1Roster.length, 'D1 After': finalRoster.length, Status: finalRoster.length >= suRoster.length ? '✅ Synced' : '⚠️ Deficit' },
    { Table: 'merch_orders', Supabase: suOrders?.length || 0, 'D1 Before': d1Orders.length, 'D1 After': finalOrders.length, Status: finalOrders.length >= (suOrders?.length || 0) ? '✅ Synced' : '⚠️ Deficit' },
    { Table: 'telemetry_events', Supabase: suTelemetry?.length || 0, 'D1 Before': d1Telemetry.length, 'D1 After': finalTelemetry.length, Status: finalTelemetry.length >= (suTelemetry?.length || 0) ? '✅ Synced' : '⚠️ Deficit' },
  ];

  console.table(report);
  console.log('🎉 Migration from Supabase to D1 completed successfully!');
}

runMigration().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
