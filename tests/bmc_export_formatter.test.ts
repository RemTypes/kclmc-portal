import { test, describe } from 'vitest';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import {
  parseDob,
  cleanPhoneNumber,
  cleanNameString,
  formatUkPostcode,
  mapBmcMembershipType,
  convertBmcFormToExport,
  serializeBmcExportCsv,
  BMC_EXPORT_HEADER,
} from '../scripts/format_bmc_export';

describe('BMC Member Form to Export Formatter (TypeScript)', () => {
  describe('parseDob', () => {
    test('handles standard ISO format', () => {
      assert.strictEqual(parseDob('2005-10-01'), '2005-10-01');
      assert.strictEqual(parseDob('2001.9.14'), '2001-09-14');
    });

    test('handles UK DMY format with slashes and dots', () => {
      assert.strictEqual(parseDob('01/10/2005'), '2005-10-01');
      assert.strictEqual(parseDob('17/09/2006'), '2006-09-17');
      assert.strictEqual(parseDob('15.04.1999'), '1999-04-15');
      assert.strictEqual(parseDob('18.05.2006.'), '2006-05-18');
    });

    test('handles 2-digit years', () => {
      assert.strictEqual(parseDob('30/10/03'), '2003-10-30');
    });

    test('handles word months', () => {
      assert.strictEqual(parseDob('30 October 2006'), '2006-10-30');
    });
  });

  describe('cleanPhoneNumber', () => {
    test('cleans valid phone numbers and adds standard UK +44 formatting', () => {
      assert.strictEqual(cleanPhoneNumber('+44 7939404556'), '+44 7939404556');
      assert.strictEqual(cleanPhoneNumber('07827685577'), '+44 7827685577');
      assert.strictEqual(cleanPhoneNumber('7931723870'), '+44 7931723870');
      assert.strictEqual(cleanPhoneNumber('+385958807070'), '+385958807070');
    });

    test('filters out invalid country names or text', () => {
      assert.strictEqual(cleanPhoneNumber('United Kingdom'), '');
      assert.strictEqual(cleanPhoneNumber(''), '');
      assert.strictEqual(cleanPhoneNumber(null), '');
    });
  });

  describe('cleanNameString', () => {
    test('properly title-cases all-caps and all-lowercase names', () => {
      assert.strictEqual(cleanNameString('HAOFANG XU'), 'Haofang Xu');
      assert.strictEqual(cleanNameString('ethan kellett'), 'Ethan Kellett');
      assert.strictEqual(cleanNameString('Emilia-Sophie'), 'Emilia-Sophie');
    });
  });

  describe('formatUkPostcode', () => {
    test('normalizes UK postcodes with uppercase and 1 space', () => {
      assert.strictEqual(formatUkPostcode('SE5 0RW'), 'SE5 0RW');
      assert.strictEqual(formatUkPostcode('WA144RQ'), 'WA14 4RQ');
      assert.strictEqual(formatUkPostcode('kt206az'), 'KT20 6AZ');
      assert.strictEqual(formatUkPostcode('RH15 0HU (london post code SE1 4YL)'), 'RH15 0HU');
    });
  });

  describe('mapBmcMembershipType', () => {
    test('maps membership strings accurately', () => {
      assert.strictEqual(mapBmcMembershipType('Recreational Student'), 'Student');
      assert.strictEqual(mapBmcMembershipType('Student'), 'Student');
      assert.strictEqual(mapBmcMembershipType('Associate'), 'Individual');
      assert.strictEqual(mapBmcMembershipType('Individual'), 'Individual');
    });
  });

  describe('Full conversion pipeline', () => {
    test('correctly parses fixtures and merges records', () => {
      const formPath = path.resolve(process.cwd(), 'tests', 'fixtures', 'bmc', 'form_responses.csv');
      const exportPath = path.resolve(process.cwd(), 'tests', 'fixtures', 'bmc', 'export.csv');

      const formCsvText = fs.readFileSync(formPath, 'utf8');
      const exportCsvText = fs.readFileSync(exportPath, 'utf8');

      const { rows, stats } = convertBmcFormToExport(formCsvText, exportCsvText, { year: '2027' });

      assert.strictEqual(stats.totalSubmissions, 56);
      assert.strictEqual(stats.uniqueFormMembers, 47);
      assert.strictEqual(stats.duplicatesResolved, 9);
      assert.strictEqual(stats.existingRecordsCount, 28);
      assert.strictEqual(stats.existingMatchedCount, 28);
      assert.strictEqual(stats.newMembersCount, 19);
      assert.strictEqual(stats.totalOutputRows, 47);

      // Verify header columns present in every row
      for (const r of rows) {
        for (const col of BMC_EXPORT_HEADER) {
          assert.ok(col in r, `Column ${col} missing in row`);
        }
      }

      // Verify preserved C-number
      const jennifer = rows.find(r => r.Forenames === 'Jennifer' && r.Surname === 'Johnston');
      assert.ok(jennifer);
      assert.strictEqual(jennifer['BMC Ref'], 'C716668');
      assert.strictEqual(jennifer['Membership Title'], 'Vice President');
      assert.strictEqual(jennifer['Contact Type'], 'Main Club Contact');

      // Verify new member
      const lewis = rows.find(r => r.Forenames === 'Lewis' && r.Surname === 'Williams');
      assert.ok(lewis);
      assert.strictEqual(lewis['BMC Ref'], '');
      assert.strictEqual(lewis.Dob, '2006-07-27');
      assert.strictEqual(lewis['Address 1'], 'Flat 13, Pella House, Orsett Street');
      assert.strictEqual(lewis.Town, 'Lambeth, London');
      assert.strictEqual(lewis.Postcode, 'SE11 5LX');
      assert.strictEqual(lewis.Email, 'lewis.williams007@outlook.com');
      assert.strictEqual(lewis['Mobile Tel.'], '+44 7475773819');
      assert.strictEqual(lewis['Membership Type'], 'Student');

      // Check CSV serialization
      const csvStr = serializeBmcExportCsv(rows);
      assert.ok(csvStr.startsWith(BMC_EXPORT_HEADER.join(',')));
      assert.strictEqual(csvStr.trim().split('\n').length, 48); // 1 header + 47 rows
    });

    test('supports new-only mode', () => {
      const formPath = path.resolve(process.cwd(), 'tests', 'fixtures', 'bmc', 'form_responses.csv');
      const exportPath = path.resolve(process.cwd(), 'tests', 'fixtures', 'bmc', 'export.csv');

      const formCsvText = fs.readFileSync(formPath, 'utf8');
      const exportCsvText = fs.readFileSync(exportPath, 'utf8');

      const { rows, stats } = convertBmcFormToExport(formCsvText, exportCsvText, { newOnly: true });

      assert.strictEqual(rows.length, 19);
      assert.strictEqual(stats.newMembersCount, 19);
      for (const r of rows) {
        assert.strictEqual(r['BMC Ref'], '');
      }
    });
  });
});
