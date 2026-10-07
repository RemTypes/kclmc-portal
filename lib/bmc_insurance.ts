/**
 * KCLMC BMC Insurance Automation & Recreational Member Email Engine
 *
 * Automates the distribution of the British Mountaineering Council (BMC) insurance form
 * to all official Recreational members (including members who purchased Social and upgraded via Soc-to-Rec).
 *
 * Rules:
 * - KCL student email format: [k number]@kcl.ac.uk (e.g. k26135219@kcl.ac.uk)
 * - Recreational: [10002480] Recreational Membership
 * - Upgrade: [10188720] Soc to Rec Membership Upgrade
 * - Combined: Social + Soc-to-Rec upgrade => upgraded to Recreational
 * - Social only: [10166870] Social Membership (excluded from insurance form release)
 */

export const DEFAULT_BMC_GOOGLE_FORM_ID = '1FAIpQLSekfG2gtiKdh2WQiAkBQpbkgrm3gFBQzkD37bDRJTsVMsDK-Q';
export const DEFAULT_BMC_FORM_URL = `https://docs.google.com/forms/d/e/${DEFAULT_BMC_GOOGLE_FORM_ID}/viewform`;
export const BMC_FORM_FIELD_FORENAME = 'entry.2046598546';
export const BMC_FORM_FIELD_SURNAME = 'entry.1697412362';
export const BMC_FORM_FIELD_MEMBERSHIP_TYPE = 'entry.812283993';

export interface BmcMemberRecipient {
  cardNumber: string;      // e.g. "K26135219"
  email: string;           // e.g. "k26135219@kcl.ac.uk"
  formattedName: string;   // e.g. "Claudia Zhang"
  firstName: string;       // e.g. "Claudia"
  lastName: string;        // e.g. "Zhang"
  rawPurchaser: string;    // e.g. "ZHANG, Claudia"
  tier: 'recreational' | 'social';
  isUpgradedFromSocial: boolean;
  productName: string;
  transactionId: string;
  purchaseDate: string;
  prefilledFormUrl?: string;
  isSent?: boolean;
  sentAt?: string;
}

export interface BmcRosterStats {
  totalRows: number;
  totalUniqueMembers: number;
  recreationalCount: number;
  socialCount: number;
  upgradedCount: number;
}

export interface BmcParseResult {
  recipients: BmcMemberRecipient[];
  allMembers: BmcMemberRecipient[];
  stats: BmcRosterStats;
}

export interface BmcFormResponseRecord {
  timestamp: string;
  forename: string;
  surname: string;
  fullName: string;
  dob: string;
  address: string;
  city: string;
  postcode: string;
  mobile: string;
  membershipType: string;
  studentId?: string;
  kclEmail?: string;
  isMatched: boolean;
}

export interface BmcFormResponseParseResult {
  records: BmcFormResponseRecord[];
  totalResponses: number;
  matchedCount: number;
  unmatchedCount: number;
  phoneNumbersFound: number;
}

/**
 * Standardizes KCL Student ID into official email format: [k number]@kcl.ac.uk
 */
export function generateKclEmail(cardNumber: string | null | undefined): string {
  if (!cardNumber) return '';
  const clean = cardNumber.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!clean.startsWith('k')) {
    return `${clean}@kcl.ac.uk`;
  }
  return `${clean}@kcl.ac.uk`;
}

/**
 * Parses raw purchaser string ("LASTNAME, Firstname" or "Firstname Lastname")
 * into formatted display name and separate first/last names.
 * Correctly preserves hyphenated names (e.g. Shaw-Litzgus) and handles KCLSU mononyms (e.g. "JANJIC, -").
 */
