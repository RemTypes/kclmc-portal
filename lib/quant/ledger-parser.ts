/**
 * KCLMC Platform - KCLSU General Ledger Parser & Categorizer
 * 
 * Ingests and categorizes raw KCLSU transaction records (ClimbingMountaineering.csv),
 * computing reconciled balances, restricted grant accounts, and historical burn rates.
 */

import { LedgerTransaction, TreasuryBalanceSummary, ExpenseCategory } from './types';

export function categorizeExpenseDescription(
  desc: string,
  supplier: string = '',
  glAccountNo: string = ''
): ExpenseCategory {
  const d = desc.toLowerCase();
  const s = supplier.toLowerCase();

  // 1. Accommodation
  if (
    d.includes('bunkhouse') ||
    d.includes('accommodation') ||
    d.includes('finca') ||
    s.includes('bunkhouse') ||
    s.includes('finca')
  ) {
    return 'TRIP_ACCOMMODATION';
  }

  // 2. Team Training & Coaching (check before travel so "coaching" is not matched as "coach")
  if (
    d.includes('catalyst') ||
    d.includes('coaching') ||
    d.includes('team training') ||
    glAccountNo.includes('51030') || // Coaching Fund GL
    glAccountNo.includes('65050')    // Restricted training expense GL
  ) {
    return 'TEAM_COACHING';
  }

  // 3. Travel & Transport Logistics
  if (
    d.includes('easyjet') ||
    d.includes('bag') ||
    d.includes('unleaded') ||
    d.includes('moto services') ||
    d.includes('service s ge') ||
    d.includes('fuel') ||
    d.includes('petrol') ||
    d.includes('coach hire') ||
    d.includes('coach charter') ||
    /\bcoach\b/.test(d)
  ) {
    return 'TRIP_TRAVEL_LOGISTICS';
  }

  // 4. Equipment & Camp Gear
  if (
    d.includes('stove') ||
    d.includes('gas canister') ||
    d.includes('adapter') ||
    d.includes('decathlan') ||
    d.includes('decathlon') ||
    d.includes('hathersage') ||
    d.includes('rope') ||
    d.includes('gear')
  ) {
    return 'EQUIPMENT_GEAR';
  }

  // 5. Wall Subsidies & Taster Session Entry
  if (
    d.includes('vauxwall') ||
    d.includes('vaux east') ||
    d.includes('lakeland') ||
    d.includes('entry') ||
    d.includes('portion of entry')
  ) {
    return 'WALL_SUBSIDIES';
  }

  // 6. BMC Insurance
  if (d.includes('bmc') || d.includes('insurance')) {
    return 'BMC_INSURANCE';
  }

  // 7. Professional Mountain Guides & Instruction
  if (d.includes('guide') || d.includes('guiding') || d.includes('alps guide') || d.includes('winter guide')) {
    return 'PROFESSIONAL_GUIDING';
  }

  // 8. Merch Float
  if (d.includes('merch') || d.includes('apparel') || d.includes('stash') || d.includes('hoodie')) {
    return 'MERCHANDISE_FLOAT';
  }

  return 'GENERAL_OPERATIONS';
}

export function parseLedgerCsv(csvContent: string): {
  transactions: LedgerTransaction[];
  summary: TreasuryBalanceSummary;
} {
  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('CSV content must contain at least a header and one data row.');
  }

  const transactions: LedgerTransaction[] = [];
  const expensesByCategory: Record<ExpenseCategory, number> = {
    TRIP_ACCOMMODATION: 0,
    TRIP_TRAVEL_LOGISTICS: 0,
    EQUIPMENT_GEAR: 0,
    TEAM_COACHING: 0,
    WALL_SUBSIDIES: 0,
    BMC_INSURANCE: 0,
    PROFESSIONAL_GUIDING: 0,
    MERCHANDISE_FLOAT: 0,
    GENERAL_OPERATIONS: 0,
  };

  let balanceBroughtForward = 0;
  let totalInflows = 0;
  let totalOutflows = 0;
  let restrictedInflows = 0;
  let restrictedOutflows = 0;

  // Simple CSV line parser handling quoted cells with commas
  function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let insideQuotes = false;
    let current = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length < 14) continue;

    const [
      _group,
      date,
      documentType,
      documentNo,
      expenseNo,
      _subGroupCode,
      customerSupplierCode,
      customerSupplierName,
      _itemNo,
      glAccountNo,
      glAccountName,
      description,
      rawCashIn,
      rawCashOut,
    ] = row;

    const cashIn = parseFloat(rawCashIn) || 0;
    const cashOut = parseFloat(rawCashOut) || 0;

    // Check for Brought Forward row (01/08/2026 SAG B/F)
    const isBfwd =
      documentNo.includes('SAG B/F') ||
      description.toLowerCase().includes('brought forward') ||
      glAccountNo.includes('54090') ||
      glAccountNo.includes('54091');

    // Restricted accounts: Development Fund, Coaching Fund, Restricted B/F
    const isRestricted =
      glAccountNo.includes('54091') ||
      glAccountNo.includes('65050') ||
      description.toLowerCase().includes('restricted') ||
      description.toLowerCase().includes('development fund') ||
      description.toLowerCase().includes('coaching and instructors fund');

    if (isBfwd && cashIn > 0) {
      balanceBroughtForward += cashIn;
      if (isRestricted) {
        restrictedInflows += cashIn;
      }
    } else {
      if (cashIn > 0) {
        totalInflows += cashIn;
        if (isRestricted) {
          restrictedInflows += cashIn;
        }
      }
    }

    let category: ExpenseCategory | undefined = undefined;
    if (cashOut > 0) {
      category = categorizeExpenseDescription(description, customerSupplierName, glAccountNo);
      expensesByCategory[category] += cashOut;
      totalOutflows += cashOut;
      if (isRestricted) {
        restrictedOutflows += cashOut;
      }
    }

    transactions.push({
      date,
      documentType,
      documentNo,
      expenseNo,
      customerSupplierCode,
      customerSupplierName,
      glAccountNo,
      glAccountName,
      description,
      cashIn,
      cashOut,
      category,
      isRestricted,
    });
  }

  const totalCash = balanceBroughtForward + totalInflows - totalOutflows;
  const restrictedCash = Math.max(0, restrictedInflows - restrictedOutflows);
  const unrestrictedCash = Math.max(0, totalCash - restrictedCash);
  const netSurplus = totalInflows - totalOutflows;

  // Round all currency metrics to 2 decimal places
  const summary: TreasuryBalanceSummary = {
    totalCash: Math.round(totalCash * 100) / 100,
    restrictedCash: Math.round(restrictedCash * 100) / 100,
    unrestrictedCash: Math.round(unrestrictedCash * 100) / 100,
    balanceBroughtForward: Math.round(balanceBroughtForward * 100) / 100,
    totalInflows: Math.round(totalInflows * 100) / 100,
    totalOutflows: Math.round(totalOutflows * 100) / 100,
    netSurplus: Math.round(netSurplus * 100) / 100,
    expensesByCategory: Object.fromEntries(
      Object.entries(expensesByCategory).map(([k, v]) => [k, Math.round(v * 100) / 100])
    ) as Record<ExpenseCategory, number>,
  };

  return { transactions, summary };
}
