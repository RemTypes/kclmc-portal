#!/usr/bin/env python3
"""
KCLMC BMC Member Form to BMC Portal Export Converter & Sync Tool

Converts Google Form responses ("BMC Personal Information Insurance Form")
into the exact 20-column CSV format required by the British Mountaineering Council (BMC)
club portal (`export.csv`).

Features:
- Robust DOB parsing (DD/MM/YYYY, DD.MM.YYYY, YYYY.M.D, DD Month YYYY, etc.) -> YYYY-MM-DD
- Phone number sanitation (filters out invalid text like "United Kingdom", normalizes UK numbers)
- Postcode normalization & UK spacing
- Address line 1 extraction avoiding substring collision with email address
- Intelligent deduplication across multiple submissions from the same member
- Automatic merging with existing export.csv to preserve assigned BMC numbers (C-numbers),
  committee titles (President, VP, Treasurer), and club contact designations
- `--new-only` flag to export only newly registered members
- Zero external dependencies (uses standard library only)

Usage:
  python3 scripts/format_bmc_export.py [options]

Examples:
  # Auto-detect files in ~/Downloads and output updated full roster:
  python3 scripts/format_bmc_export.py

  # Output only new members who need BMC numbers:
  python3 scripts/format_bmc_export.py --new-only

  # Specify custom input and output paths:
  python3 scripts/format_bmc_export.py --form responses.csv --existing export.csv --output updated.csv

  # Dry-run preview without saving:
  python3 scripts/format_bmc_export.py --dry-run
"""

import argparse
import csv
import glob
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

# BMC Export Header (exact 20 columns)
BMC_HEADER = [
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
]

DEFAULT_YEAR = '2027'


def parse_dob(dob_str: Optional[str]) -> str:
    """Normalizes any common date string to ISO YYYY-MM-DD."""
    if not dob_str:
        return ''
    s = dob_str.strip().rstrip('.')
    
    # 1. ISO format: YYYY-MM-DD or YYYY.M.D or YYYY/M/D
    m = re.match(r'^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$', s)
    if m:
        return f'{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}'
        
    # 2. DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
    m = re.match(r'^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$', s)
    if m:
        return f'{int(m.group(3)):04d}-{int(m.group(2)):02d}-{int(m.group(1)):02d}'
        
    # 3. DD/MM/YY or DD.MM.YY (assume university student: 00-30 -> 2000-2030, >30 -> 1900-1999)
    m = re.match(r'^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$', s)
    if m:
        yy = int(m.group(3))
        y = 2000 + yy if yy <= 30 else 1900 + yy
        return f'{y:04d}-{int(m.group(2)):02d}-{int(m.group(1)):02d}'
        
    # 4. Word-based month formats (e.g. "30 October 2006", "15 Jan 2004")
    for fmt in ('%d %B %Y', '%d %b %Y', '%B %d, %Y', '%b %d, %Y', '%d %B %y'):
        try:
            return datetime.strptime(s, fmt).strftime('%Y-%m-%d')
        except ValueError:
            pass
            
    return s


def clean_phone(raw: Optional[str]) -> str:
    """Sanitizes phone numbers and rejects non-phone text like 'United Kingdom'."""
    if not raw:
        return ''
    s = raw.strip()
    
    # If there are no numbers at all, it's not a phone number
    if not re.search(r'\d', s):
        return ''
        
    # Filter out common junk
    s = re.sub(r'[^0-9+ ]', '', s).strip()
    s = re.sub(r'\s+', ' ', s)
    
    # Fix UK numbers typed with +4407... -> +44 7...
    if s.startswith('+440'):
        s = '+44 ' + s[4:]
    elif s.startswith('07') and len(s.replace(' ', '')) == 11:
        # Standard UK mobile: 07123456789 -> +44 7...
        digits = s.replace(' ', '')
        s = f'+44 {digits[1:]}'
    elif s.startswith('7') and len(s.replace(' ', '')) == 10:
        # Missing leading zero: 7931723870 -> +44 7931723870
        s = f'+44 {s}'
    elif not s.startswith('+') and s.startswith('44'):
        s = '+' + s
        
    return s


def clean_name(raw: Optional[str]) -> str:
    """Formats name into proper case, preserving hyphens and multi-word names."""
    if not raw:
        return ''
    parts = raw.strip().split()
    cleaned = []
    for p in parts:
        if '-' in p:
            sub = [w.capitalize() if w.isupper() or w.islower() else w for w in p.split('-')]
            cleaned.append('-'.join(sub))
        elif p.isupper() or p.islower():
            cleaned.append(p.capitalize())
        else:
            cleaned.append(p)
    return ' '.join(cleaned)


