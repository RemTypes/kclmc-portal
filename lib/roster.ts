export interface KclsuMemberRecord {
  cardNumber: string; // KCL ID e.g. K25008223
  name: string;       // Formatted name e.g. "Remy Preston"
  rawPurchaser: string;
  tier: 'recreational' | 'social';
  productName: string;
  transactionId: string;
  purchaseDate: string;
}

export function formatPurchaserName(raw: string): string {
  if (!raw) return '';
  // Handle formats like "BALTENSPERGER, David", "PRESTON, Remy", "D/O GULWANT SINGH, Hasvinjit"
  const clean = raw.replace(/^"|"$/g, '').trim();
  if (clean.includes(',')) {
    const [last, first] = clean.split(',').map(s => s.trim());
    if (first && last) {
      // Capitalize first letters nicely if in ALL CAPS
      const formatPart = (str: string) =>
        str
          .toLowerCase()
          .split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');

      return `${formatPart(first)} ${formatPart(last)}`;
    }
  }
  return clean;
}

export const INITIAL_KCLSU_ROSTER: KclsuMemberRecord[] = [
  {
    cardNumber: 'K26122068',
    name: 'David Baltensperger',
    rawPurchaser: 'BALTENSPERGER, David',
    tier: 'social',
    productName: '[10166870] Climbing/Mountaineering Social Membership',
    transactionId: '31631002',
    purchaseDate: 'Wed 23 Sep 2026 17:55',
  },
  {
    cardNumber: 'K26019642',
    name: 'Olivia Rochester-Hines',
    rawPurchaser: 'Rochester-Hines, Olivia',
    tier: 'social',
    productName: '[10166870] Climbing/Mountaineering Social Membership',
    transactionId: '31630684',
    purchaseDate: 'Wed 23 Sep 2026 16:40',
  },
  {
    cardNumber: 'K26010174',
    name: 'Alexander Lippi',
    rawPurchaser: 'LIPPI, Alexander',
    tier: 'social',
    productName: '[10166870] Climbing/Mountaineering Social Membership',
    transactionId: '31628197',
    purchaseDate: 'Tue 22 Sep 2026 22:36',
  },
  {
    cardNumber: 'K26140856',
    name: 'Sujay Suresh',
    rawPurchaser: 'Suresh, Sujay',
    tier: 'social',
    productName: '[10166870] Climbing/Mountaineering Social Membership',
    transactionId: '31624613',
    purchaseDate: 'Mon 21 Sep 2026 23:37',
  },
  {
    cardNumber: 'K25058734',
    name: 'John Lavadia',
    rawPurchaser: 'LAVADIA, John',
    tier: 'social',
    productName: '[10166870] Climbing/Mountaineering Social Membership',
    transactionId: '31620366',
    purchaseDate: 'Mon 21 Sep 2026 14:58',
  },
  {
    cardNumber: 'K26140111',
    name: 'Ian Salihu',
    rawPurchaser: 'Salihu, Ian',
    tier: 'social',
    productName: '[10166870] Climbing/Mountaineering Social Membership',
    transactionId: '31620176',
    purchaseDate: 'Mon 21 Sep 2026 14:43',
  },
  {
    cardNumber: 'K26083988',
    name: 'Beth Vivian',
    rawPurchaser: 'Vivian, Beth',
    tier: 'social',
    productName: '[10166870] Climbing/Mountaineering Social Membership',
    transactionId: '31609375',
    purchaseDate: 'Sun 20 Sep 2026 16:07',
  },
  {
    cardNumber: 'K22047409',
    name: 'Isaac Toh Si Boon',
    rawPurchaser: 'Toh Si Boon, Isaac',
    tier: 'social',
    productName: '[10166870] Climbing/Mountaineering Social Membership',
    transactionId: '31608073',
    purchaseDate: 'Sun 20 Sep 2026 12:25',
  },
  {
    cardNumber: 'K25101428',
    name: 'Souw Neo',
    rawPurchaser: 'NEO, Souw',
    tier: 'social',
    productName: '[10166870] Climbing/Mountaineering Social Membership',
    transactionId: '31597733',
    purchaseDate: 'Thu 17 Sep 2026 23:29',
  },
  {
    cardNumber: 'K25005392',
    name: 'Zekai Lin',
    rawPurchaser: 'LIN, Zekai',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31631791',
    purchaseDate: 'Wed 23 Sep 2026 21:14',
  },
  {
    cardNumber: 'K23021924',
    name: 'Nuha Mohamed',
    rawPurchaser: 'Mohamed, Nuha',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31631767',
    purchaseDate: 'Wed 23 Sep 2026 20:59',
  },
  {
    cardNumber: 'K26005807',
    name: 'Lorenzo Mulhare',
    rawPurchaser: 'MULHARE, Lorenzo',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31629878',
    purchaseDate: 'Wed 23 Sep 2026 14:24',
  },
  {
    cardNumber: 'K25054815',
    name: 'Harry Allen',
    rawPurchaser: 'ALLEN, Harry',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31628828',
    purchaseDate: 'Wed 23 Sep 2026 08:54',
  },
  {
    cardNumber: 'K26016434',
    name: 'Joon Choi',
    rawPurchaser: 'Choi, Joon',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31625065',
    purchaseDate: 'Tue 22 Sep 2026 07:26',
  },
  {
    cardNumber: 'K26066449',
    name: 'Haofang Xu',
    rawPurchaser: 'XU, HAOFANG',
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
    name: 'Alice Richardson',
    rawPurchaser: 'RICHARDSON, Alice',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31599217',
    purchaseDate: 'Fri 18 Sep 2026 13:30',
  },
  {
    cardNumber: 'K23004731',
    name: 'Megan Ho',
    rawPurchaser: 'HO, Megan',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31592767',
    purchaseDate: 'Wed 16 Sep 2026 07:31',
  },
  {
    cardNumber: 'K25074252',
    name: 'Eden Steen',
    rawPurchaser: 'STEEN, Eden',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31591811',
    purchaseDate: 'Tue 15 Sep 2026 18:52',
  },
  {
    cardNumber: 'K25004642',
    name: 'Arthur Dean',
    rawPurchaser: 'Dean, Arthur',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31591709',
    purchaseDate: 'Tue 15 Sep 2026 18:06',
  },
  {
    cardNumber: 'K26107823',
    name: 'Xue',
    rawPurchaser: 'XUE, -',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31591212',
    purchaseDate: 'Tue 15 Sep 2026 15:50',
  },
  {
    cardNumber: 'K26033971',
    name: 'Ethan Kellett',
    rawPurchaser: 'KELLETT, Ethan',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31591117',
    purchaseDate: 'Tue 15 Sep 2026 15:11',
  },
  {
    cardNumber: 'K23166535',
    name: 'Jennifer Johnston',
    rawPurchaser: 'JOHNSTON, Jennifer',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31590394',
    purchaseDate: 'Tue 15 Sep 2026 12:43',
  },
  {
    cardNumber: 'K25005467',
    name: 'Andrew Berresford',
    rawPurchaser: 'BERRESFORD, Andrew',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31578818',
    purchaseDate: 'Fri 04 Sep 2026 19:21',
  },
  {
    cardNumber: 'K25082359',
    name: 'Funmi Osoteku',
    rawPurchaser: 'OSOTEKU, Funmi',
    tier: 'recreational',
    productName: '[10002480] Climbing/Mountaineering Recreational Membership',
    transactionId: '31574792',
    purchaseDate: 'Tue 01 Sep 2026 17:41',
  },
  {
    cardNumber: 'K26142908',
    name: 'Hasvinjit D/O Gulwant Singh',
    rawPurchaser: 'D/O GULWANT SINGH, Hasvinjit',
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

export function parseKclsuCsv(csvText: string): KclsuMemberRecord[] {
  const lines = csvText.split('\n');
  const records: KclsuMemberRecord[] = [];

  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('product_name') && lines[i].includes('card_number')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return records;

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
      const productName = cols[0];
      const transactionId = cols[1];
      const rawPurchaser = cols[2];
      const cardNumber = cols[4];
      const purchaseDate = cols[7];

      if (cardNumber && cardNumber.startsWith('K')) {
        const isSocial = productName.toLowerCase().includes('social');
        records.push({
          cardNumber: cardNumber.trim().toUpperCase(),
          name: formatPurchaserName(rawPurchaser),
          rawPurchaser,
          tier: isSocial ? 'social' : 'recreational',
          productName,
          transactionId,
          purchaseDate,
        });
      }
    }
  }

  return records;
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
    const inserts = records.map(r => ({
      card_number: r.cardNumber,
      full_name: r.name,
      raw_purchaser: r.rawPurchaser,
      tier: r.tier,
      product_name: r.productName,
      transaction_id: r.transactionId,
      purchase_date: r.purchaseDate,
      academic_year: '2026/27',
      updated_at: new Date().toISOString(),
    }));

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

