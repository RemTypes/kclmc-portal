/**
 * KCLMC Platform - Quantitative Treasury & Liquidity Risk Types
 * 
 * Formal type definitions for the society's treasury cash-flow modeling,
 * general ledger ingestion, econometric parameters, and Monte Carlo risk engine.
 */

export type ExpenseCategory =
  | 'TRIP_ACCOMMODATION'
  | 'TRIP_TRAVEL_LOGISTICS'
  | 'EQUIPMENT_GEAR'
  | 'TEAM_COACHING'
  | 'WALL_SUBSIDIES'
  | 'BMC_INSURANCE'
  | 'PROFESSIONAL_GUIDING'
  | 'MERCHANDISE_FLOAT'
  | 'GENERAL_OPERATIONS';

export interface LedgerTransaction {
  date: string;
  documentType: string;
  documentNo: string;
  expenseNo?: string;
  customerSupplierCode?: string;
  customerSupplierName?: string;
  glAccountNo: string;
  glAccountName: string;
  description: string;
  cashIn: number;
  cashOut: number;
  category?: ExpenseCategory;
  isRestricted: boolean;
}

export interface TreasuryBalanceSummary {
  /** Total cash currently sitting in KCLSU account */
  totalCash: number;
  /** Restricted / Ring-fenced grant funds (e.g. Development Fund, Coaching Fund) */
  restrictedCash: number;
  /** Free unencumbered private cash available for society operations */
  unrestrictedCash: number;
  /** Opening balance brought forward at start of academic year */
  balanceBroughtForward: number;
  /** Cumulative new revenue & grants received */
  totalInflows: number;
  /** Cumulative expenses paid out to date */
  totalOutflows: number;
  /** Net operational surplus / deficit to date */
  netSurplus: number;
  /** Outflows aggregated by expense category */
  expensesByCategory: Record<ExpenseCategory, number>;
}

export interface UpcomingCommitment {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  dueDay: number; // Day offset in simulation horizon (e.g. day 15)
  isFlexible: boolean; // Can this outlay be deferred if liquidity breaches floor?
  isGrantOffsettable?: boolean; // Can this be drawn from restricted grants (e.g. Development Fund)?
}

export interface StochasticParameters {
  /** Negative Binomial dispersion parameter r */
  negBinR: number;
  /** Negative Binomial success probability p */
  negBinP: number;
  /** Baseline arrival intensity (mean transactions per day in Term 1) */
  meanDailyArrivals: number;
  /** Fisher Dispersion Index (Var / Mean) proving overdispersion */
  dispersionIndex: number;
  /** Probability of arrival choosing Recreational (£35) vs Social (£10) */
  recreationalProbability: number;
  /** Inflow decay attenuation factor for Term 2 vs Freshers rush */
  term2Attenuation: number;
  /** Daily probability of random jump emergency expense */
  emergencyShockRate: number;
  /** Mean size of emergency shock in GBP */
  emergencyShockMean: number;
}

export interface LiquiditySimulationConfig {
  horizonDays: number;
  nPaths: number;
  reserveFloor: number;
  commitments: UpcomingCommitment[];
  applyGrantOffset: boolean;
  seed?: number;
}

export interface LiquidityRiskReport {
  initialTotalCash: number;
  initialUnrestrictedCash: number;
  committedOutlaysTotal: number;
  effectiveOutlaysAfterGrants: number;
  horizonDays: number;
  nPaths: number;
  reserveFloor: number;
  /** Liquidity Value-at-Risk at 95% confidence level */
  lVar95: number;
  /** Liquidity Value-at-Risk at 99% confidence level */
  lVar99: number;
  /** Liquidity Conditional Value-at-Risk (Expected Shortfall at 99%) */
  lCVar99: number;
  /** Empirical probability of breaching the designated capital reserve floor */
  ruinProbability: number;
  /** Expected terminal cash balance at end of horizon */
  meanTerminalCash: number;
  /** Median terminal cash balance */
  medianTerminalCash: number;
  /** Worst simulated balance observed across all 10,000 paths */
  worstCaseBalance: number;
  /** Recommended minimum capital buffer to ensure <1% insolvency risk */
  recommendedBuffer: number;
  /** Percentile cash trajectory series across the time horizon */
  percentiles: {
    p5: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p95: number[];
  };
}