def format_uk_postcode(pc: Optional[str]) -> str:
    """Formats UK postcode with uppercase and standard 1-space separator."""
    if not pc:
        return ''
    # Remove explanations in parentheses like "(london post code SE1 4YL)"
    s = re.sub(r'\(.*?\)', '', pc).strip().upper()
    s_clean = re.sub(r'\s+', '', s)
    
    # UK postcode regex: 1-2 letters, 1-2 digits/letter, 1 digit, 2 letters
    if len(s_clean) >= 5 and re.match(r'^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$', s_clean):
        return f'{s_clean[:-3]} {s_clean[-3:]}'
        
    # Return stripped original if international (e.g. Paris 75016)
    return s.strip()


def map_membership_type(raw: Optional[str]) -> str:
    """Maps form membership selection to BMC membership type ('Student' or 'Individual')."""
    s = (raw or '').strip().lower()
    if any(k in s for k in ['associate', 'individual', 'external', 'alumni', 'non-student']):
        return 'Individual'
    return 'Student'


def normalize_name_key(first: str, last: str) -> str:
    """Generates a canonical lowercase alphanumeric lookup key for a person."""
    combined = f'{first.strip()} {last.strip()}'.lower()
    return re.sub(r'[^a-z0-9]', '', combined)


def find_default_file(patterns: List[str]) -> Optional[str]:
    """Finds first existing matching file among patterns."""
    for pattern in patterns:
        expanded = os.path.expanduser(pattern)
        if os.path.isfile(expanded):
            return expanded
        matches = glob.glob(expanded)
        if matches:
            # Sort by mtime descending (newest first)
            matches.sort(key=lambda p: os.path.getmtime(p), reverse=True)
            return matches[0]
    return None


def read_csv_flexible(path: str) -> List[Dict[str, str]]:
    """Reads a CSV file with automatic UTF-8-SIG (BOM) handling."""
    with open(path, 'r', encoding='utf-8-sig', errors='replace') as f:
        reader = csv.reader(f)
        try:
            raw_headers = next(reader)
        except StopIteration:
            return []
        
        # Clean headers
        headers = [h.strip() for h in raw_headers]
        rows = []
        for line in reader:
            if not any(col.strip() for col in line):
                continue
            row = {}
            for i, h in enumerate(headers):
                row[h] = line[i].strip() if i < len(line) else ''
            rows.append(row)
        return rows


def find_col(row: Dict[str, str], *keywords: str, exclude: Tuple[str, ...] = ()) -> str:
    """Finds value from dict matching any keywords, avoiding exclusions."""
    for kw in keywords:
        kw_lower = kw.lower()
        for col, val in row.items():
            col_clean = col.lower().strip()
            if any(ex in col_clean for ex in exclude):
                continue
            if kw_lower in col_clean:
                return val.strip()
    return ''


