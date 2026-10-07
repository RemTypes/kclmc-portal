import { describe, it, expect } from 'vitest';
import {
  generateKclEmail,
  parsePurchaserName,
  isRecreationalProduct,
  generateBmcPrefilledUrl,
  normalizeUkPhoneNumber,
  parseKclsuSalesForBmc,
  parseBmcFormResponses,
  generateBmcEmailContent,
  generateBmcMailMergeCsv,
  partitionRecipientsByDispatchStatus,
  DEFAULT_BMC_FORM_URL,
} from '@/lib/bmc_insurance';


describe('BMC Insurance Email Automation & Verification Engine', () => {
  describe('generateKclEmail', () => {
    it('converts standard KCL Student ID (K-number) to official email', () => {
      expect(generateKclEmail('K26135219')).toBe('k26135219@kcl.ac.uk');
      expect(generateKclEmail('k23164943')).toBe('k23164943@kcl.ac.uk');
      expect(generateKclEmail(' K25008223 ')).toBe('k25008223@kcl.ac.uk');
    });

    it('handles empty and malformed card numbers gracefully', () => {
      expect(generateKclEmail('')).toBe('');
      expect(generateKclEmail(null)).toBe('');
      expect(generateKclEmail(undefined)).toBe('');
    });
  });

  describe('parsePurchaserName', () => {
    it('formats "LASTNAME, Firstname" into proper title case', () => {
      const res1 = parsePurchaserName('ZHANG, Claudia');
      expect(res1.formattedName).toBe('Claudia Zhang');
      expect(res1.firstName).toBe('Claudia');
      expect(res1.lastName).toBe('Zhang');

      const res2 = parsePurchaserName('Holdsworth, Tristan');
      expect(res2.formattedName).toBe('Tristan Holdsworth');
      expect(res2.firstName).toBe('Tristan');
      expect(res2.lastName).toBe('Holdsworth');
    });

    it('formats names with hyphens and multiple words', () => {
      const res = parsePurchaserName('SHAW-LITZGUS, Simone');
      expect(res.formattedName).toBe('Simone Shaw-Litzgus');
      expect(res.firstName).toBe('Simone');
    });

    it('handles direct first last format', () => {
      const res = parsePurchaserName('Remy Preston');
      expect(res.formattedName).toBe('Remy Preston');
      expect(res.firstName).toBe('Remy');
      expect(res.lastName).toBe('Preston');
    });
  });

  describe('generateBmcPrefilledUrl', () => {
    it('correctly appends Google Form entry query parameters', () => {
      const url = generateBmcPrefilledUrl({
        firstName: 'Claudia',
        lastName: 'Zhang',
        membershipType: 'Student',
      });

      expect(url).toContain('docs.google.com/forms');
      expect(url).toContain('entry.2046598546=Claudia');
      expect(url).toContain('entry.1697412362=Zhang');
      expect(url).toContain('entry.812283993=Student');
      expect(url).toContain('usp=pp_url');
    });

    it('replaces formResponse with viewform for direct user display', () => {
      const url = generateBmcPrefilledUrl(
        { firstName: 'Tristan', lastName: 'Holdsworth' },
        'https://docs.google.com/forms/d/e/1FAIpQLSekfG2gtiKdh2WQiAkBQpbkgrm3gFBQzkD37bDRJTsVMsDK-Q/formResponse'
      );
      expect(url).toContain('/viewform');
      expect(url).not.toContain('/formResponse');
    });
  });

  describe('normalizeUkPhoneNumber', () => {
    it('converts local UK 07 mobile format to international +447 format', () => {
      expect(normalizeUkPhoneNumber('07123456789')).toBe('+447123456789');
      expect(normalizeUkPhoneNumber('07123 456 789')).toBe('+447123456789');
      expect(normalizeUkPhoneNumber('07123-456-789')).toBe('+447123456789');
    });

    it('preserves existing international formats', () => {
      expect(normalizeUkPhoneNumber('+447123456789')).toBe('+447123456789');
      expect(normalizeUkPhoneNumber('+15551234567')).toBe('+15551234567');
    });
  });

  describe('isRecreationalProduct', () => {
    it('identifies recreational membership products', () => {
      const res = isRecreationalProduct('[10002480] Climbing/Mountaineering Recreational Membership');
      expect(res.isRec).toBe(true);
      expect(res.isUpgrade).toBe(false);
    });

    it('identifies soc to rec membership upgrade products', () => {
      const res = isRecreationalProduct('[10188720] Climbing/Mountaineering Soc to Rec Membership Upgrade');
      expect(res.isRec).toBe(true);
      expect(res.isUpgrade).toBe(true);
    });

    it('identifies social membership products', () => {
      const res = isRecreationalProduct('[10166870] Climbing/Mountaineering Social Membership');
      expect(res.isRec).toBe(false);
      expect(res.isUpgrade).toBe(false);
    });
  });

  describe('parseKclsuSalesForBmc', () => {
    const sampleCsv = `textbox37,textbox23,textbox53,textbox28,textbox51,textbox48,textbox45
ALL,ALL,Climbing/Mountaineering,Sat 01 Aug 2026 00:00,Mon 05 Oct 2026 00:00,* ALL *,* ALL *

product_name,transaction_id,purchaser,textbox6,card_number,shop_name,qty,purchase_date
[10002480] Climbing/Mountaineering Recreational Membership,31651581,"ZHANG, Claudia",,K26135219,Website,1,Sat 03 Oct 2026 00:03
[10002480] Climbing/Mountaineering Recreational Membership,31651424,"Holdsworth, Tristan",,K23164943,Website,1,Fri 02 Oct 2026 21:39
[10166870] Climbing/Mountaineering Social Membership,31652367,"TRYBUCHOWSKA, Pola",,K25097420,Website,1,Sat 03 Oct 2026 20:15
[10166870] Climbing/Mountaineering Social Membership,31639599,"YE, Michelle",,K26014032,Website,1,Sun 27 Sep 2026 17:06
[10188720] Climbing/Mountaineering Soc to Rec Membership Upgrade,31641237,"YE, Michelle",,K26014032,Website,1,Mon 28 Sep 2026 12:32
`;

    it('correctly filters recreational members and upgrades social-to-rec members with prefilled links', () => {
      const result = parseKclsuSalesForBmc(sampleCsv);

      expect(result.stats.totalRows).toBe(5);
      expect(result.stats.totalUniqueMembers).toBe(4);
      expect(result.stats.recreationalCount).toBe(3); // Claudia, Tristan, Michelle (upgraded)
      expect(result.stats.socialCount).toBe(1);       // Pola (pure social)
      expect(result.stats.upgradedCount).toBe(1);     // Michelle

      const michelle = result.recipients.find(r => r.cardNumber === 'K26014032');
      expect(michelle).toBeDefined();
      expect(michelle?.tier).toBe('recreational');
      expect(michelle?.isUpgradedFromSocial).toBe(true);
      expect(michelle?.email).toBe('k26014032@kcl.ac.uk');
      expect(michelle?.prefilledFormUrl).toContain('entry.2046598546=Michelle');
      expect(michelle?.prefilledFormUrl).toContain('entry.1697412362=Ye');
    });

    it('generates valid emails for all recipients', () => {
      const result = parseKclsuSalesForBmc(sampleCsv);
      for (const rec of result.recipients) {
        expect(rec.email).toMatch(/^k\d+@kcl\.ac\.uk$/);
      }
    });
  });

  describe('parseBmcFormResponses', () => {
    const sampleResponsesCsv = `Timestamp,Forename,Surname,Date of Birth,Address Line 1,Town/City,Postcode,Mobile Number with country code (e.g. +44),Membership type
2026/10/06 14:20:00,Claudia,Zhang,2002-05-12,Flat 4 Stamford St,London,SE1 9NQ,+447911123456,Student
2026/10/06 14:25:00,Tristan,Holdsworth,2001-08-20,12 High St,London,WC2R 2LS,07890123456,Student
2026/10/06 15:00:00,Random,Visitor,1999-01-01,1 Street,London,E1 6AN,+447000000000,Student
`;

    const sampleRoster = [
      {
        cardNumber: 'K26135219',
        email: 'k26135219@kcl.ac.uk',
        formattedName: 'Claudia Zhang',
        firstName: 'Claudia',
        lastName: 'Zhang',
        rawPurchaser: 'ZHANG, Claudia',
        tier: 'recreational' as const,
        isUpgradedFromSocial: false,
        productName: '[10002480] Recreational Membership',
        transactionId: '31651581',
        purchaseDate: 'Sat 03 Oct 2026 00:03',
      },
      {
        cardNumber: 'K23164943',
        email: 'k23164943@kcl.ac.uk',
        formattedName: 'Tristan Holdsworth',
        firstName: 'Tristan',
        lastName: 'Holdsworth',
        rawPurchaser: 'Holdsworth, Tristan',
        tier: 'recreational' as const,
        isUpgradedFromSocial: false,
        productName: '[10002480] Recreational Membership',
        transactionId: '31651424',
        purchaseDate: 'Fri 02 Oct 2026 21:39',
      },
    ];

    it('matches responses against roster, extracts phone, and flags unmatched responses', () => {
      const parsed = parseBmcFormResponses(sampleResponsesCsv, sampleRoster);

      expect(parsed.totalResponses).toBe(3);
      expect(parsed.matchedCount).toBe(2);
      expect(parsed.unmatchedCount).toBe(1);
      expect(parsed.phoneNumbersFound).toBe(3);

      const claudia = parsed.records.find(r => r.fullName === 'Claudia Zhang');
      expect(claudia).toBeDefined();
      expect(claudia?.isMatched).toBe(true);
      expect(claudia?.studentId).toBe('K26135219');
      expect(claudia?.mobile).toBe('+447911123456');

      const tristan = parsed.records.find(r => r.fullName === 'Tristan Holdsworth');
      expect(tristan).toBeDefined();
      expect(tristan?.isMatched).toBe(true);
      expect(tristan?.studentId).toBe('K23164943');
      expect(tristan?.mobile).toBe('+447890123456'); // converted from 07890123456

      const visitor = parsed.records.find(r => r.fullName === 'Random Visitor');
      expect(visitor).toBeDefined();
      expect(visitor?.isMatched).toBe(false);
    });
  });

  describe('generateBmcEmailContent', () => {
    it('creates personalized subject and body with form link', () => {
      const member = {
        cardNumber: 'K26135219',
        email: 'k26135219@kcl.ac.uk',
        formattedName: 'Claudia Zhang',
        firstName: 'Claudia',
        lastName: 'Zhang',
        rawPurchaser: 'ZHANG, Claudia',
        tier: 'recreational' as const,
        isUpgradedFromSocial: false,
        productName: '[10002480] Recreational Membership',
        transactionId: '31651581',
        purchaseDate: 'Sat 03 Oct 2026 00:03',
        prefilledFormUrl: 'https://docs.google.com/forms/d/e/sample/viewform?entry.2046598546=Claudia',
      };

      const { subject, text, html } = generateBmcEmailContent(member);

      expect(subject).toContain('Claudia Zhang');
      expect(subject).toContain('2026/27');
      expect(text).toContain('Hi Claudia,');
      expect(text).toContain('https://docs.google.com/forms/d/e/sample/viewform?entry.2046598546=Claudia');
      expect(text).toContain('K26135219');
      expect(html).toContain('Claudia');
      expect(html).toContain('Complete BMC Insurance Form');
    });

    it('ensures distinct members receive completely individualized details and not static template data', () => {
      const member1 = {
        cardNumber: 'K26069864',
        email: 'k26069864@kcl.ac.uk',
        formattedName: 'Adam Dridi Bouzid',
        firstName: 'Adam',
        lastName: 'Bouzid',
        rawPurchaser: 'Bouzid, Adam Dridi',
        tier: 'recreational' as const,
        isUpgradedFromSocial: false,
        productName: '[10002480] Recreational Membership',
        transactionId: '31655005',
        purchaseDate: 'Sat 03 Oct 2026 12:00',
        prefilledFormUrl: 'https://docs.google.com/forms/d/e/sample/viewform?entry.2046598546=Adam&entry.1697412362=Bouzid',
      };

      const member2 = {
        cardNumber: 'K24083818',
        email: 'k24083818@kcl.ac.uk',
        formattedName: 'Simone Shaw-Litzgus',
        firstName: 'Simone',
        lastName: 'Shaw-Litzgus',
        rawPurchaser: 'SHAW-LITZGUS, Simone',
        tier: 'recreational' as const,
        isUpgradedFromSocial: true,
        productName: '[10188720] Upgrade from Social',
        transactionId: '31652099',
        purchaseDate: 'Sat 03 Oct 2026 14:00',
        prefilledFormUrl: 'https://docs.google.com/forms/d/e/sample/viewform?entry.2046598546=Simone&entry.1697412362=Shaw-Litzgus',
      };

      const email1 = generateBmcEmailContent(member1);
      const email2 = generateBmcEmailContent(member2);

      // Unique greetings
      expect(email1.text).toContain('Hi Adam,');
      expect(email2.text).toContain('Hi Simone,');
      expect(email1.text).not.toContain('Simone');
      expect(email2.text).not.toContain('Adam');

      // Unique Student IDs
      expect(email1.text).toContain('K26069864');
      expect(email2.text).toContain('K24083818');
      expect(email1.text).not.toContain('K24083818');
      expect(email2.text).not.toContain('K26069864');

      // Unique Prefill Links
      expect(email1.text).toContain('entry.2046598546=Adam');
      expect(email2.text).toContain('entry.2046598546=Simone');

      // Unique Subjects
      expect(email1.subject).toContain('Adam Dridi Bouzid');
      expect(email2.subject).toContain('Simone Shaw-Litzgus');
    });
  });

  describe('generateBmcMailMergeCsv', () => {
    it('generates standard RFC-compliant CSV headers and rows with prefilled URLs', () => {
      const recipients = [
        {
          cardNumber: 'K26135219',
          email: 'k26135219@kcl.ac.uk',
          formattedName: 'Claudia Zhang',
          firstName: 'Claudia',
          lastName: 'Zhang',
          rawPurchaser: 'ZHANG, Claudia',
          tier: 'recreational' as const,
          isUpgradedFromSocial: false,
          productName: '[10002480] Recreational Membership',
          transactionId: '31651581',
          purchaseDate: 'Sat 03 Oct 2026 00:03',
          prefilledFormUrl: 'https://docs.google.com/forms/sample?entry.2046598546=Claudia',
        },
      ];

      const csv = generateBmcMailMergeCsv(recipients);
      expect(csv).toContain('Student ID,Full Name,First Name,Last Name,KCL Email');
      expect(csv).toContain('"K26135219"');
      expect(csv).toContain('"k26135219@kcl.ac.uk"');
      expect(csv).toContain('"https://docs.google.com/forms/sample?entry.2046598546=Claudia"');
    });
  });

  describe('partitionRecipientsByDispatchStatus (Duplicate Prevention)', () => {
    const mockRecipients = [
      {
        cardNumber: 'K26012345',
        email: 'k26012345@kcl.ac.uk',
        formattedName: 'Alice Climber',
        firstName: 'Alice',
        lastName: 'Climber',
        rawPurchaser: 'CLIMBER, Alice',
        tier: 'recreational' as const,
        isUpgradedFromSocial: false,
        productName: '[10002480] Recreational Membership',
        transactionId: '1001',
        purchaseDate: 'Sat 03 Oct 2026 00:03',
      },
      {
        cardNumber: 'K26099999',
        email: 'k26099999@kcl.ac.uk',
        formattedName: 'Bob Belayer',
        firstName: 'Bob',
        lastName: 'Belayer',
        rawPurchaser: 'BELAYER, Bob',
        tier: 'recreational' as const,
        isUpgradedFromSocial: false,
        productName: '[10002480] Recreational Membership',
        transactionId: '1002',
        purchaseDate: 'Sat 03 Oct 2026 00:05',
      },
      {
        cardNumber: 'K26055555',
        email: 'k26055555@kcl.ac.uk',
        formattedName: 'Charlie Crag',
        firstName: 'Charlie',
        lastName: 'Crag',
        rawPurchaser: 'CRAG, Charlie',
        tier: 'recreational' as const,
        isUpgradedFromSocial: false,
        productName: '[10002480] Recreational Membership',
        transactionId: '1003',
        purchaseDate: 'Sat 03 Oct 2026 00:07',
      },
    ];

    it('identifies new unsent members and already sent members correctly', () => {
      const dispatches = {
        K26012345: {
          sentAt: '2026-10-07T12:00:00.000Z',
          email: 'k26012345@kcl.ac.uk',
          fullName: 'Alice Climber',
        },
      };

      const result = partitionRecipientsByDispatchStatus(mockRecipients, dispatches);

      expect(result.unsentRecipients).toHaveLength(2);
      expect(result.alreadySentRecipients).toHaveLength(1);
      expect(result.alreadySentRecipients[0].cardNumber).toBe('K26012345');
      expect(result.alreadySentRecipients[0].isSent).toBe(true);
      expect(result.alreadySentRecipients[0].sentAt).toBe('2026-10-07T12:00:00.000Z');

      const unsentCards = result.unsentRecipients.map(r => r.cardNumber);
      expect(unsentCards).toEqual(['K26099999', 'K26055555']);
    });

    it('matches card numbers case-insensitively and with whitespace', () => {
      const dispatches = {
        k26099999: {
          sentAt: '2026-10-07T14:30:00.000Z',
          email: 'k26099999@kcl.ac.uk',
          fullName: 'Bob Belayer',
        },
      };

      const result = partitionRecipientsByDispatchStatus(mockRecipients, dispatches);
      expect(result.alreadySentRecipients).toHaveLength(1);
      expect(result.alreadySentRecipients[0].cardNumber).toBe('K26099999');
      expect(result.alreadySentRecipients[0].isSent).toBe(true);
    });

    it('matches by email when card number differs or is looked up via email fallback', () => {
      const dispatches = {
        OTHERCARD: {
          sentAt: '2026-10-07T15:00:00.000Z',
          email: 'K26055555@KCL.AC.UK', // uppercase email
          fullName: 'Charlie Crag',
        },
      };

      const result = partitionRecipientsByDispatchStatus(mockRecipients, dispatches);
      expect(result.alreadySentRecipients).toHaveLength(1);
      expect(result.alreadySentRecipients[0].cardNumber).toBe('K26055555');
      expect(result.alreadySentRecipients[0].isSent).toBe(true);
    });

    it('returns all members as unsent when dispatches map is empty', () => {
      const result = partitionRecipientsByDispatchStatus(mockRecipients, {});
      expect(result.unsentRecipients).toHaveLength(3);
      expect(result.alreadySentRecipients).toHaveLength(0);
      expect(result.allEnriched.every(r => r.isSent === false)).toBe(true);
    });
  });
});

