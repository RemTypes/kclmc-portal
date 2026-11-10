#!/usr/bin/env python3
"""
Unit tests for KCLMC BMC Export Formatter (Python)
"""

import unittest
import os
import sys

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from scripts.format_bmc_export import (
    parse_dob,
    clean_phone,
    clean_name,
    format_uk_postcode,
    map_membership_type,
    normalize_name_key,
    convert_and_sync,
    BMC_HEADER,
)


class TestBmcExportFormatter(unittest.TestCase):
    def test_parse_dob_iso(self):
        self.assertEqual(parse_dob('2005-10-01'), '2005-10-01')
        self.assertEqual(parse_dob('2001.9.14'), '2001-09-14')
        self.assertEqual(parse_dob('2001/09/14'), '2001-09-14')

    def test_parse_dob_dmy(self):
        self.assertEqual(parse_dob('01/10/2005'), '2005-10-01')
        self.assertEqual(parse_dob('17/09/2006'), '2006-09-17')
        self.assertEqual(parse_dob('15.04.1999'), '1999-04-15')
        self.assertEqual(parse_dob('18.05.2006.'), '2006-05-18')  # trailing dot
        self.assertEqual(parse_dob('29/10/2005 '), '2005-10-29')  # trailing space

    def test_parse_dob_2digit_year(self):
        self.assertEqual(parse_dob('30/10/03'), '2003-10-30')
        self.assertEqual(parse_dob('15/06/98'), '1998-06-15')

    def test_parse_dob_word_months(self):
        self.assertEqual(parse_dob('30 October 2006'), '2006-10-30')
        self.assertEqual(parse_dob('15 Jan 2004'), '2004-01-15')

    def test_clean_phone_valid(self):
        self.assertEqual(clean_phone('+44 7939404556'), '+44 7939404556')
        self.assertEqual(clean_phone('07827685577'), '+44 7827685577')
        self.assertEqual(clean_phone('7931723870'), '+44 7931723870')
        self.assertEqual(clean_phone('+385958807070'), '+385958807070')
        self.assertEqual(clean_phone('+49 157 92307502'), '+49 157 92307502')

    def test_clean_phone_invalid_text(self):
        self.assertEqual(clean_phone('United Kingdom'), '')
        self.assertEqual(clean_phone('None'), '')
        self.assertEqual(clean_phone(''), '')
        self.assertEqual(clean_phone(None), '')

    def test_clean_name(self):
        self.assertEqual(clean_name('HAOFANG XU'), 'Haofang Xu')
        self.assertEqual(clean_name('ethan kellett'), 'Ethan Kellett')
        self.assertEqual(clean_name('Cheuk Wing Megan '), 'Cheuk Wing Megan')
        self.assertEqual(clean_name('Emilia-Sophie'), 'Emilia-Sophie')

    def test_format_uk_postcode(self):
        self.assertEqual(format_uk_postcode('SE5 0RW'), 'SE5 0RW')
        self.assertEqual(format_uk_postcode('WA144RQ'), 'WA14 4RQ')
        self.assertEqual(format_uk_postcode('kt206az'), 'KT20 6AZ')
        self.assertEqual(format_uk_postcode('sw81rz'), 'SW8 1RZ')
        self.assertEqual(format_uk_postcode('RH15 0HU (london post code SE1 4YL) '), 'RH15 0HU')
        self.assertEqual(format_uk_postcode('75016'), '75016')

    def test_map_membership_type(self):
        self.assertEqual(map_membership_type('Recreational Student'), 'Student')
        self.assertEqual(map_membership_type('Student'), 'Student')
        self.assertEqual(map_membership_type('Associate'), 'Individual')
        self.assertEqual(map_membership_type('Individual'), 'Individual')
        self.assertEqual(map_membership_type(''), 'Student')

    def test_full_pipeline_with_fixtures(self):
        form_path = os.path.join(os.path.dirname(__file__), 'fixtures', 'bmc', 'form_responses.csv')
        export_path = os.path.join(os.path.dirname(__file__), 'fixtures', 'bmc', 'export.csv')

        rows, stats = convert_and_sync(form_path, export_path, year='2027')

        self.assertEqual(stats['total_submissions'], 56)
        self.assertEqual(stats['unique_form_members'], 47)
        self.assertEqual(stats['duplicates_resolved'], 9)
        self.assertEqual(stats['existing_records_count'], 28)
        self.assertEqual(stats['existing_matched_count'], 28)
        self.assertEqual(stats['new_members_count'], 19)
        self.assertEqual(stats['total_output_rows'], 47)

        # Check BMC header columns
        for r in rows:
            for col in BMC_HEADER:
                self.assertIn(col, r)

        # Verify existing member BMC ref preserved
        jennifer = next(r for r in rows if r['Forenames'] == 'Jennifer' and r['Surname'] == 'Johnston')
        self.assertEqual(jennifer['BMC Ref'], 'C716668')
        self.assertEqual(jennifer['Membership Title'], 'Vice President')
        self.assertEqual(jennifer['Contact Type'], 'Main Club Contact')

        # Verify new member added without BMC Ref
        lewis = next(r for r in rows if r['Forenames'] == 'Lewis' and r['Surname'] == 'Williams')
        self.assertEqual(lewis['BMC Ref'], '')
        self.assertEqual(lewis['Dob'], '2006-07-27')
        self.assertEqual(lewis['Address 1'], 'Flat 13, Pella House, Orsett Street')
        self.assertEqual(lewis['Town'], 'Lambeth, London')
        self.assertEqual(lewis['Postcode'], 'SE11 5LX')
        self.assertEqual(lewis['Email'], 'lewis.williams007@outlook.com')
        self.assertEqual(lewis['Mobile Tel.'], '+44 7475773819')
        self.assertEqual(lewis['Membership Type'], 'Student')

    def test_new_only_mode(self):
        form_path = os.path.join(os.path.dirname(__file__), 'fixtures', 'bmc', 'form_responses.csv')
        export_path = os.path.join(os.path.dirname(__file__), 'fixtures', 'bmc', 'export.csv')

        rows, stats = convert_and_sync(form_path, export_path, new_only=True)
        self.assertEqual(len(rows), 19)
        self.assertEqual(stats['new_members_count'], 19)
        for r in rows:
            self.assertEqual(r['BMC Ref'], '')


if __name__ == '__main__':
    unittest.main()
