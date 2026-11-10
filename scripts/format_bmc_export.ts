#!/usr/bin/env node
/**
 * KCLMC BMC Member Form to BMC Portal Export Converter & Sync Tool (TypeScript Edition)
 *
 * Converts Google Form responses ("BMC Personal Information Insurance Form")
 * into the exact 20-column CSV format required by the British Mountaineering Council (BMC)
 * club portal (`export.csv`).
 *
 * Usage:
 *   npx tsx scripts/format_bmc_export.ts [options]
 *
 * Options:
 *   --form <path>        Path to BMC Insurance Google Form responses CSV
 *   --existing <path>    Path to existing BMC export.csv for preserving BMC numbers
 *   --output <path>      Output CSV path
 *   --new-only           Only export new members not in export.csv
 *   --year <year>        BMC renewal year (default: 2027)
 *   --dry-run            Preview results without writing to disk
 */

import fs from 'fs';
import path from 'path';

export const BMC_EXPORT_HEADER = [
  'Year',
  'Club Ref',
  'BMC Ref',
  'Title',
  'Forenames',
  'Surname',
  'Dob',
  'Address 1',
  'Address 2',
  'Address 3',
  'Town',
  'County',
  'Postcode',
  'Email',
  'Home Tel.',
  'Mobile Tel.',
  'Membership Title',
  'Membership Type',
  'Contact Type',
  'Member Status',
] as const;

export type BmcExportRow = Record<(typeof BMC_EXPORT_HEADER)[number], string>;

export const DEFAULT_BMC_YEAR = '2027';

/**
 * Normalizes any common date string to ISO YYYY-MM-DD.
 */
export function parseDob(dobStr?: string | null): string {
  if (!dobStr) return '';
  const s = dobStr.trim().replace(/\.+$/, '');

  // 1. ISO format: YYYY-MM-DD or YYYY.M.D or YYYY/M/D
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // 2. DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // 3. DD/MM/YY or DD.MM.YY
  const shortMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (shortMatch) {
    const d = parseInt(shortMatch[1], 10);
    const m = parseInt(shortMatch[2], 10);
    const yy = parseInt(shortMatch[3], 10);
    const y = yy <= 30 ? 2000 + yy : 1900 + yy;
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // 4. Word-based month formats (e.g. "30 October 2006", "15 Jan 2004")
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const date = d.getDate();
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
  }

  return s;
}

/**
 * Sanitizes phone numbers and rejects non-phone text like 'United Kingdom'.
 */
export function cleanPhoneNumber(raw?: string | null): string {
  if (!raw) return '';
  const s = raw.trim();

  // If there are no numbers at all, it's not a phone number
  if (!/\d/.test(s)) return '';

  let cleaned = s.replace(/[^0-9+ ]/g, '').trim().replace(/\s+/g, ' ');

  if (cleaned.startsWith('+440')) {
    cleaned = '+44 ' + cleaned.slice(4);
  } else if (cleaned.startsWith('07') && cleaned.replace(/\s/g, '').length === 11) {
    const digits = cleaned.replace(/\s/g, '');
    cleaned = '+44 ' + digits.slice(1);
  } else if (cleaned.startsWith('7') && cleaned.replace(/\s/g, '').length === 10) {
    cleaned = '+44 ' + cleaned;
  } else if (!cleaned.startsWith('+') && cleaned.startsWith('44')) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
}

/**
 * Formats name into proper case, preserving hyphens and multi-word names.
 */
export function cleanNameString(raw?: string | null): string {
  if (!raw) return '';
  const parts = raw.trim().split(/\s+/);
  const cleaned = parts.map(p => {
    if (p.includes('-')) {
      return p
        .split('-')
        .map(w => (w === w.toUpperCase() || w === w.toLowerCase() ? capitalizeWord(w) : w))
        .join('-');
    }
    if (p === p.toUpperCase() || p === p.toLowerCase()) {
      return capitalizeWord(p);
    }
    return p;
  });
  return cleaned.join(' ');
}

