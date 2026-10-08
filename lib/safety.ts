/**
 * Safety Gate & Mandatory Profile Verification Library
 * 
 * Enforces duty of care requirements for mountaineering & climbing activities
 * under British Mountaineering Council (BMC) and society safety compliance.
 * Under UK GDPR Art. 6(1)(b) (Contractual Necessity) and Art. 6(1)(d) (Vital Interests / Duty of Care),
 * holding member phone numbers and emergency contacts is mandatory before unlocking climbing passes.
 * Special category health data (dietary & medical) remains strictly optional per UK GDPR Art. 9.
 */

export interface SafetyProfileFields {
  phone?: string | null;
  // camelCase conventions (from forms)
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  medicalNotes?: string | null;
  dietaryNotes?: string | null;
  // snake_case conventions (from database models)
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  dietary_requirements?: string | null;
  medical_notes?: string | null;
}

export interface SafetyCompletenessResult {
  isComplete: boolean;
  missingFields: string[];
  hasPhone: boolean;
  hasEmergencyContact: boolean;
  hasEmergencyName: boolean;
  hasEmergencyPhone: boolean;
}

/**
 * Validates a mobile or emergency phone number.
 * Accepts international (+44...) or standard UK (07...) formats with spaces/hyphens.
 * Minimum 7 digits, maximum 16 digits.
 */
export function validatePhoneNumber(phone: string | null | undefined): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.trim().replace(/[\s\-()]/g, '');
  return /^\+?[0-9]{7,16}$/.test(cleaned);
}

/**
 * Formats a phone number for vCard and WhatsApp wa.me links.
 * Converts UK 07xxx to +447xxx and strips all whitespace/formatting.
 */
export function formatPhoneNumberForWhatsApp(phone: string | null | undefined): string {
  if (!phone) return '';
  let cleaned = phone.trim().replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('07')) {
    cleaned = '+44' + cleaned.slice(1);
  } else if (cleaned.startsWith('447')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

/**
 * Validates emergency contact full name (minimum 2 characters).
 */
export function validateEmergencyName(name: string | null | undefined): boolean {
  if (!name || typeof name !== 'string') return false;
  return name.trim().length >= 2;
}

/**
 * Validates whether a member has provided the compulsory safety requirements
 * needed to activate and display their digital climbing membership pass.
 * Accepts both camelCase form inputs and snake_case Supabase Profile database records.
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
      hasEmergencyName: false,
      hasEmergencyPhone: false,
    };
  }

  const phone = (profile.phone || '').trim();
  const emergencyContact = (
    profile.emergencyContact || 
    profile.emergency_contact_name || 
    ''
  ).trim();
  const emergencyPhone = (
    profile.emergencyPhone || 
    profile.emergency_contact_phone || 
    ''
  ).trim();

  const hasPhone = validatePhoneNumber(phone);
  const hasEmergencyContact = validateEmergencyName(emergencyContact);
  const hasEmergencyPhone = validatePhoneNumber(emergencyPhone);

  const missingFields: string[] = [];
  if (!hasPhone) missingFields.push('Phone Number');
  if (!hasEmergencyContact) missingFields.push('Emergency Contact Name');
  if (!hasEmergencyPhone) missingFields.push('Emergency Contact Phone');

  return {
    isComplete: hasPhone && hasEmergencyContact && hasEmergencyPhone,
    missingFields,
    hasPhone,
    hasEmergencyContact,
    hasEmergencyName: hasEmergencyContact,
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

/**
 * Generates a standard vCard 3.0 export for verified KCLMC members.
 * Enables 1-click import into committee phone contacts (Google/iCloud),
 * allowing the committee to bulk-add members to the WhatsApp Community without distributing links.
 */
export function generateMembersVCard(members: Array<{
  name: string;
  phone?: string | null;
  cardNumber?: string;
  tier?: string;
}>): string {
  const cards = members
    .filter(m => m.phone && validatePhoneNumber(m.phone))
    .map(m => {
      const cleanPhone = formatPhoneNumberForWhatsApp(m.phone);
      const nameParts = (m.name || 'Climber').trim().split(/\s+/);
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0];
      const tierLabel = (m.tier || 'member').toUpperCase();
      const cardNum = m.cardNumber || 'VERIFIED';

      return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:KCLMC 26/27 - ${m.name}`,
        `N:${lastName};${firstName};;;`,
        `TEL;TYPE=CELL,VOICE:${cleanPhone}`,
        `NOTE:KCLSU ID: ${cardNum} | Tier: ${tierLabel} | Verified Pass`,
        'CATEGORIES:KCLMC 26/27',
        'END:VCARD',
      ].join('\r\n');
    });

  return cards.join('\r\n');
}

/**
 * Constructs a deep link (wa.me) for a member to directly request WhatsApp Community
 * admittance from the committee without exposing any public invite link.
 */
export function generateWhatsAppRequestUrl(
  committeePhone: string,
  member: { name: string; studentId: string }
): string {
  const cleanPhone = committeePhone.replace(/[^0-9]/g, '');
  const message = `Hi KCLMC! I've activated my 2026/27 climbing pass (Name: ${member.name}, Student ID: ${member.studentId}). Please add me to the WhatsApp Community!`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
