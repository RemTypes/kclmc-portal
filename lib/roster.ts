export interface KclsuMemberRecord {
  cardNumber: string; // KCL ID e.g. K1234567
  name: string;       // Formatted name e.g. "Alex Honnold"
  rawPurchaser: string;
  tier: 'recreational' | 'social';
  productName: string;
  transactionId: string;
  purchaseDate: string;
}

export function sanitizeCsvCell(val: string): string {
  if (!val) return '';
  let cleaned = val.trim();
  // Neutralize CSV formula injection characters (=, +, -, @) if at start of string
  if (/^[=+@-]/i.test(cleaned)) {
    cleaned = cleaned.replace(/^[=+@-]+/, '').trim();
  }
  return cleaned;
}

const PLACEHOLDER_TOKENS = new Set([
  '-',
  '--',
  '---',
  '.',
  '..',
  '?',
  '*',
  '#',
  'n/a',
  'na',
  'none',
  'unknown',
  'null',
  'undefined',
  'not provided',
]);

/**
 * Checks if a string is a placeholder or filler token used by SU systems when names are missing.
 */
export function isPlaceholderToken(str: string | null | undefined): boolean {
  if (!str) return true;
  const clean = str.trim().toLowerCase();
  return (
    clean.length === 0 ||
    /^[-_.*#?/\\]+$/.test(clean) ||
    PLACEHOLDER_TOKENS.has(clean)
  );
}

/**
 * Checks if a member name contains at least a valid first and last name.
 */
export function isCompleteFullName(name: string | null | undefined): boolean {
  if (!name || typeof name !== 'string') return false;
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(w => !isPlaceholderToken(w));
  return parts.length >= 2;
}

export function formatPurchaserName(raw: string): string {
  if (!raw) return '';
  const sanitized = sanitizeCsvCell(raw);
  // Handle formats like "SMITH, Jane", "DOE, John", "JANJIC, -"
  const clean = sanitized.replace(/^"|"$/g, '').trim();

  const formatPart = (str: string) =>
    str
      .toLowerCase()
      .split(/\s+/)
      .filter(w => !isPlaceholderToken(w))
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .trim();

  if (clean.includes(',')) {
    const [last, first] = clean.split(',').map(s => s.trim());
    const validFirst = !isPlaceholderToken(first);
    const validLast = !isPlaceholderToken(last);

    if (validFirst && validLast) {
      return `${formatPart(first)} ${formatPart(last)}`.trim();
    }
    if (validLast) {
      return formatPart(last);
    }
    if (validFirst) {
      return formatPart(first);
    }
  }
  return formatPart(clean);
}

export const INITIAL_KCLSU_ROSTER: KclsuMemberRecord[] = [
  {
    cardNumber: 'K26122068',
    name: 'Alex Honnold',
    rawPurchaser: 'HONNOLD, Alex',
    tier: 'social',
    productName: '[10166870] Climbing/Mountaineering Social Membership',
    transactionId: '31631002',
    purchaseDate: 'Wed 23 Sep 2026 17:55',
  },
  {
    cardNumber: 'K26019642',
    name: 'Lynn Hill',
    rawPurchaser: 'HILL, Lynn',
    tier: 'social',
    productName: '[10166870] Climbing/Mountaineering Social Membership',
    transactionId: '31630684',
    purchaseDate: 'Wed 23 Sep 2026 16:40',
  },
  {
    cardNumber: 'K26010174',
    name: 'Tommy Caldwell',
    rawPurchaser: 'CALDWELL, Tommy',
    tier: 'social',
    productName: '[10166870] Climbing/Mountaineering Social Membership',
    transactionId: '31628197',
    purchaseDate: 'Tue 22 Sep 2026 22:36',
  },
  {
    cardNumber: 'K26140856',
    name: 'Jimmy Chin',
    rawPurchaser: 'CHIN, Jimmy',
    tier: 'social',
    productName: '[10166870] Climbing/Mountaineering Social Membership',
    transactionId: '31624613',
    purchaseDate: 'Mon 21 Sep 2026 23:37',
  },
  {
    cardNumber: 'K25058734',
    name: 'Hazel Findlay',
    rawPurchaser: 'FINDLAY, Hazel',
    tier: 'social',
    productName: '[10166870] Climbing/Mountaineering Social Membership',
    transactionId: '31620366',
    purchaseDate: 'Mon 21 Sep 2026 14:58',
  },
  {
    cardNumber: 'K26140111',
    name: 'Adam Ondra',
    rawPurchaser: 'ONDRA, Adam',
    tier: 'social',
    productName: '[10166870] Climbing/Mountaineering Social Membership',
    transactionId: '31620176',
    purchaseDate: 'Mon 21 Sep 2026 14:43',
  },
  {
    cardNumber: 'K26083988',
    name: 'Beth Rodden',
    rawPurchaser: 'RODDEN, Beth',
    tier: 'social',
    productName: '[10166870] Climbing/Mountaineering Social Membership',
    transactionId: '31609375',
    purchaseDate: 'Sun 20 Sep 2026 16:07',
  },
  {
    cardNumber: 'K22047409',
    name: 'Nimsdai Purja',
    rawPurchaser: 'PURJA, Nimsdai',
    tier: 'social',
    productName: '[10166870] Climbing/Mountaineering Social Membership',
    transactionId: '31608073',
    purchaseDate: 'Sun 20 Sep 2026 12:25',
  },
  {
    cardNumber: 'K25101428',
    name: 'Janja Garnbret',
    rawPurchaser: 'GARNBRET, Janja',
    tier: 'social',
    productName: '[10166870] Climbing/Mountaineering Social Membership',
    transactionId: '31597733',
    purchaseDate: 'Thu 17 Sep 2026 23:29',
  },
  {
    cardNumber: 'K25005392',
    name: 'Chris Sharma',
    rawPurchaser: 'SHARMA, Chris',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31631791',
    purchaseDate: 'Wed 23 Sep 2026 21:14',
  },
  {
    cardNumber: 'K23021924',
    name: 'Junko Tabei',
    rawPurchaser: 'TABEI, Junko',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31631767',
    purchaseDate: 'Wed 23 Sep 2026 20:59',
  },
  {
    cardNumber: 'K26005807',
    name: 'Reinhold Messner',
    rawPurchaser: 'MESSNER, Reinhold',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31629878',
    purchaseDate: 'Wed 23 Sep 2026 14:24',
  },
  {
    cardNumber: 'K25054815',
    name: 'George Mallory',
    rawPurchaser: 'MALLORY, George',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31628828',
    purchaseDate: 'Wed 23 Sep 2026 08:54',
  },
  {
    cardNumber: 'K26016434',
    name: 'Conrad Anker',
    rawPurchaser: 'ANKER, Conrad',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31625065',
    purchaseDate: 'Tue 22 Sep 2026 07:26',
  },
  {
    cardNumber: 'K26066449',
    name: 'Sasha DiGiulian',
    rawPurchaser: 'DIGIULIAN, Sasha',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31624196',
    purchaseDate: 'Mon 21 Sep 2026 22:20',
  },
  {
    cardNumber: 'K25008223',
    name: 'Remy Preston',
    rawPurchaser: 'PRESTON, Remy',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31610582',
    purchaseDate: 'Sun 20 Sep 2026 18:53',
  },
  {
    cardNumber: 'K23158797',
    name: 'Catherine Destivelle',
    rawPurchaser: 'DESTIVELLE, Catherine',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31599217',
    purchaseDate: 'Fri 18 Sep 2026 13:30',
  },
  {
    cardNumber: 'K23004731',
    name: 'Margo Hayes',
    rawPurchaser: 'HAYES, Margo',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31592767',
    purchaseDate: 'Wed 16 Sep 2026 07:31',
  },
  {
    cardNumber: 'K25074252',
    name: 'Ashima Shiraishi',
    rawPurchaser: 'SHIRAISHI, Ashima',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31591811',
    purchaseDate: 'Tue 15 Sep 2026 18:52',
  },
  {
    cardNumber: 'K25004642',
    name: 'Shauna Coxsey',
    rawPurchaser: 'COXSEY, Shauna',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31591709',
    purchaseDate: 'Tue 15 Sep 2026 18:06',
  },
  {
    cardNumber: 'K26107823',
    name: 'Alex Puccio',
    rawPurchaser: 'PUCCIO, Alex',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31591212',
    purchaseDate: 'Tue 15 Sep 2026 15:50',
  },
  {
    cardNumber: 'K26033971',
    name: 'Stefano Ghisolfi',
    rawPurchaser: 'GHISOLFI, Stefano',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31591117',
    purchaseDate: 'Tue 15 Sep 2026 15:11',
  },
  {
    cardNumber: 'K23166535',
    name: 'Brooke Raboutou',
    rawPurchaser: 'RABOUTOU, Brooke',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31590394',
    purchaseDate: 'Tue 15 Sep 2026 12:43',
  },
  {
    cardNumber: 'K25005467',
    name: 'Jakob Schubert',
    rawPurchaser: 'SCHUBERT, Jakob',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31578818',
    purchaseDate: 'Fri 04 Sep 2026 19:21',
  },
  {
    cardNumber: 'K25082359',
    name: 'Mina Leslie-Wujastyk',
    rawPurchaser: 'LESLIE-WUJASTYK, Mina',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31574792',
    purchaseDate: 'Tue 01 Sep 2026 17:41',
  },
  {
    cardNumber: 'K26142908',
    name: 'Ueli Steck',
    rawPurchaser: 'STECK, Ueli',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31561092',
    purchaseDate: 'Wed 05 Aug 2026 06:01',
  },
];

export function findMemberByCardNumber(cardNumber: string): KclsuMemberRecord | undefined {
  if (!cardNumber) return undefined;
  const normalized = cardNumber.trim().toUpperCase();
  return INITIAL_KCLSU_ROSTER.find(
    m => m.cardNumber.toUpperCase() === normalized
  );
}

export function determineMemberTier(productName: string): 'recreational' | 'social' {
  const p = (productName || '').toLowerCase();

  // Explicit check for upgrade product ID or keywords:
  // e.g. [10188720] Climbing/Mountaineering Soc to Rec Membership Upgrade
  if (
    p.includes('10188720') ||
    p.includes('soc to rec') ||
    p.includes('social to rec') ||
    p.includes('social-recreational') ||
    p.includes('social recreational') ||
    p.includes('recreational') ||
    p.includes('upgrade') ||
    p.includes('top-up') ||
    p.includes('top up')
  ) {
    return 'recreational';
  }

  // Pure social membership
  if (p.includes('social') || p.includes('10166870')) {
    return 'social';
  }

  // Default fallback if contains rec
  if (p.includes('rec')) {
    return 'recreational';
  }

  return 'recreational';
}

export function parseKclsuCsv(csvText: string): KclsuMemberRecord[] {
  const lines = csvText.split('\n');
  const recordsMap = new Map<string, KclsuMemberRecord>();

  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('product_name') && lines[i].includes('card_number')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line handling quotes
    const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^",]*))/g;
    const cols: string[] = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      cols.push(match[1] ? match[1].replace(/""/g, '"') : match[2] || '');
    }

    if (cols.length >= 8) {
      const productName = sanitizeCsvCell(cols[0]);
      const transactionId = sanitizeCsvCell(cols[1]);
      const rawPurchaser = sanitizeCsvCell(cols[2]);
      const cardNumber = sanitizeCsvCell(cols[4]);
      const purchaseDate = sanitizeCsvCell(cols[7]);

      if (cardNumber && cardNumber.startsWith('K')) {
        const cleanCard = cardNumber.trim().toUpperCase();
        const tier = determineMemberTier(productName);
        const newRecord: KclsuMemberRecord = {
          cardNumber: cleanCard,
          name: formatPurchaserName(rawPurchaser),
          rawPurchaser,
          tier,
          productName,
          transactionId,
          purchaseDate,
        };

        const existing = recordsMap.get(cleanCard);
        if (!existing) {
          recordsMap.set(cleanCard, newRecord);
        } else {
          // Social-Recreational upgrade strictly overrides Social to Recreational
          const isRecreational = existing.tier === 'recreational' || tier === 'recreational';
          const preferredProduct = (tier === 'recreational' && existing.tier === 'social')
            ? productName
            : (existing.tier === 'recreational' ? existing.productName : productName);

          recordsMap.set(cleanCard, {
            ...existing,
            tier: isRecreational ? 'recreational' : 'social',
            productName: preferredProduct,
            transactionId: newRecord.transactionId || existing.transactionId,
            purchaseDate: newRecord.purchaseDate || existing.purchaseDate,
          });
        }
      }
    }
  }

  return Array.from(recordsMap.values());
}