function capitalizeWord(w: string): string {
  if (!w) return '';
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/**
 * Formats UK postcode with uppercase and standard 1-space separator.
 */
export function formatUkPostcode(pc?: string | null): string {
  if (!pc) return '';
  const s = pc.replace(/\(.*?\)/g, '').trim().toUpperCase();
  const sClean = s.replace(/\s+/g, '');

  if (sClean.length >= 5 && /^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/.test(sClean)) {
    return `${sClean.slice(0, -3)} ${sClean.slice(-3)}`;
  }

  return s;
}

/**
 * Maps form membership selection to BMC membership type ('Student' or 'Individual').
 */
export function mapBmcMembershipType(raw?: string | null): 'Student' | 'Individual' {
  const s = (raw || '').trim().toLowerCase();
  if (/associate|individual|external|alumni|non-student/.test(s)) {
    return 'Individual';
  }
  return 'Student';
}

export function normalizePersonKey(first: string, last: string): string {
  return `${first.trim()} ${last.trim()}`.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Parses raw CSV text handling quotes and multi-line fields.
 */
export function parseCsvRows(csvText: string): Record<string, string>[] {
  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length === 0) return [];

  const splitLine = (line: string): string[] => {
    const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^",]*))/g;
    const cols: string[] = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      const val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
      cols.push((val || '').trim());
    }
    return cols;
  };

  const rawHeaders = splitLine(lines[0]);
  const headers = rawHeaders.map(h => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = splitLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cols[j] || '';
    }
    rows.push(row);
  }

  return rows;
}

function findColumnValue(row: Record<string, string>, keywords: string[], exclude: string[] = []): string {
  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    for (const [col, val] of Object.entries(row)) {
      const c = col.toLowerCase().trim();
      if (exclude.some(ex => c.includes(ex))) continue;
      if (c.includes(kwLower)) return val.trim();
    }
  }
  return '';
}

export interface BmcSyncStats {
  totalSubmissions: number;
  uniqueFormMembers: number;
  duplicatesResolved: number;
  existingRecordsCount: number;
  existingMatchedCount: number;
  newMembersCount: number;
  totalOutputRows: number;
  newMembers: BmcExportRow[];
}