export function parsePurchaserName(raw: string): {
  formattedName: string;
  firstName: string;
  lastName: string;
} {
  if (!raw) return { formattedName: 'Climber', firstName: 'Climber', lastName: '' };
  
  const clean = raw.replace(/^"|"$/g, '').trim();
  const titleCaseWord = (s: string) => {
    if (s === '-' || !s) return '';
    return s
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('-');
  };

  const titleCase = (s: string) =>
    s
      .trim()
      .split(/\s+/)
      .map(w => titleCaseWord(w))
      .filter(Boolean)
      .join(' ');

  if (clean.includes(',')) {
    const parts = clean.split(',').map(p => p.trim());
    const last = titleCase(parts[0]);
    const rawFirst = parts[1] || '';
    const first = rawFirst === '-' ? '' : titleCase(rawFirst);
    const formatted = first ? `${first} ${last}` : last;
    return {
      formattedName: formatted,
      firstName: first || last,
      lastName: last,
    };
  }

  const nameParts = clean.split(/\s+/).map(p => titleCase(p)).filter(Boolean);
  const firstName = nameParts[0] || 'Climber';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
  return {
    formattedName: nameParts.join(' '),
    firstName,
    lastName: lastName || firstName,
  };
}

/**
 * Generates a personalized Google Form link with pre-filled Forename, Surname, and Student status.
 */
export function generateBmcPrefilledUrl(
  member: { firstName: string; lastName: string; membershipType?: string },
  baseUrl: string = DEFAULT_BMC_FORM_URL
): string {
  const isGoogleForm = baseUrl.includes('docs.google.com/forms');
  if (!isGoogleForm) return baseUrl;

  // Ensure base URL points to viewform
  let target = baseUrl;
  if (target.includes('/formResponse')) {
    target = target.replace('/formResponse', '/viewform');
  }

  const url = new URL(target);
  url.searchParams.set('usp', 'pp_url');

  const fn = (member.firstName || '').trim();
  const ln = (member.lastName || '').trim();

  // If first name is distinct from last name, pre-fill both. If only a single name was provided, fill surname only.
  if (fn && fn !== ln && fn !== '-') {
    url.searchParams.set(BMC_FORM_FIELD_FORENAME, fn);
  }
  if (ln && ln !== '-') {
    url.searchParams.set(BMC_FORM_FIELD_SURNAME, ln);
  }
  url.searchParams.set(BMC_FORM_FIELD_MEMBERSHIP_TYPE, member.membershipType || 'Student');

  return url.toString();
}

/**
 * Determines whether a product line represents recreational membership or an upgrade.
 */
export function isRecreationalProduct(productName: string): {
  isRec: boolean;
  isUpgrade: boolean;
} {
  const p = (productName || '').toLowerCase();
  
  const isUpgrade =
    p.includes('10188720') ||
    p.includes('soc to rec') ||
    p.includes('social to rec') ||
    p.includes('upgrade') ||
    p.includes('top-up') ||
    p.includes('top up');

  const isRec =
    isUpgrade ||
    p.includes('10002480') ||
    p.includes('recreational');

  return { isRec, isUpgrade };
}

/**
 * Normalizes phone numbers to international +44 format.
 */
export function normalizeUkPhoneNumber(raw: string): string {
  if (!raw) return '';
  let clean = raw.trim().replace(/[\s\-\(\)\.]/g, '');
  if (clean.startsWith('0044')) {
    clean = '+' + clean.slice(2);
  } else if (clean.startsWith('07') && clean.length === 11) {
    clean = '+44' + clean.slice(1);
  } else if (!clean.startsWith('+') && clean.startsWith('44')) {
    clean = '+' + clean;
  }
  return clean;
}

/**
 * Parses raw KCLSU Product Purchasers CSV and applies the deduplication & upgrade logic.
 */
