/**
 * Safety Gate & Mandatory Profile Verification Library
 * 
 * Enforces duty of care requirements for mountaineering & climbing activities.
 * Under UK GDPR Art. 6(1)(b) (Contractual Necessity) and Art. 6(1)(d) (Vital Interests / Duty of Care),
 * holding member phone numbers and emergency contacts is mandatory before unlocking climbing passes.
 * Special category health data (dietary & medical) remains strictly optional per UK GDPR Art. 9.
 */

export interface SafetyProfileFields {
  phone?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  medicalNotes?: string | null;
  dietaryNotes?: string | null;
}

export interface SafetyCompletenessResult {
  isComplete: boolean;
  missingFields: string[];
  hasPhone: boolean;
  hasEmergencyContact: boolean;
  hasEmergencyPhone: boolean;
}

/**
 * Validates whether a member has provided the compulsory safety requirements
 * needed to activate and display their digital climbing membership pass.
 */
export function checkSafetyProfileCompleteness(
  profile: SafetyProfileFields | null | undefined
): SafetyCompletenessResult {
  if (!profile) {
    return {
      isComplete: false,
      missingFields: ['Phone Number', 'Emergency Contact Name', 'Emergency Contact Phone'],
      hasPhone: false,
      hasEmergencyContact: false,
      hasEmergencyPhone: false,
    };
  }

  const phone = (profile.phone || '').trim();
  const emergencyContact = (profile.emergencyContact || '').trim();
  const emergencyPhone = (profile.emergencyPhone || '').trim();

  // Basic length validations (valid phone must have at least 7 digits/characters)
  const hasPhone = phone.length >= 7;
  const hasEmergencyContact = emergencyContact.length >= 2;
  const hasEmergencyPhone = emergencyPhone.length >= 7;

  const missingFields: string[] = [];
  if (!hasPhone) missingFields.push('Phone Number');
  if (!hasEmergencyContact) missingFields.push('Emergency Contact Name');
  if (!hasEmergencyPhone) missingFields.push('Emergency Contact Phone');

  return {
    isComplete: hasPhone && hasEmergencyContact && hasEmergencyPhone,
    missingFields,
    hasPhone,
    hasEmergencyContact,
    hasEmergencyPhone,
  };
}

/**
 * Cleans and standardizes phone numbers for safety contact logs.
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '').trim();
}