export async function fetchMemberFromSupabase(
  cardNumber: string,
  supabaseClient: any
): Promise<KclsuMemberRecord | null> {
  if (!cardNumber || !supabaseClient) return null;
  const cleanId = cardNumber.trim().toUpperCase();

  try {
    const { data, error } = await supabaseClient
      .from('kclsu_roster')
      .select('*')
      .eq('card_number', cleanId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      cardNumber: data.card_number,
      name: data.full_name,
      rawPurchaser: data.raw_purchaser,
      tier: data.tier,
      productName: data.product_name,
      transactionId: data.transaction_id,
      purchaseDate: data.purchase_date || '',
    };
  } catch (err) {
    console.error('Error fetching member from Supabase:', err);
    return null;
  }
}

export async function upsertRosterToSupabase(
  records: KclsuMemberRecord[],
  supabaseClient: any
): Promise<{ count: number; error: any }> {
  if (!supabaseClient || !records.length) return { count: 0, error: 'No records or client' };

  try {
    // Defensively deduplicate by card_number using Social-to-Recreational upgrade rule
    const dedupeMap = new Map<string, KclsuMemberRecord>();
    for (const r of records) {
      const cleanCard = r.cardNumber.trim().toUpperCase();
      const existing = dedupeMap.get(cleanCard);
      if (!existing) {
        dedupeMap.set(cleanCard, r);
      } else {
        const isRecreational = existing.tier === 'recreational' || r.tier === 'recreational';
        const preferredProduct = (r.tier === 'recreational' && existing.tier === 'social')
          ? r.productName
          : (existing.tier === 'recreational' ? existing.productName : r.productName);

        dedupeMap.set(cleanCard, {
          ...existing,
          tier: isRecreational ? 'recreational' : 'social',
          productName: preferredProduct,
          transactionId: r.transactionId || existing.transactionId,
          purchaseDate: r.purchaseDate || existing.purchaseDate,
        });
      }
    }

    const uniqueRecords = Array.from(dedupeMap.values());

    // Layer 2: ETL Survivor Rule to protect manually curated or complete names from CSV overwrite
    const cardList = uniqueRecords.map(r => r.cardNumber);
    const { data: existingDbRows } = await supabaseClient
      .from('kclsu_roster')
      .select('card_number, full_name, raw_purchaser')
      .in('card_number', cardList);

    const existingMap = new Map<string, { full_name: string; raw_purchaser: string }>();
    if (Array.isArray(existingDbRows)) {
      existingDbRows.forEach((row: any) => {
        if (row?.card_number) {
          existingMap.set(row.card_number.toUpperCase(), row);
        }
      });
    }

    const inserts = uniqueRecords.map(r => {
      const existing = existingMap.get(r.cardNumber);
      let resolvedName = r.name;

      if (existing && existing.full_name) {
        const existingName = existing.full_name.trim();
        const incomingName = (r.name || '').trim();

        const existingHasFull = isCompleteFullName(existingName);
        const incomingIsSingleOrMissing = !isCompleteFullName(incomingName);
        const wasManuallyEdited = existingName !== formatPurchaserName(existing.raw_purchaser);

        // Survivor Rule: Retain existing DB name if it has complete First+Last while incoming is single-word/incomplete,
        // or if an admin previously manually edited the name in the database.
        if ((existingHasFull && incomingIsSingleOrMissing) || wasManuallyEdited) {
          resolvedName = existingName;
        }
      }

      return {
        card_number: r.cardNumber,
        full_name: resolvedName,
        raw_purchaser: r.rawPurchaser,
        tier: r.tier,
        product_name: r.productName,
        transaction_id: r.transactionId,
        purchase_date: r.purchaseDate,
        academic_year: '2026/27',
        updated_at: new Date().toISOString(),
      };
    });

    const { data, error } = await supabaseClient
      .from('kclsu_roster')
      .upsert(inserts, { onConflict: 'card_number' })
      .select();

    if (error) {
      console.error('Supabase roster upsert error:', error);
      return { count: 0, error };
    }

    return { count: data?.length || inserts.length, error: null };
  } catch (err: any) {
    console.error('Unexpected error upserting roster:', err);
    return { count: 0, error: err.message };
  }
}