export function parseKclsuSalesForBmc(
  csvText: string,
  customFormUrl?: string
): BmcParseResult {
  const lines = csvText.split('\n');
  let headerIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('product_name') && lines[i].includes('card_number')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    return {
      recipients: [],
      allMembers: [],
      stats: {
        totalRows: 0,
        totalUniqueMembers: 0,
        recreationalCount: 0,
        socialCount: 0,
        upgradedCount: 0,
      },
    };
  }

  const memberMap = new Map<string, BmcMemberRecipient>();
  let totalRows = 0;

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^",]*))/g;
    const cols: string[] = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      const val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
      cols.push((val || '').trim());
    }

    if (cols.length < 5) continue;
    totalRows++;

    const productName = cols[0] || '';
    const transactionId = cols[1] || '';
    const purchaserRaw = cols[2] || '';
    const cardNumber = cols[4] || '';
    const purchaseDate = cols[7] || '';

    if (!cardNumber) continue;

    const key = cardNumber.trim().toUpperCase();
    const { isRec, isUpgrade } = isRecreationalProduct(productName);
    const { formattedName, firstName, lastName } = parsePurchaserName(purchaserRaw);
    const email = generateKclEmail(key);

    const existing = memberMap.get(key);

    if (existing) {
      if (isUpgrade) {
        existing.tier = 'recreational';
        existing.isUpgradedFromSocial = true;
        existing.productName = `${existing.productName} + ${productName}`;
      } else if (isRec && existing.tier === 'social') {
        existing.tier = 'recreational';
      }
    } else {
      const tier: 'recreational' | 'social' = isRec ? 'recreational' : 'social';
      memberMap.set(key, {
        cardNumber: key,
        email,
        formattedName,
        firstName,
        lastName,
        rawPurchaser: purchaserRaw,
        tier,
        isUpgradedFromSocial: isUpgrade,
        productName,
        transactionId,
        purchaseDate,
      });
    }
  }

  const allMembers = Array.from(memberMap.values());
  const recipients: BmcMemberRecipient[] = [];
  let recreationalCount = 0;
  let socialCount = 0;
  let upgradedCount = 0;

  const baseFormUrl = customFormUrl || DEFAULT_BMC_FORM_URL;

  for (const m of allMembers) {
    if (m.tier === 'recreational') {
      recreationalCount++;
      if (m.isUpgradedFromSocial) {
        upgradedCount++;
      }
      m.prefilledFormUrl = generateBmcPrefilledUrl(
        { firstName: m.firstName, lastName: m.lastName, membershipType: 'Student' },
        baseFormUrl
      );
      recipients.push(m);
    } else {
      socialCount++;
    }
  }

  recipients.sort((a, b) => a.formattedName.localeCompare(b.formattedName));

  return {
    recipients,
    allMembers,
    stats: {
      totalRows,
      totalUniqueMembers: allMembers.length,
      recreationalCount,
      socialCount,
      upgradedCount,
    },
  };
}

/**
 * Parses Google Form exported Responses CSV and matches against recreational roster.
 */
