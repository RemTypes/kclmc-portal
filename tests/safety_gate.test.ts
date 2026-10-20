import { describe, it, expect } from 'vitest';
import {
  validatePhoneNumber,
  validateEmergencyName,
  checkSafetyProfileCompleteness,
  formatPhoneNumber,
  formatPhoneNumberForWhatsApp,
  generateMembersVCard,
  generateWhatsAppRequestUrl,
  SafetyProfileFields,
} from '@/lib/safety';

describe('Safety Gate Validation (BMC & UK GDPR Compliance)', () => {
  describe('validatePhoneNumber', () => {
    it('accepts standard UK mobile numbers (with or without spaces)', () => {
      expect(validatePhoneNumber('07123456789')).toBe(true);
      expect(validatePhoneNumber('07123 456 789')).toBe(true);
      expect(validatePhoneNumber('07123-456-789')).toBe(true);
      expect(validatePhoneNumber('(07123) 456789')).toBe(true);
    });

    it('accepts international phone formats with leading +', () => {
      expect(validatePhoneNumber('+44 7123 456789')).toBe(true);
      expect(validatePhoneNumber('+447123456789')).toBe(true);
      expect(validatePhoneNumber('+1 (555) 234-5678')).toBe(true);
      expect(validatePhoneNumber('+33 6 12 34 56 78')).toBe(true);
    });

    it('rejects invalid, malformed, or too short phone numbers', () => {
      expect(validatePhoneNumber('')).toBe(false);
      expect(validatePhoneNumber(null)).toBe(false);
      expect(validatePhoneNumber(undefined)).toBe(false);
      expect(validatePhoneNumber('12345')).toBe(false); // under 7 digits
      expect(validatePhoneNumber('call-me-maybe')).toBe(false);
      expect(validatePhoneNumber('phone: 07123456789')).toBe(false);
    });
  });

  describe('validateEmergencyName', () => {
    it('accepts valid contact names', () => {
      expect(validateEmergencyName('Sarah Jenkins')).toBe(true);
      expect(validateEmergencyName('Dr. H. Watson (Father)')).toBe(true);
      expect(validateEmergencyName('Bo')).toBe(true);
    });

    it('rejects empty or single character names', () => {
      expect(validateEmergencyName('')).toBe(false);
      expect(validateEmergencyName(' ')).toBe(false);
      expect(validateEmergencyName('A')).toBe(false);
      expect(validateEmergencyName(null)).toBe(false);
      expect(validateEmergencyName(undefined)).toBe(false);
    });
  });

  describe('checkSafetyProfileCompleteness (Pass Unlock Gate)', () => {
    const completeProfile: SafetyProfileFields = {
      phone: '07123456789',
      emergencyContact: 'Jane Doe (Parent)',
      emergencyPhone: '07987654321',
      medicalNotes: '',
      dietaryNotes: '',
    };

    it('marks profile as complete when phone and emergency contacts are present', () => {
      const result = checkSafetyProfileCompleteness(completeProfile);
      expect(result.isComplete).toBe(true);
      expect(result.missingFields).toHaveLength(0);
      expect(result.hasPhone).toBe(true);
      expect(result.hasEmergencyContact).toBe(true);
      expect(result.hasEmergencyPhone).toBe(true);
    });

    it('locks pass when mobile phone is missing', () => {
      const incomplete = { ...completeProfile, phone: '' };
      const result = checkSafetyProfileCompleteness(incomplete);
      expect(result.isComplete).toBe(false);
      expect(result.hasPhone).toBe(false);
      expect(result.missingFields).toContain('Phone Number');
    });

    it('locks pass when emergency contact name is missing', () => {
      const incomplete = { ...completeProfile, emergencyContact: ' ' };
      const result = checkSafetyProfileCompleteness(incomplete);
      expect(result.isComplete).toBe(false);
      expect(result.hasEmergencyContact).toBe(false);
      expect(result.missingFields).toContain('Emergency Contact Name');
    });

    it('locks pass when emergency contact phone is missing', () => {
      const incomplete = { ...completeProfile, emergencyPhone: null };
      const result = checkSafetyProfileCompleteness(incomplete);
      expect(result.isComplete).toBe(false);
      expect(result.hasEmergencyPhone).toBe(false);
      expect(result.missingFields).toContain('Emergency Contact Phone');
    });

    it('handles null and undefined profiles gracefully', () => {
      const resultNull = checkSafetyProfileCompleteness(null);
      expect(resultNull.isComplete).toBe(false);
      expect(resultNull.missingFields).toHaveLength(3);

      const resultUndefined = checkSafetyProfileCompleteness(undefined);
      expect(resultUndefined.isComplete).toBe(false);
      expect(resultUndefined.missingFields).toHaveLength(3);
    });

    it('NEVER requires dietary or medical notes to unlock pass (UK GDPR Art 9 Compliance)', () => {
      const profileWithoutHealthData: SafetyProfileFields = {
        phone: '07123456789',
        emergencyContact: 'Jane Smith',
        emergencyPhone: '07999888777',
        dietary_requirements: null,
        medical_notes: null,
      };

      const result = checkSafetyProfileCompleteness(profileWithoutHealthData);
      expect(result.isComplete).toBe(true);
      expect(result.missingFields).not.toContain('Medical Notes');
      expect(result.missingFields).not.toContain('Dietary Notes');
    });

    it('supports snake_case database models directly from Supabase', () => {
      const dbProfile: SafetyProfileFields = {
        phone: '07885622646',
        emergency_contact_name: 'Sarah Destivelle',
        emergency_contact_phone: '07885622646',
        dietary_requirements: 'None',
        medical_notes: null,
      };
      const result = checkSafetyProfileCompleteness(dbProfile);
      expect(result.isComplete).toBe(true);
      expect(result.missingFields).toHaveLength(0);
      expect(result.hasPhone).toBe(true);
      expect(result.hasEmergencyContact).toBe(true);
      expect(result.hasEmergencyPhone).toBe(true);
    });
  });

  describe('WhatsApp Community Access Control (Zero Public Link)', () => {
    it('formats phone numbers properly for international vCard and wa.me', () => {
      expect(formatPhoneNumberForWhatsApp('07123 456 789')).toBe('+447123456789');
      expect(formatPhoneNumberForWhatsApp('447123456789')).toBe('+447123456789');
      expect(formatPhoneNumberForWhatsApp('+44 7123-456-789')).toBe('+447123456789');
      expect(formatPhoneNumberForWhatsApp('+1 (555) 234 5678')).toBe('+15552345678');
    });

    it('generates valid vCard 3.0 records for verified members with RFC 2426 compliance', () => {
      const vcard = generateMembersVCard([
        {
          name: 'Catherine Destivelle',
          phone: '07123 456789',
          cardNumber: 'K23158797',
          tier: 'recreational',
        },
        {
          name: 'Bob Unverified',
          phone: null, // should be filtered out in default mode
          cardNumber: 'K99999999',
          tier: 'social',
        },
      ]);

      expect(vcard).toContain('BEGIN:VCARD');
      expect(vcard).toContain('VERSION:3.0');
      expect(vcard).toContain('PRODID:-//KCLMC//Climbing Pass Roster//EN');
      expect(vcard).toContain('REV:');
      expect(vcard).toContain('UID:kclmc-26-27-K23158797');
      expect(vcard).toContain('FN:KCLMC 26/27 - Catherine Destivelle');
      expect(vcard).toContain('N:Destivelle;KCLMC 26/27 - Catherine;;;');
      expect(vcard).toContain('ORG:KCLMC 26/27');
      expect(vcard).toContain('NICKNAME:KCLMC 26/27');
      expect(vcard).toContain('TEL;TYPE=CELL,VOICE:+447123456789');
      expect(vcard).toContain('EMAIL;TYPE=INTERNET,HOME:k23158797@kcl.ac.uk');
      expect(vcard).toContain('CATEGORIES:KCLMC 26/27');
      expect(vcard).toContain('NOTE:KCLSU ID: K23158797 | Tier: RECREATIONAL | Verified Pass');
      expect(vcard).toContain('END:VCARD');
      expect(vcard.endsWith('\r\n')).toBe(true);
      expect(vcard).not.toContain('Bob Unverified');
    });

    it('exports all contacts in a multi-member list without dropping or merging cards', () => {
      const vcard = generateMembersVCard([
        {
          name: 'Catherine Destivelle',
          phone: '07123 456789',
          cardNumber: 'K23158797',
          tier: 'recreational',
        },
        {
          name: 'Alex Honnold',
          phone: '+44 7987 654321',
          cardNumber: 'K26122068',
          tier: 'social',
        },
      ]);

      const beginMatches = vcard.match(/BEGIN:VCARD/g) || [];
      const endMatches = vcard.match(/END:VCARD/g) || [];

      expect(beginMatches).toHaveLength(2);
      expect(endMatches).toHaveLength(2);
      expect(vcard).toContain('UID:kclmc-26-27-K23158797');
      expect(vcard).toContain('UID:kclmc-26-27-K26122068');
      expect(vcard).toContain('FN:KCLMC 26/27 - Catherine Destivelle');
      expect(vcard).toContain('FN:KCLMC 26/27 - Alex Honnold');
      expect(vcard).toContain('TEL;TYPE=CELL,VOICE:+447123456789');
      expect(vcard).toContain('TEL;TYPE=CELL,VOICE:+447987654321');
    });

    it('exports all roster members including pending profiles when includePending is true', () => {
      const vcard = generateMembersVCard(
        [
          {
            name: 'Catherine Destivelle',
            phone: '07123 456789',
            cardNumber: 'K23158797',
            tier: 'recreational',
          },
          {
            name: 'Bob Pending',
            phone: null,
            cardNumber: 'K99999999',
            tier: 'social',
            emergencyContactName: 'Alice Parent',
            emergencyContactPhone: '07111 222333',
          },
        ],
        { includePending: true }
      );

      const beginMatches = vcard.match(/BEGIN:VCARD/g) || [];
      expect(beginMatches).toHaveLength(2);
      expect(vcard).toContain('FN:KCLMC 26/27 - Catherine Destivelle');
      expect(vcard).toContain('FN:KCLMC 26/27 - Bob Pending');
      expect(vcard).toContain('TEL;TYPE=WORK,VOICE:+447111222333');
      expect(vcard).toContain('NOTE:KCLSU ID: K99999999 | Tier: SOCIAL | Mobile Pending Verification | Emergency: Alice Parent');
    });

    it('returns empty string when no eligible members exist', () => {
      expect(generateMembersVCard([])).toBe('');
      expect(generateMembersVCard([{ name: 'No Phone', phone: null }])).toBe('');
    });

    it('generates valid direct WhatsApp request deep links (wa.me) with verified credentials', () => {
      const url = generateWhatsAppRequestUrl('447123456789', {
        name: 'Catherine Destivelle',
        studentId: 'K23158797',
      });

      expect(url).toContain('https://wa.me/447123456789?text=');
      expect(decodeURIComponent(url)).toContain('Catherine Destivelle');
      expect(decodeURIComponent(url)).toContain('K23158797');
      expect(decodeURIComponent(url)).toContain('activated my 2026/27 climbing pass');
    });

    it('correctly cleans and formats phone numbers', () => {
      expect(formatPhoneNumber('07123 456 789')).toBe('07123456789');
      expect(formatPhoneNumber('+44 (0) 7123-456-789')).toBe('+4407123456789');
      expect(formatPhoneNumber('')).toBe('');
    });
  });
});
