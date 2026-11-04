import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/server';
import {
  parseLedgerCsv,
  runLiquiditySimulation,
  UpcomingCommitment,
  TreasuryBalanceSummary,
} from '@/lib/quant';
import * as fs from 'fs';
import * as path from 'path';

export const runtime = 'nodejs';

// Cached ledger summary in memory
let cachedLedgerSummary: TreasuryBalanceSummary | null = null;
let cachedLedgerTransactions: any[] | null = null;

function getLedgerData() {
  if (cachedLedgerSummary) {
    return { summary: cachedLedgerSummary, transactions: cachedLedgerTransactions || [] };
  }

  try {
    const csvPath = path.join(process.cwd(), 'backups', 'ClimbingMountaineering.csv');
    if (fs.existsSync(csvPath)) {
      const content = fs.readFileSync(csvPath, 'utf-8');
      const parsed = parseLedgerCsv(content);
      cachedLedgerSummary = parsed.summary;
      cachedLedgerTransactions = parsed.transactions;
      return parsed;
    }
  } catch (err) {
    console.warn('[QuantAPI] Failed to read ClimbingMountaineering.csv, using default balances:', err);
  }

  // Fallback defaults matching confirmed KCLSU ledger
  const fallbackSummary: TreasuryBalanceSummary = {
    totalCash: 13497.40,
    restrictedCash: 1478.67,
    unrestrictedCash: 12018.73,
    balanceBroughtForward: 6608.32,
    totalInflows: 8935.00,
    totalOutflows: 2045.92,
    netSurplus: 6889.08,
    expensesByCategory: {
      TRIP_ACCOMMODATION: 1711.27,
      TRIP_TRAVEL_LOGISTICS: 101.29,
      EQUIPMENT_GEAR: 160.48,
      TEAM_COACHING: 56.00,
      WALL_SUBSIDIES: 16.88,
      BMC_INSURANCE: 0,
      PROFESSIONAL_GUIDING: 0,
      MERCHANDISE_FLOAT: 0,
      GENERAL_OPERATIONS: 0,
    },
  };
  return { summary: fallbackSummary, transactions: [] };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    // Committee clearance (role >= 1) or SuperAdmin (role >= 2)
    if (!user || user.role < 1) {
      return NextResponse.json(
        { error: 'Unauthorized: Committee clearance required for Treasury Quant Engine' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const bmcSignedCount = parseInt(searchParams.get('bmcSignedCount') || '50', 10);
    const bmcRatePerMember = parseFloat(searchParams.get('bmcRatePerMember') || '26');
    const totalRecMembers = parseInt(searchParams.get('totalRecMembers') || '100', 10);

    const bmcBatch1 = bmcSignedCount * bmcRatePerMember; // £1,300 for 50 signed
    const bmcBatch2 = Math.max(0, (totalRecMembers - bmcSignedCount) * bmcRatePerMember); // £1,300 deferred float

    const gearAmount = parseFloat(searchParams.get('gearAmount') || '2750');
    const alpsGuideAmount = parseFloat(searchParams.get('alpsGuideAmount') || '2500');
    const springGuideAmount = parseFloat(searchParams.get('springGuideAmount') || '1250');
    const merchFloat = parseFloat(searchParams.get('merchFloat') || '1500');
    const tripDeposit = parseFloat(searchParams.get('tripDeposit') || '1200');
    const reserveFloor = parseFloat(searchParams.get('reserveFloor') || '1000');
    const applyGrantOffset = searchParams.get('applyGrantOffset') !== 'false';

    const { summary, transactions } = getLedgerData();

    const commitments: UpcomingCommitment[] = [
      {
        id: 'bmc-insurance-batch-1',
        name: `BMC Liability Insurance Batch 1 (${bmcSignedCount} Signed Forms @ £${bmcRatePerMember})`,
        category: 'BMC_INSURANCE',
        amount: bmcBatch1,
        dueDay: 10,
        isFlexible: false,
        isGrantOffsettable: false,
      },
      {
        id: 'safety-gear-restock',
        name: 'Club Safety & Gear Depot Restock (£2.5k - £3k)',
        category: 'EQUIPMENT_GEAR',
        amount: gearAmount,
        dueDay: 20,
        isFlexible: true,
        isGrantOffsettable: true,
      },
      {
        id: 'reallocated-spring-guide',
        name: 'Spring Skills & Trad Guiding (Reallocated ex-Scotland)',
        category: 'PROFESSIONAL_GUIDING',
        amount: springGuideAmount,
        dueDay: 35,
        isFlexible: true,
        isGrantOffsettable: true,
      },
      {
        id: 'bmc-insurance-batch-2',
        name: `BMC Liability Insurance Batch 2 (${totalRecMembers - bmcSignedCount} Deferred Forms @ £${bmcRatePerMember})`,
        category: 'BMC_INSURANCE',
        amount: bmcBatch2,
        dueDay: 40,
        isFlexible: true,
        isGrantOffsettable: false,
      },
      {
        id: 'term2-merch-float',
        name: 'Term 2 Apparel MOQ Production Float',
        category: 'MERCHANDISE_FLOAT',
        amount: merchFloat,
        dueDay: 45,
        isFlexible: true,
        isGrantOffsettable: false,
      },
      {
        id: 'term2-trip-deposit',
        name: 'Term 2 Mountaineering Meet Coach Deposit',
        category: 'TRIP_TRAVEL_LOGISTICS',
        amount: tripDeposit,
        dueDay: 60,
        isFlexible: true,
        isGrantOffsettable: false,
      },
      {
        id: 'summer-alps-guide',
        name: 'Summer Alps Mountain Guide Deposit',
        category: 'PROFESSIONAL_GUIDING',
        amount: alpsGuideAmount,
        dueDay: 75,
        isFlexible: true,
        isGrantOffsettable: true,
      },
    ];

    const simulation = runLiquiditySimulation(
      summary.totalCash,
      summary.unrestrictedCash,
      {
        horizonDays: 90,
        nPaths: 10000,
        reserveFloor,
        commitments,
        applyGrantOffset,
      }
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      treasurySummary: summary,
      commitments,
      grantOffsetApplied: applyGrantOffset ? 1200.0 : 0.0,
      simulation,
      recentExpenses: transactions.filter(t => t.cashOut > 0).slice(0, 10),
    });
  } catch (err: any) {
    console.error('[QuantAPI] Error executing treasury simulation:', err);
    return NextResponse.json(
      { error: 'Failed to execute treasury liquidity simulation', details: err?.message },
      { status: 500 }
    );
  }
}