export function parseBmcFormResponses(
  csvText: string,
  roster: BmcMemberRecipient[] = []
): BmcFormResponseParseResult {
  const lines = csvText.split('\n');
  if (lines.length < 2) {
    return { records: [], totalResponses: 0, matchedCount: 0, unmatchedCount: 0, phoneNumbersFound: 0 };
  }

  // Build lookup index from roster (by lowercase full name and firstName + lastName)
  const rosterNameMap = new Map<string, BmcMemberRecipient>();
  roster.forEach(r => {
    const key1 = `${r.firstName.toLowerCase()} ${r.lastName.toLowerCase()}`.replace(/[^a-z]/g, '');
    const key2 = r.formattedName.toLowerCase().replace(/[^a-z]/g, '');
    rosterNameMap.set(key1, r);
    rosterNameMap.set(key2, r);
  });

  const headerLine = lines[0];
  const headerCols = headerLine.split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());

  // Find column indices
  let forenameIdx = headerCols.findIndex(h => h.includes('forename') || h.includes('first name'));
  let surnameIdx = headerCols.findIndex(h => h.includes('surname') || h.includes('last name'));
  let dobIdx = headerCols.findIndex(h => h.includes('date of birth') || h.includes('dob'));
  let addressIdx = headerCols.findIndex(h => h.includes('address line 1') || h.includes('address'));
  let cityIdx = headerCols.findIndex(h => h.includes('town') || h.includes('city'));
  let postcodeIdx = headerCols.findIndex(h => h.includes('postcode') || h.includes('postal'));
  let mobileIdx = headerCols.findIndex(h => h.includes('mobile') || h.includes('phone') || h.includes('number'));
  let memberTypeIdx = headerCols.findIndex(h => h.includes('membership type') || h.includes('membership'));

  // Defaults if exact headers match standard BMC form
  if (forenameIdx === -1) forenameIdx = 1;
  if (surnameIdx === -1) surnameIdx = 2;
  if (dobIdx === -1) dobIdx = 3;
  if (addressIdx === -1) addressIdx = 4;
  if (cityIdx === -1) cityIdx = 5;
  if (postcodeIdx === -1) postcodeIdx = 6;
  if (mobileIdx === -1) mobileIdx = 7;
  if (memberTypeIdx === -1) memberTypeIdx = 8;

  const records: BmcFormResponseRecord[] = [];
  let matchedCount = 0;
  let phoneNumbersFound = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^",]*))/g;
    const cols: string[] = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      const val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
      cols.push((val || '').trim());
    }

    const timestamp = cols[0] || '';
    const forename = (cols[forenameIdx] || '').trim();
    const surname = (cols[surnameIdx] || '').trim();
    const fullName = `${forename} ${surname}`.trim();
    const dob = (cols[dobIdx] || '').trim();
    const address = (cols[addressIdx] || '').trim();
    const city = (cols[cityIdx] || '').trim();
    const postcode = (cols[postcodeIdx] || '').trim();
    const rawMobile = (cols[mobileIdx] || '').trim();
    const mobile = normalizeUkPhoneNumber(rawMobile);
    const membershipType = (cols[memberTypeIdx] || '').trim() || 'Student';

    if (mobile) phoneNumbersFound++;

    // Match against roster
    const lookupKey = `${forename.toLowerCase()} ${surname.toLowerCase()}`.replace(/[^a-z]/g, '');
    const matched = rosterNameMap.get(lookupKey);

    if (matched) {
      matchedCount++;
      records.push({
        timestamp,
        forename,
        surname,
        fullName,
        dob,
        address,
        city,
        postcode,
        mobile,
        membershipType,
        studentId: matched.cardNumber,
        kclEmail: matched.email,
        isMatched: true,
      });
    } else {
      records.push({
        timestamp,
        forename,
        surname,
        fullName,
        dob,
        address,
        city,
        postcode,
        mobile,
        membershipType,
        isMatched: false,
      });
    }
  }

  return {
    records,
    totalResponses: records.length,
    matchedCount,
    unmatchedCount: records.length - matchedCount,
    phoneNumbersFound,
  };
}

/**
 * Generates email subject, plaintext body, and modern responsive HTML body for a member.
 */
