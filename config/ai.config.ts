/**
 * KCLMC Platform - AI & Machine Learning Spending Cap & Safety Guard
 * Protects society finances against runaway API costs, runaway loops, or excessive compute bills.
 */

export interface AiSpendingConfig {
  /** Hard cap on monthly AI spend in USD */
  monthlyCapUsd: number;
  /** Hard cap on daily AI spend in USD */
  dailyCapUsd: number;
  /** Maximum allowed input+output tokens per single inference request */
  maxTokensPerRequest: number;
  /** Emergency killswitch: halts all AI/ML inference across the platform immediately */
  emergencyKillswitch: boolean;
  /** Alert threshold percentage (e.g. 0.80 = send committee alert at 80% of budget) */
  alertThreshold: number;
}

export const aiSpendingConfig: AiSpendingConfig = {
  monthlyCapUsd: parseFloat(process.env.AI_MONTHLY_SPENDING_CAP_USD || '10.00'),
  dailyCapUsd: parseFloat(process.env.AI_DAILY_SPENDING_CAP_USD || '1.00'),
  maxTokensPerRequest: parseInt(process.env.AI_MAX_TOKENS_PER_REQUEST || '4000', 10),
  emergencyKillswitch: process.env.AI_EMERGENCY_KILLSWITCH === 'true',
  alertThreshold: 0.8,
};

// In-memory runtime tracking buffer (resets on isolate reboot; durable tracking logged via telemetry)
let currentDaySpendUsd = 0;
let currentMonthSpendUsd = 0;
let lastResetDay = new Date().getUTCDate();
let lastResetMonth = new Date().getUTCMonth();

function resetCountersIfNeeded() {
  const now = new Date();
  if (now.getUTCDate() !== lastResetDay) {
    currentDaySpendUsd = 0;
    lastResetDay = now.getUTCDate();
  }
  if (now.getUTCMonth() !== lastResetMonth) {
    currentMonthSpendUsd = 0;
    lastResetMonth = now.getUTCMonth();
  }
}

/**
 * Checks whether an AI/ML API request is permissible under current budget caps.
 */
export function checkAiSpendingGuard(estimatedCostUsd: number = 0.001): {
  allowed: boolean;
  reason?: string;
  monthlySpendUsd: number;
  monthlyCapUsd: number;
  dailySpendUsd: number;
  dailyCapUsd: number;
} {
  resetCountersIfNeeded();

  if (aiSpendingConfig.emergencyKillswitch) {
    return {
      allowed: false,
      reason: 'AI/ML features are currently disabled via emergency killswitch.',
      monthlySpendUsd: currentMonthSpendUsd,
      monthlyCapUsd: aiSpendingConfig.monthlyCapUsd,
      dailySpendUsd: currentDaySpendUsd,
      dailyCapUsd: aiSpendingConfig.dailyCapUsd,
    };
  }

  if (currentDaySpendUsd + estimatedCostUsd > aiSpendingConfig.dailyCapUsd) {
    return {
      allowed: false,
      reason: `Daily AI spending limit reached ($${currentDaySpendUsd.toFixed(2)} / $${aiSpendingConfig.dailyCapUsd.toFixed(2)}). Resets at 00:00 UTC.`,
      monthlySpendUsd: currentMonthSpendUsd,
      monthlyCapUsd: aiSpendingConfig.monthlyCapUsd,
      dailySpendUsd: currentDaySpendUsd,
      dailyCapUsd: aiSpendingConfig.dailyCapUsd,
    };
  }

  if (currentMonthSpendUsd + estimatedCostUsd > aiSpendingConfig.monthlyCapUsd) {
    return {
      allowed: false,
      reason: `Monthly AI budget cap reached ($${currentMonthSpendUsd.toFixed(2)} / $${aiSpendingConfig.monthlyCapUsd.toFixed(2)}). Safeguard active.`,
      monthlySpendUsd: currentMonthSpendUsd,
      monthlyCapUsd: aiSpendingConfig.monthlyCapUsd,
      dailySpendUsd: currentDaySpendUsd,
      dailyCapUsd: aiSpendingConfig.dailyCapUsd,
    };
  }

  return {
    allowed: true,
    monthlySpendUsd: currentMonthSpendUsd,
    monthlyCapUsd: aiSpendingConfig.monthlyCapUsd,
    dailySpendUsd: currentDaySpendUsd,
    dailyCapUsd: aiSpendingConfig.dailyCapUsd,
  };
}

/**
 * Records AI token consumption and updates rolling spend counters.
 */
export function recordAiUsage(tokens: number, costUsd: number): void {
  resetCountersIfNeeded();
  currentDaySpendUsd += costUsd;
  currentMonthSpendUsd += costUsd;

  if (currentMonthSpendUsd >= aiSpendingConfig.monthlyCapUsd * aiSpendingConfig.alertThreshold) {
    console.warn(
      `[AI BUDGET ALERT] Monthly spend has reached ${(
        (currentMonthSpendUsd / aiSpendingConfig.monthlyCapUsd) *
        100
      ).toFixed(1)}% of budget ($${currentMonthSpendUsd.toFixed(2)} / $${aiSpendingConfig.monthlyCapUsd.toFixed(2)})`
    );
  }
}
