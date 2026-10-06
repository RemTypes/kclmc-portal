import { describe, it, expect } from 'vitest';
import {
  checkSafetyProfileCompleteness,
  formatPhoneNumber,
  SafetyProfileFields,
} from '@/lib/safety';

describe('Safety Gate & Mandatory Profile Verification', () => {
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

  it('blocks pass activation when phone number is missing or empty', () => {
    const incomplete = { ...completeProfile, phone: '' };
    const result = checkSafetyProfileCompleteness(incomplete);
    expect(result.isComplete).toBe(false);
    expect(result.hasPhone).toBe(false);
    expect(result.missingFields).toContain('Phone Number');
  });

  it('blocks pass activation when phone number is too short (< 7 chars)', () => {
    const incomplete = { ...completeProfile, phone: '12345' };
    const result = checkSafetyProfileCompleteness(incomplete);
    expect(result.isComplete).toBe(false);
    expect(result.hasPhone).toBe(false);
    expect(result.missingFields).toContain('Phone Number');
  });

  it('blocks pass activation when emergency contact name is missing', () => {
    const incomplete = { ...completeProfile, emergencyContact: ' ' };
    const result = checkSafetyProfileCompleteness(incomplete);
    expect(result.isComplete).toBe(false);
    expect(result.hasEmergencyContact).toBe(false);
    expect(result.missingFields).toContain('Emergency Contact Name');
  });

  it('blocks pass activation when emergency contact phone is missing', () => {
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

  it('ensures medical and dietary notes are strictly optional (UK GDPR Art 9)', () => {
    // Neither medical nor dietary provided
    const noMedicalOrDietary: SafetyProfileFields = {
      phone: '07123456789',
      emergencyContact: 'John Smith',
      emergencyPhone: '07987654321',
      medicalNotes: null,
      dietaryNotes: null,
    };
    const result = checkSafetyProfileCompleteness(noMedicalOrDietary);
    expect(result.isComplete).toBe(true);
    expect(result.missingFields).not.toContain('Medical Notes');
    expect(result.missingFields).not.toContain('Dietary Notes');
  });

  it('correctly cleans and formats phone numbers', () => {
    expect(formatPhoneNumber('07123 456 789')).toBe('07123456789');
    expect(formatPhoneNumber('+44 (0) 7123-456-789')).toBe('+4407123456789');
    expect(formatPhoneNumber('')).toBe('');
  });
});