export function convertBmcFormToExport(
  formCsvText: string,
  existingExportCsvText?: string,
  options: { year?: string; newOnly?: boolean } = {}
): { rows: BmcExportRow[]; stats: BmcSyncStats } {
  const year = options.year || DEFAULT_BMC_YEAR;
  const newOnly = Boolean(options.newOnly);

  const formRows = parseCsvRows(formCsvText);
  if (formRows.length === 0) {
    throw new Error('No rows found in form responses CSV');
  }

  // Load existing export if present
  const existingMap = new Map<string, Record<string, string>>();
  const existingRows = existingExportCsvText ? parseCsvRows(existingExportCsvText) : [];
  for (const r of existingRows) {
    const key = normalizePersonKey(r['Forenames'] || '', r['Surname'] || '');
    if (key) existingMap.set(key, r);
  }

  // Deduplicate form members
  const formMembers = new Map<string, any>();
  let duplicateCount = 0;

  for (const r of formRows) {
    const forename = findColumnValue(r, ['forename', 'first name']);
    const surname = findColumnValue(r, ['surname', 'last name']);
    if (!forename && !surname) continue;

    const key = normalizePersonKey(forename, surname);
    const email = findColumnValue(r, ['email address', 'email']).toLowerCase();
    const dob = parseDob(findColumnValue(r, ['date of birth', 'dob']));
    const address1 = findColumnValue(r, ['address line 1', 'address 1', 'address'], ['email', 'town', 'city', 'postcode']);
    const town = cleanNameString(findColumnValue(r, ['town/city', 'city', 'town'], ['postcode', 'address']));
    const postcode = formatUkPostcode(findColumnValue(r, ['postcode', 'postal']));
    const phone = cleanPhoneNumber(findColumnValue(r, ['mobile number', 'mobile', 'phone']));
    const memType = mapBmcMembershipType(findColumnValue(r, ['membership type', 'membership']));
    const timestamp = findColumnValue(r, ['timestamp']);

    const cleanedFn = cleanNameString(forename);
    const cleanedSn = cleanNameString(surname);

    const prev = formMembers.get(key);
    if (prev) {
      duplicateCount++;
      if (!prev.phone && phone) prev.phone = phone;
      if (email.endsWith('@kcl.ac.uk') && !prev.email.endsWith('@kcl.ac.uk')) prev.email = email;
      if (dob && !prev.dob) prev.dob = dob;
      if (postcode && !prev.postcode) prev.postcode = postcode;
      if (timestamp >= (prev.timestamp || '')) {
        prev.timestamp = timestamp;
        if (address1) prev.address1 = address1;
        if (town) prev.town = town;
        if (memType !== 'Student') prev.membershipType = memType;
        if (phone) prev.phone = phone;
      }
    } else {
      formMembers.set(key, {
        timestamp,
        forenames: cleanedFn,
        surname: cleanedSn,
        dob,
        address1,
        town,
        postcode,
        email,
        phone,
        membershipType: memType,
      });
    }
  }

  const outputRows: BmcExportRow[] = [];
  const seenKeys = new Set<string>();
  let newMembersCount = 0;
  let existingMatchedCount = 0;
  const newMembersList: BmcExportRow[] = [];

  // 1. Preserve existing rows in their exact original order
  for (const exp of existingRows) {
    const key = normalizePersonKey(exp['Forenames'] || '', exp['Surname'] || '');
    seenKeys.add(key);

    const fm = formMembers.get(key);
    let row: BmcExportRow;
    if (fm) {
      existingMatchedCount++;
      const oldPhone = exp['Mobile Tel.'] || '';
      const phoneToUse = !oldPhone || oldPhone.includes('E+') ? fm.phone : oldPhone;

      row = {
        Year: exp['Year'] || year,
        'Club Ref': exp['Club Ref'] || '',
        'BMC Ref': exp['BMC Ref'] || '',
        Title: exp['Title'] || '',
        Forenames: exp['Forenames'] || fm.forenames,
        Surname: exp['Surname'] || fm.surname,
        Dob: exp['Dob'] || fm.dob,
        'Address 1': exp['Address 1'] || fm.address1,
        'Address 2': exp['Address 2'] || '',
        'Address 3': exp['Address 3'] || '',
        Town: exp['Town'] || fm.town,
        County: exp['County'] || '',
        Postcode: exp['Postcode'] || fm.postcode,
        Email: exp['Email'] || fm.email,
        'Home Tel.': exp['Home Tel.'] || '',
        'Mobile Tel.': phoneToUse,
        'Membership Title': exp['Membership Title'] || '',
        'Membership Type': exp['Membership Type'] || fm.membershipType,
        'Contact Type': exp['Contact Type'] || '',
        'Member Status': exp['Member Status'] || '',
      };
    } else {
      row = {
        Year: exp['Year'] || year,
        'Club Ref': exp['Club Ref'] || '',
        'BMC Ref': exp['BMC Ref'] || '',
        Title: exp['Title'] || '',
        Forenames: exp['Forenames'] || '',
        Surname: exp['Surname'] || '',
        Dob: exp['Dob'] || '',
        'Address 1': exp['Address 1'] || '',
        'Address 2': exp['Address 2'] || '',
        'Address 3': exp['Address 3'] || '',
        Town: exp['Town'] || '',
        County: exp['County'] || '',
        Postcode: exp['Postcode'] || '',
        Email: exp['Email'] || '',
        'Home Tel.': exp['Home Tel.'] || '',
        'Mobile Tel.': exp['Mobile Tel.'] || '',
        'Membership Title': exp['Membership Title'] || '',
        'Membership Type': exp['Membership Type'] || 'Student',
        'Contact Type': exp['Contact Type'] || '',
        'Member Status': exp['Member Status'] || '',
      };
    }

    if (!newOnly) {
      outputRows.push(row);
    }
  }

  // 2. Append new members
  for (const [key, fm] of formMembers.entries()) {
    if (!seenKeys.has(key)) {
      newMembersCount++;
      const row: BmcExportRow = {
        Year: year,
        'Club Ref': '',
        'BMC Ref': '',
        Title: '',
        Forenames: fm.forenames,
        Surname: fm.surname,
        Dob: fm.dob,
        'Address 1': fm.address1,
        'Address 2': '',
        'Address 3': '',
        Town: fm.town,
        County: '',
        Postcode: fm.postcode,
        Email: fm.email,
        'Home Tel.': '',
        'Mobile Tel.': fm.phone,
        'Membership Title': '',
        'Membership Type': fm.membershipType,
        'Contact Type': '',
        'Member Status': '',
      };
      outputRows.push(row);
      newMembersList.push(row);
    }
  }

  const stats: BmcSyncStats = {
    totalSubmissions: formRows.length,
    uniqueFormMembers: formMembers.size,
    duplicatesResolved: duplicateCount,
    existingRecordsCount: existingRows.length,
    existingMatchedCount,
    newMembersCount,
    totalOutputRows: outputRows.length,
    newMembers: newMembersList,
  };

  return { rows: outputRows, stats };
}

/**
 * Serializes rows into RFC 4180 CSV text.
 */
