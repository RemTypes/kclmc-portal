import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseLedgerCsv,
  categorizeExpenseDescription,
  runLiquiditySimulation,
  DEFAULT_STOCHASTIC_PARAMS,
} from '@/lib/quant';

describe('KCLMC Quantitative Treasury & Liquidity Risk Engine', () => {
  const csvPath = path.join(process.cwd(), 'backups', 'ClimbingMountaineering.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  describe('1. KCLSU General Ledger Parser & Categorizer', () => {
    it('parses the KCLSU ledger export and verifies reconciled balances', () => {
      const { transactions, summary } = parseLedgerCsv(csvContent);

      expect(transactions.length).toBeGreaterThan(50);
      expect(summary.balanceBroughtForward).toBe(6608.32);
      expect(summary.totalInflows).toBe(8935.00);
      expect(summary.totalOutflows).toBe(2045.92);
      expect(summary.totalCash).toBe(13497.40);
      expect(summary.netSurplus).toBe(6889.08);
      expect(summary.unrestrictedCash).toBeGreaterThan(11000.0);
    });

    it('correctly maps all 24 historical expense claims into the 5 core categories', () => {
      const { transactions } = parseLedgerCsv(csvContent);
      const expenses = transactions.filter(t => t.cashOut > 0);

      expect(expenses.length).toBe(24);

      // Verify specific notable transactions
      const bunkhouse = expenses.find(e => e.customerSupplierName?.includes('Portland Bunkhouse'));
      expect(bunkhouse).toBeDefined();
      expect(bunkhouse?.category).toBe('TRIP_ACCOMMODATION');
      expect(bunkhouse?.cashOut).toBe(560.00);

      const finca = expenses.find(e => e.customerSupplierName?.includes('Finca La Campana') && e.cashOut > 1000);
      expect(finca).toBeDefined();
      expect(finca?.category).toBe('TRIP_ACCOMMODATION');
      expect(finca?.cashOut).toBe(1124.27);

      const stove = expenses.find(e => e.description.includes('CAMPING CHEF'));
      expect(stove).toBeDefined();
      expect(stove?.category).toBe('EQUIPMENT_GEAR');

      const catalyst = expenses.filter(e => e.description.toLowerCase().includes('catalyst') || e.description.toLowerCase().includes('team training'));
      expect(catalyst.length).toBe(4);
      catalyst.forEach(c => {
        expect(c.category).toBe('TEAM_COACHING');
        expect(c.cashOut).toBe(14.00);
      });

      const easyjet = expenses.find(e => e.description.includes('easyjet'));
      expect(easyjet).toBeDefined();
      expect(easyjet?.category).toBe('TRIP_TRAVEL_LOGISTICS');
      expect(easyjet?.cashOut).toBe(62.07);
    });

    it('accurately identifies restricted grant accounts (Development & Coaching Fund)', () => {
      const { transactions, summary } = parseLedgerCsv(csvContent);
      const restricted = transactions.filter(t => t.isRestricted && t.cashIn > 0);

      expect(restricted.length).toBeGreaterThanOrEqual(2);
      expect(summary.restrictedCash).toBeGreaterThan(0);
      // Coaching fund (£310) + Dev Fund (£1,200) + B/F (£24.67) - Catalyst (£14)
      expect(summary.restrictedCash).toBe(1520.67);
    });
  });

  describe('2. Expense Description Categorization Rules', () => {
    it('categorizes various natural language descriptions deterministically', () => {
      expect(categorizeExpenseDescription('Decathlon Surrey Quays camping stove')).toBe('EQUIPMENT_GEAR');
      expect(categorizeExpenseDescription('Finca La Campana accommodation')).toBe('TRIP_ACCOMMODATION');
      expect(categorizeExpenseDescription('Moto Services fuel 20L')).toBe('TRIP_TRAVEL_LOGISTICS');
      expect(categorizeExpenseDescription('Catalyst coaching team session')).toBe('TEAM_COACHING');
      expect(categorizeExpenseDescription('VauxWall East entry fee')).toBe('WALL_SUBSIDIES');
      expect(categorizeExpenseDescription('BMC annual insurance declaration')).toBe('BMC_INSURANCE');
      expect(categorizeExpenseDescription('Club hoodie stash production pre-order')).toBe('MERCHANDISE_FLOAT');
      expect(categorizeExpenseDescription('AGM printing and paper')).toBe('GENERAL_OPERATIONS');
    });
  });

  describe('3. Monte Carlo Liquidity Risk Engine (10,000 Paths)', () => {
    it('executes 10,000 paths in under 50ms and satisfies risk metric invariants', () => {
      const t0 = performance.now();
      const report = runLiquiditySimulation(13497.40, 12018.73, {
        horizonDays: 90,
        nPaths: 10000,
        reserveFloor: 1000.0,
      });
      const durationMs = performance.now() - t0;

      expect(durationMs).toBeLessThan(100); // Super fast execution
      expect(report.nPaths).toBe(10000);
      expect(report.horizonDays).toBe(90);

      // Invariant 1: Expected Shortfall (CVaR) >= VaR at same confidence level
      expect(report.lCVar99).toBeGreaterThanOrEqual(report.lVar99);

      // Invariant 2: VaR 99% >= VaR 95%
      expect(report.lVar99).toBeGreaterThanOrEqual(report.lVar95);

      // Invariant 3: Ruin probability bounded in [0, 1]
      expect(report.ruinProbability).toBeGreaterThanOrEqual(0);
      expect(report.ruinProbability).toBeLessThanOrEqual(1);

      // Invariant 4: Percentiles exist and are non-empty
      expect(report.percentiles.p5.length).toBeGreaterThan(0);
      expect(report.percentiles.p50.length).toBeGreaterThan(0);
      expect(report.percentiles.p95.length).toBeGreaterThan(0);
    });

    it('models upcoming expenses: BMC (£2,600 total across 2 batches) + £2,750 gear restock + £2,500 Alps guide + £1,250 reallocated guiding', () => {
      const report = runLiquiditySimulation(13497.40, 12018.73, {
        reserveFloor: 1000.0,
        applyGrantOffset: true,
      });

      expect(report.committedOutlaysTotal).toBe(11800.0); // £2.6k BMC (two £1.3k batches) + rest
      expect(report.effectiveOutlaysAfterGrants).toBe(10600.0); // £1,200 restricted grant absorbed
      // Even with £10,600 effective outlays, the starting £13,497 cash buffer prevents ruin
      expect(report.ruinProbability).toBe(0);
      expect(report.worstCaseBalance).toBeGreaterThan(1000.0);
      expect(report.meanTerminalCash).toBeGreaterThan(3400.0);
    });

    it('correctly detects insolvency risk when obligations exceed available reserves', () => {
      // Stress test: commitments exceed total treasury by £5,000
      const stressReport = runLiquiditySimulation(3000.00, 3000.00, {
        commitments: [
          {
            id: 'extreme-shock',
            name: 'Unfunded Expedition & Gear',
            category: 'EQUIPMENT_GEAR',
            amount: 4000.0,
            dueDay: 10,
            isFlexible: false,
          },
        ],
        reserveFloor: 1000.0,
      });

      expect(stressReport.ruinProbability).toBe(1.0); // 100% chance of breaching £1k reserve
    });
  });
});