def convert_and_sync(
    form_path: str,
    existing_export_path: Optional[str] = None,
    year: str = DEFAULT_YEAR,
    new_only: bool = False,
) -> Tuple[List[Dict[str, str]], Dict[str, Any]]:
    """
    Parses Google Form responses and merges with existing BMC export data.
    Returns: (list_of_formatted_rows, stats_dict)
    """
    form_rows = read_csv_flexible(form_path)
    if not form_rows:
        raise ValueError(f'No rows found in form responses CSV: {form_path}')

    # Load existing export if present
    existing_map: Dict[str, Dict[str, str]] = {}
    existing_rows: List[Dict[str, str]] = []
    if existing_export_path and os.path.isfile(existing_export_path):
        existing_rows = read_csv_flexible(existing_export_path)
        for r in existing_rows:
            fn = r.get('Forenames', '')
            sn = r.get('Surname', '')
            key = normalize_name_key(fn, sn)
            if key:
                existing_map[key] = r

    # Process and deduplicate form submissions (latest takes priority)
    form_members: Dict[str, Dict[str, Any]] = {}
    total_submissions = len(form_rows)
    duplicate_count = 0

    for r in form_rows:
        forename = find_col(r, 'forename', 'first name')
        surname = find_col(r, 'surname', 'last name')
        if not forename and not surname:
            continue
            
        key = normalize_name_key(forename, surname)
        email = find_col(r, 'email address', 'email').lower()
        dob = parse_dob(find_col(r, 'date of birth', 'dob'))
        address1 = find_col(r, 'address line 1', 'address 1', 'address', exclude=('email', 'town', 'city', 'postcode'))
        town = clean_name(find_col(r, 'town/city', 'city', 'town', exclude=('postcode', 'address')))
        postcode = format_uk_postcode(find_col(r, 'postcode', 'postal'))
        phone = clean_phone(find_col(r, 'mobile number', 'mobile', 'phone'))
        mem_type = map_membership_type(find_col(r, 'membership type', 'membership'))
        timestamp = find_col(r, 'timestamp')

        cleaned_fn = clean_name(forename)
        cleaned_sn = clean_name(surname)

        if key in form_members:
            duplicate_count += 1
            prev = form_members[key]
            # Smart merge: preserve valid phone, preferred KCL email, latest details
            if not prev['phone'] and phone:
                prev['phone'] = phone
            if email.endswith('@kcl.ac.uk') and not prev['email'].endswith('@kcl.ac.uk'):
                prev['email'] = email
            if dob and not prev['dob']:
                prev['dob'] = dob
            if postcode and not prev['postcode']:
                prev['postcode'] = postcode
            # Update latest submission data
            if timestamp >= prev.get('timestamp', ''):
                prev['timestamp'] = timestamp
                if address1:
                    prev['address1'] = address1
                if town:
                    prev['town'] = town
                if mem_type != 'Student':
                    prev['membership_type'] = mem_type
                if phone:
                    prev['phone'] = phone
        else:
            form_members[key] = {
                'timestamp': timestamp,
                'forenames': cleaned_fn,
                'surname': cleaned_sn,
                'dob': dob,
                'address1': address1,
                'town': town,
                'postcode': postcode,
                'email': email,
                'phone': phone,
                'membership_type': mem_type,
            }

    # Now construct output rows
    output_rows: List[Dict[str, str]] = []
    seen_keys = set()
    new_members_count = 0
    existing_matched_count = 0

    # 1. First, preserve the order and existing records from existing export (if provided)
    if existing_rows:
        for exp in existing_rows:
            fn = exp.get('Forenames', '')
            sn = exp.get('Surname', '')
            key = normalize_name_key(fn, sn)
            seen_keys.add(key)

            # Check if this existing member also filled the form
            fm = form_members.get(key)
            if fm:
                existing_matched_count += 1
                # Use updated phone if old was scientific notation or blank
                old_phone = exp.get('Mobile Tel.', '')
                phone_to_use = fm['phone'] if (not old_phone or 'E+' in old_phone) else old_phone

                row = {
                    'Year': exp.get('Year') or year,
                    'Club Ref': exp.get('Club Ref', ''),
                    'BMC Ref': exp.get('BMC Ref', ''),
                    'Title': exp.get('Title', ''),
                    'Forenames': exp.get('Forenames') or fm['forenames'],
                    'Surname': exp.get('Surname') or fm['surname'],
                    'Dob': exp.get('Dob') or fm['dob'],
                    'Address 1': exp.get('Address 1') or fm['address1'],
                    'Address 2': exp.get('Address 2', ''),
                    'Address 3': exp.get('Address 3', ''),
                    'Town': exp.get('Town') or fm['town'],
                    'County': exp.get('County', ''),
                    'Postcode': exp.get('Postcode') or fm['postcode'],
                    'Email': exp.get('Email') or fm['email'],
                    'Home Tel.': exp.get('Home Tel.', ''),
                    'Mobile Tel.': phone_to_use,
                    'Membership Title': exp.get('Membership Title', ''),
                    'Membership Type': exp.get('Membership Type') or fm['membership_type'],
                    'Contact Type': exp.get('Contact Type', ''),
                    'Member Status': exp.get('Member Status', ''),
                }
            else:
                # Member only exists in existing export
                row = {col: exp.get(col, '') for col in BMC_HEADER}
                if not row.get('Year'):
                    row['Year'] = year

            if not new_only:
                output_rows.append(row)

    # 2. Append new members who were not in existing export
    new_members_list = []
    for key, fm in form_members.items():
        if key not in seen_keys:
            new_members_count += 1
            row = {
                'Year': year,
                'Club Ref': '',
                'BMC Ref': '',
                'Title': '',
                'Forenames': fm['forenames'],
                'Surname': fm['surname'],
                'Dob': fm['dob'],
                'Address 1': fm['address1'],
                'Address 2': '',
                'Address 3': '',
                'Town': fm['town'],
                'County': '',
                'Postcode': fm['postcode'],
                'Email': fm['email'],
                'Home Tel.': '',
                'Mobile Tel.': fm['phone'],
                'Membership Title': '',
                'Membership Type': fm['membership_type'],
                'Contact Type': '',
                'Member Status': '',
            }
            output_rows.append(row)
            new_members_list.append(row)

    stats = {
        'total_submissions': total_submissions,
        'unique_form_members': len(form_members),
        'duplicates_resolved': duplicate_count,
        'existing_records_count': len(existing_rows),
        'existing_matched_count': existing_matched_count,
        'new_members_count': new_members_count,
        'total_output_rows': len(output_rows),
        'new_members': new_members_list,
    }

    return output_rows, stats