export function serializeBmcExportCsv(rows: BmcExportRow[]): string {
  const escapeCell = (val: string) => {
    if (!val) return '';
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const headerLine = BMC_EXPORT_HEADER.join(',');
  const rowLines = rows.map(r => BMC_EXPORT_HEADER.map(h => escapeCell(r[h] || '')).join(','));
  return [headerLine, ...rowLines].join('\n') + '\n';
}

// CLI Execution Entrypoint
if (process.argv[1] && process.argv[1].endsWith('format_bmc_export.ts')) {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };
  const hasFlag = (flag: string) => args.includes(flag);

  const candidateFormPaths = [
    getArg('--form'),
    path.join(process.env.HOME || '', 'Downloads', 'BMC Personal Information Insurnace Form 26_27 (Responses) - Form responses 1.csv'),
    path.resolve(process.cwd(), 'tests', 'fixtures', 'bmc', 'form_responses.csv'),
  ].filter(Boolean) as string[];

  const formPath = candidateFormPaths.find(p => fs.existsSync(p));

  const candidateExportPaths = [
    getArg('--existing'),
    path.join(process.env.HOME || '', 'Downloads', 'export.csv'),
    path.resolve(process.cwd(), 'tests', 'fixtures', 'bmc', 'export.csv'),
  ].filter(Boolean) as string[];

  const existingPath = candidateExportPaths.find(p => fs.existsSync(p));

  const isNewOnly = hasFlag('--new-only');
  const isDryRun = hasFlag('--dry-run');
  const year = getArg('--year') || DEFAULT_BMC_YEAR;

  let outputPath = getArg('--output');
  if (!outputPath) {
    const dl = path.join(process.env.HOME || '', 'Downloads');
    outputPath = isNewOnly
      ? path.join(dl, 'bmc_new_members_only.csv')
      : path.join(dl, 'bmc_members_updated.csv');
  }

  if (!formPath) {
    console.error('❌ Error: Could not find BMC Google Form responses CSV.');
    console.error('👉 Please specify: --form <path>');
    process.exit(1);
  }

  console.log('\n=================================================================');
  console.log(' 🏔️   KCLMC BMC Membership Form Converter & Sync Engine (TS)');
  console.log('=================================================================');
  console.log(`📄 Form responses: ${path.basename(formPath)}`);
  if (existingPath) {
    console.log(`📑 Existing export: ${path.basename(existingPath)}`);
  } else {
    console.log('📑 Existing export: [None provided]');
  }
  console.log(`📅 Renewal Year:   ${year}`);
  console.log(`🎯 Mode:           ${isNewOnly ? 'New Members Only' : 'Full Merged Roster'}`);

  const formText = fs.readFileSync(formPath, 'utf8');
  const existingText = existingPath ? fs.readFileSync(existingPath, 'utf8') : undefined;

  const { rows, stats } = convertBmcFormToExport(formText, existingText, { year, newOnly: isNewOnly });

  console.log('\n-----------------------------------------------------------------');
  console.log(' 📊 Summary Statistics:');
  console.log('-----------------------------------------------------------------');
  console.log(`  • Form submissions processed:  ${stats.totalSubmissions}`);
  console.log(`  • Unique members in form:      ${stats.uniqueFormMembers}`);
  console.log(`  • Duplicates merged:           ${stats.duplicatesResolved}`);
  if (existingPath) {
    console.log(`  • Existing roster records:     ${stats.existingRecordsCount}`);
    console.log(`  • Matched with existing:       ${stats.existingMatchedCount}`);
  }
  console.log(`  • ✨ NEW members detected:      ${stats.newMembersCount}`);
  console.log(`  • Total rows in output:        ${stats.totalOutputRows}`);

  if (stats.newMembers.length > 0) {
    console.log('\n-----------------------------------------------------------------');
    console.log(' 🆕 New Members Ready for BMC Registration:');
    console.log('-----------------------------------------------------------------');
    stats.newMembers.forEach((m, idx) => {
      const tel = m['Mobile Tel.'] || '[No phone]';
      console.log(`  ${String(idx + 1).padStart(2, ' ')}. ${m.Forenames} ${m.Surname} (${m['Membership Type']}) | DOB: ${m.Dob} | Postcode: ${m.Postcode} | Tel: ${tel}`);
    });
  }

  if (isDryRun) {
    console.log('\n⚠️ Dry-run enabled: No files written.');
  } else {
    const csvContent = serializeBmcExportCsv(rows);
    try {
      fs.writeFileSync(outputPath, csvContent, 'utf8');
      console.log('\n=================================================================');
      console.log('✅ Successfully generated BMC upload file:');
      console.log(`   📂 ${outputPath}`);
      console.log('=================================================================\n');
    } catch (err: any) {
      console.error(`\n❌ Error writing output CSV: ${err.message}`);
      process.exit(1);
    }
  }
}