export function generateBmcEmailContent(
  member: BmcMemberRecipient,
  formUrl?: string
): {
  subject: string;
  text: string;
  html: string;
} {
  const bmcFormUrl = formUrl || member.prefilledFormUrl || DEFAULT_BMC_FORM_URL;
  const academicYear = '2026/27';

  const subject = `[ACTION REQUIRED] KCLMC ${academicYear} BMC Insurance Registration — ${member.formattedName}`;

  const text = `Hi ${member.firstName},

Thank you for joining King's College London Mountaineering Club (KCLMC) as a Recreational Member for the ${academicYear} academic year!

Under British Mountaineering Council (BMC) regulations and club safety guidelines, all recreational climbers must register their details to activate their club insurance policy before attending club climbing meets, crag sessions, and trips.

👉 Complete your BMC Insurance Registration here (Pre-filled for you):
${bmcFormUrl}

YOUR MEMBERSHIP VERIFICATION DETAILS:
- Full Name: ${member.formattedName}
- KCL Student ID: ${member.cardNumber}
- KCL Email: ${member.email}
- Membership Tier: RECREATIONAL${member.isUpgradedFromSocial ? ' (Upgraded from Social)' : ''}
- KCLSU Purchase Ref: ${member.transactionId}

IMPORTANT SAFETY INSTRUCTIONS:
1. Please complete this form before attending your first climbing session or outdoor meet.
2. We have pre-filled your First Name and Last Name on the form to match your official KCLSU record.
3. Once completed, your climbing pass on the KCLMC portal (https://portal.kclmc.org/membership) will show your verified BMC insurance status.

If you have any questions or encounter issues opening the link, reply directly to this email or contact us at kclmc.committee@gmail.com.

Climb safe,
King's College London Mountaineering Club Committee
https://kclmc.org`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${subject}</title>
  <style>
    /* Prevent Outlook Web (OWA) Dark Mode from Inverting Clean White Card */
    [data-ogsc] .email-card { background-color: #FFFFFF !important; color: #0F172A !important; }
    [data-ogsb] .email-card { background-color: #FFFFFF !important; }
    [data-ogsc] .email-header { background-color: #041F1E !important; }
    [data-ogsb] .email-header { background-color: #041F1E !important; }
    [data-ogsc] .email-btn { background-color: #FFBD59 !important; }
    [data-ogsb] .email-btn { background-color: #FFBD59 !important; }
    [data-ogsc] .email-btn span { color: #041F1E !important; }
    [data-ogsc] .email-badge span { color: #FFBD59 !important; }
    [data-ogsc] .email-info-box { background-color: #F8FAFC !important; }
    [data-ogsb] .email-info-box { background-color: #F8FAFC !important; }
    [data-ogsc] .email-text-dark { color: #0F172A !important; }
  </style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F1F5F9; background-image: linear-gradient(#F1F5F9, #F1F5F9); color: #0F172A; margin: 0; padding: 28px 12px;">
  <div class="email-card" style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; background-image: linear-gradient(#FFFFFF, #FFFFFF); border: 1px solid #CBD5E1; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
    
    <!-- Top Header Banner (KCLMC Deep Forest Green) -->
    <div class="email-header" style="background-color: #041F1E; background-image: linear-gradient(#041F1E, #041F1E); padding: 28px 24px; text-align: center;">
      <span class="email-badge" style="display: inline-block; background-color: rgba(255, 189, 89, 0.15); color: #FFBD59; font-size: 11px; font-weight: bold; padding: 4px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px; border: 1px solid #FFBD59;">
        <span style="color: #FFBD59 !important;">Official KCLMC // BMC Insurance Release</span>
      </span>
      <h1 style="color: #FFFFFF; font-size: 22px; font-weight: 800; margin: 16px 0 6px; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.3;">
        <span style="color: #FFFFFF !important;">Action Required: BMC Insurance Form</span>
      </h1>
      <p style="color: #94A3B8; font-size: 13px; margin: 0;">Season ${academicYear} • King&apos;s College London Mountaineering Club</p>
    </div>

    <!-- Main Message Body (Clean White Surface) -->
    <div style="padding: 32px 28px; background-color: #FFFFFF; background-image: linear-gradient(#FFFFFF, #FFFFFF);">
      <p class="email-text-dark" style="font-size: 16px; font-weight: 800; color: #041F1E; margin-top: 0; margin-bottom: 16px;">
        <span style="color: #041F1E !important;">Hi ${member.firstName},</span>
      </p>

      <p class="email-text-dark" style="font-size: 14px; line-height: 1.6; color: #1E293B; margin-bottom: 14px;">
        Thank you for joining <strong>KCLMC</strong> as an official <strong>Recreational Member</strong> for the ${academicYear} academic year!
      </p>

      <p class="email-text-dark" style="font-size: 14px; line-height: 1.6; color: #1E293B; margin-bottom: 24px;">
        Under British Mountaineering Council (BMC) regulations and our society duty of care, all recreational climbers must register their details to activate their club personal accident &amp; combined liability insurance before attending club meets, crag trips, and climbing wall sessions.
      </p>

      <!-- Solid King's Gold CTA Button -->
      <table border="0" cellspacing="0" cellpadding="0" style="margin: 28px auto 16px;">
        <tr>
          <td align="center" class="email-btn" style="border-radius: 12px; background-color: #FFBD59; background-image: linear-gradient(#FFBD59, #FFBD59);">
            <a href="${bmcFormUrl}" target="_blank"
               style="font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 900; color: #041F1E; text-decoration: none; padding: 15px 32px; display: inline-block; text-transform: uppercase; letter-spacing: 0.8px; border-radius: 12px;">
              <span style="color: #041F1E !important; font-weight: 900 !important;">Complete BMC Insurance Form ↗</span>
            </a>
          </td>
        </tr>
      </table>
      <p style="font-size: 11px; text-align: center; color: #64748B; margin-top: 0; margin-bottom: 28px;">
        Pre-filled link: <a href="${bmcFormUrl}" style="color: #0F766E; font-weight: 700; text-decoration: underline; word-break: break-all;">Open Form in New Tab</a>
      </p>

      <!-- Verification Info Box -->
      <div class="email-info-box" style="background-color: #F8FAFC; background-image: linear-gradient(#F8FAFC, #F8FAFC); border: 1px solid #E2E8F0; border-left: 4px solid #FFBD59; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
        <h3 style="color: #041F1E; font-size: 11px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800;">
          <span style="color: #041F1E !important;">Your Membership Details (Auto Pre-Filled):</span>
        </h3>
        <table style="width: 100%; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, monospace; color: #1E293B;">
          <tr>
            <td style="color: #64748B; padding: 4px 0; width: 130px;">Student ID:</td>
            <td style="font-weight: 800; color: #041F1E; font-family: monospace;"><span style="color: #041F1E !important;">${member.cardNumber}</span></td>
          </tr>
          <tr>
            <td style="color: #64748B; padding: 4px 0;">Full Name:</td>
            <td style="font-weight: 700; color: #041F1E;"><span style="color: #041F1E !important;">${member.formattedName}</span></td>
          </tr>
          <tr>
            <td style="color: #64748B; padding: 4px 0;">KCL Email:</td>
            <td style="font-weight: 600; color: #0F766E; font-family: monospace;"><span style="color: #0F766E !important;">${member.email}</span></td>
          </tr>
          <tr>
            <td style="color: #64748B; padding: 4px 0;">Membership Tier:</td>
            <td>
              <span style="background-color: #DCFCE7; color: #166534; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 4px; border: 1px solid #BBF7D0;">
                <span style="color: #166534 !important;">RECREATIONAL${member.isUpgradedFromSocial ? ' (Upgraded from Social)' : ''}</span>
              </span>
            </td>
          </tr>
          <tr>
            <td style="color: #64748B; padding: 4px 0;">KCLSU Reference:</td>
            <td style="color: #64748B; font-family: monospace;"><span style="color: #64748B !important;">${member.transactionId}</span></td>
          </tr>
        </table>
      </div>

      <!-- Why Required Notice -->
      <div style="font-size: 12px; line-height: 1.6; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 18px;">
        <strong style="color: #1E293B;"><span style="color: #1E293B !important;">Why is this required?</span></strong>
        <p style="margin: 4px 0 0; color: #64748B;">
          Recreational membership includes British Mountaineering Council (BMC) club combined liability insurance and subsidized equipment access. Submitting the form confirms your policy before your first climbing session.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #F8FAFC; background-image: linear-gradient(#F8FAFC, #F8FAFC); border-top: 1px solid #E2E8F0; padding: 20px; text-align: center; font-size: 11px; color: #64748B;">
      <p style="margin: 0; font-weight: 600; color: #1E293B;"><span style="color: #1E293B !important;">King&apos;s College London Mountaineering Club • KCLSU Accredited Society</span></p>
      <p style="margin: 4px 0 0;">
        Contact: <a href="mailto:kclmc.committee@gmail.com" style="color: #0F766E; text-decoration: underline;">kclmc.committee@gmail.com</a> • <a href="https://kclmc.org" style="color: #0F766E; text-decoration: underline;">kclmc.org</a>
      </p>
    </div>

  </div>
</body>
</html>`;

  return { subject, text, html };
}

/**
 * Generates an RFC-compliant CSV containing all recreational members with derived emails and personalized form links,
 * perfect for direct mail merges in Microsoft Outlook, Google Workspace, or Mailchimp.
 */
export function generateBmcMailMergeCsv(
  recipients: BmcMemberRecipient[],
  customBaseFormUrl?: string
): string {
  const headers = [
    'Student ID',
    'Full Name',
    'First Name',
    'Last Name',
    'KCL Email',
    'Membership Tier',
    'Upgraded From Social',
    'KCLSU Transaction ID',
    'Purchase Date',
    'Personalized BMC Form Link',
  ];

  const escapeCell = (val: string | boolean | undefined) => {
    if (val === undefined || val === null) return '""';
    const clean = String(val).replace(/"/g, '""');
    return `"${clean}"`;
  };

  const rows = recipients.map(r => {
    const link = r.prefilledFormUrl || generateBmcPrefilledUrl(
      { firstName: r.firstName, lastName: r.lastName, membershipType: 'Student' },
      customBaseFormUrl || DEFAULT_BMC_FORM_URL
    );

    return [
      escapeCell(r.cardNumber),
      escapeCell(r.formattedName),
      escapeCell(r.firstName),
      escapeCell(r.lastName),
      escapeCell(r.email),
      escapeCell(r.tier.toUpperCase()),
      escapeCell(r.isUpgradedFromSocial ? 'YES' : 'NO'),
      escapeCell(r.transactionId),
      escapeCell(r.purchaseDate),
      escapeCell(link),
    ];
  });

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export type BmcDispatchMap = Record<
  string,
  {
    sentAt: string;
    email?: string;
    fullName?: string;
  }
>;

/**
 * Partitions recreational recipients into new/unsent and already emailed members,
 * preventing accidental duplicate emails when new members join later.
 */
export function partitionRecipientsByDispatchStatus(
  recipients: BmcMemberRecipient[],
  dispatches: BmcDispatchMap
): {
  unsentRecipients: BmcMemberRecipient[];
  alreadySentRecipients: BmcMemberRecipient[];
  allEnriched: BmcMemberRecipient[];
} {
  const unsent: BmcMemberRecipient[] = [];
  const alreadySent: BmcMemberRecipient[] = [];
  const allEnriched: BmcMemberRecipient[] = [];

  // Build case-insensitive lookup sets
  const cardLookup = new Map<string, { sentAt: string; email?: string }>();
  const emailLookup = new Map<string, { sentAt: string; email?: string }>();

  for (const [key, val] of Object.entries(dispatches || {})) {
    if (key) cardLookup.set(key.toUpperCase().trim(), val);
    if (val.email) emailLookup.set(val.email.toLowerCase().trim(), val);
  }

  for (const r of recipients) {
    const cardKey = (r.cardNumber || '').toUpperCase().trim();
    const emailKey = (r.email || '').toLowerCase().trim();

    const dispatch = cardLookup.get(cardKey) || emailLookup.get(emailKey);
    const isSent = Boolean(dispatch);
    const sentAt = dispatch?.sentAt;

    const enriched: BmcMemberRecipient = {
      ...r,
      isSent,
      sentAt,
    };

    allEnriched.push(enriched);
    if (isSent) {
      alreadySent.push(enriched);
    } else {
      unsent.push(enriched);
    }
  }

  return {
    unsentRecipients: unsent,
    alreadySentRecipients: alreadySent,
    allEnriched,
  };
}