def write_bmc_csv(output_path: str, rows: List[Dict[str, str]]) -> None:
    """Writes rows to CSV using standard RFC 4180 format."""
    parent = os.path.dirname(os.path.abspath(output_path))
    if parent:
        os.makedirs(parent, exist_ok=True)
        
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=BMC_HEADER, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(
        description='Convert KCLMC BMC Insurance Google Form Responses to BMC Portal upload format (export.csv).'
    )
    parser.add_argument('-f', '--form', help='Path to BMC Insurance Google Form responses CSV')
    parser.add_argument('-e', '--existing', help='Path to existing BMC export.csv for matching BMC numbers')
    parser.add_argument('-o', '--output', help='Output CSV path')
    parser.add_argument('--new-only', action='store_true', help='Only export new members not in export.csv')
    parser.add_argument('--year', default=DEFAULT_YEAR, help=f'BMC renewal year (default: {DEFAULT_YEAR})')
    parser.add_argument('--dry-run', action='store_true', help='Preview results without writing to file')

    args = parser.parse_args()

    # Auto-detect form path if not provided
    form_path = args.form or find_default_file([
        '~/Downloads/BMC Personal Information Insurnace Form 26_27 (Responses) - Form responses 1.csv',
        '~/Downloads/*BMC*Personal*Information*.csv',
        '~/Downloads/*Form*responses*1.csv',
        'tests/fixtures/bmc/form_responses.csv',
    ])

    if not form_path or not os.path.isfile(form_path):
        print('❌ Error: Could not find BMC Google Form responses CSV.', file=sys.stderr)
        print('👉 Please pass the path using: --form <path>', file=sys.stderr)
        sys.exit(1)

    # Auto-detect existing export path
    existing_path = args.existing or find_default_file([
        '~/Downloads/export.csv',
        'tests/fixtures/bmc/export.csv',
    ])

    # Determine output path
    output_path = args.output
    if not output_path:
        home_downloads = os.path.expanduser('~/Downloads')
        if args.new_only:
            output_path = os.path.join(home_downloads, 'bmc_new_members_only.csv')
        else:
            output_path = os.path.join(home_downloads, 'bmc_members_updated.csv')

    print('\n' + '=' * 65)
    print(' 🏔️   KCLMC BMC Membership Form Converter & Sync Engine')
    print('=' * 65)
    print(f'📄 Form responses: {os.path.basename(form_path)}')
    if existing_path:
        print(f'📑 Existing export: {os.path.basename(existing_path)}')
    else:
        print('📑 Existing export: [None provided - generating fresh roster]')
    print(f'📅 Renewal Year:   {args.year}')
    print(f'🎯 Mode:           {"New Members Only" if args.new_only else "Full Merged Roster"}')

    try:
        rows, stats = convert_and_sync(
            form_path=form_path,
            existing_export_path=existing_path,
            year=args.year,
            new_only=args.new_only,
        )
    except Exception as err:
        print(f'\n❌ Error during conversion: {err}', file=sys.stderr)
        sys.exit(1)

    print('\n' + '-' * 65)
    print(' 📊 Summary Statistics:')
    print('-' * 65)
    print(f'  • Form submissions processed:  {stats["total_submissions"]}')
    print(f'  • Unique members in form:      {stats["unique_form_members"]}')
    print(f'  • Duplicates merged:           {stats["duplicates_resolved"]}')
    if existing_path:
        print(f'  • Existing roster records:     {stats["existing_records_count"]}')
        print(f'  • Matched with existing:       {stats["existing_matched_count"]}')
    print(f'  • ✨ NEW members detected:      {stats["new_members_count"]}')
    print(f'  • Total rows in output:        {stats["total_output_rows"]}')

    if stats['new_members']:
        print('\n' + '-' * 65)
        print(' 🆕 New Members Ready for BMC Registration:')
        print('-' * 65)
        for i, m in enumerate(stats['new_members'], 1):
            tel_display = m['Mobile Tel.'] if m['Mobile Tel.'] else '[No phone]'
            print(f"  {i:2d}. {m['Forenames']} {m['Surname']} ({m['Membership Type']}) | DOB: {m['Dob']} | Postcode: {m['Postcode']} | Tel: {tel_display}")

    if args.dry_run:
        print('\n⚠️ Dry-run enabled: No files written.')
    else:
        try:
            write_bmc_csv(output_path, rows)
            print('\n' + '=' * 65)
            print(f'✅ Successfully generated BMC upload file:')
            print(f'   📂 {output_path}')
            print('=' * 65 + '\n')
        except Exception as err:
            print(f'\n❌ Error writing output CSV: {err}', file=sys.stderr)
            sys.exit(1)


if __name__ == '__main__':
    main()
