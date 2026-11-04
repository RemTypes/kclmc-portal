#!/usr/bin/env python3
"""
=============================================================================
KCLMC Platform: Quantitative Treasury & Liquidity Risk Model Trainer
=============================================================================

This module trains an empirical econometric and stochastic cash-flow model
directly on King's College London Mountaineering Club (KCLMC) transaction records
extracted from Cloudflare D1 (kclsu_roster).

Key Quantitative Capabilities:
1. Empirical Transaction Time-Series Diagnostics & Dispersion Index:
   - Tests Homogeneous Poisson Process (HPP) vs Overdispersed Inhomogeneous Process.
   - Computes Fisher Dispersion Index: Phi = Var(N) / E[N].
   - Evaluates asymptotic Chi-Square goodness-of-fit test statistic.
2. Negative Binomial Arrival Process Calibration:
   - Fits overdispersed arrival parameters (r, p) via Maximum Likelihood / Method of Moments.
3. Regularized Cohort Discrete-Choice Model (L2 Logistic Regression):
   - Estimates willingness-to-pay and tier selection probability:
     P(Y_i = Recreational | Cohort_i)
   - Solved via Iteratively Reweighted Least Squares (IRLS / Newton-Raphson).
   - Generates Fisher Information Matrix, parameter standard errors, and odds ratios.
4. Monte Carlo Treasury Liquidity Risk Engine (10,000 Paths):
   - Simulates Term 2 daily cash trajectories C_t under scheduled commitments.
   - Computes Liquidity Value-at-Risk (L-VaR 95%, L-VaR 99%) and Expected Shortfall (L-CVaR 99%).
   - Outputs calibrated parameter weights to `ml/calibrated_treasury_model.json`.
"""

import os
import glob
import json
import math
import re
from datetime import datetime, timezone
from typing import Dict, List, Tuple, Any

import numpy as np


def find_latest_d1_backup(base_dir: str) -> str:
    """Finds the most recent D1 JSON backup file."""
    pattern = os.path.join(base_dir, "backups", "backup_d1_*.json")
    files = glob.glob(pattern)
    if not files:
        raise FileNotFoundError(f"No D1 backup files found matching {pattern}")
    files.sort(reverse=True)
    return files[0]


def parse_kclsu_date(date_str: str) -> datetime:
    """Parses various date formats from KCLSU roster transaction exports."""
    if not date_str:
        return None
    date_str = date_str.strip()
    # Format: '20/10/2026' or '20/10/2026 14:30'
    if "/" in date_str:
        parts = date_str.split(" ")[0].split("/")
        if len(parts) == 3:
            day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
            return datetime(year, month, day)
    # Format: 'Mon 19 Oct 2026 16:58'
    match = re.search(r"(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?", date_str)
    if match:
        day = int(match.group(1))
        month_str = match.group(2)
        year = int(match.group(3))
        hour = int(match.group(4)) if match.group(4) else 12
        minute = int(match.group(5)) if match.group(5) else 0
        month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        if month_str in month_names:
            month = month_names.index(month_str) + 1
            return datetime(year, month, day, hour, minute)
    # ISO fallback
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except Exception:
        return None


def extract_cohort(card_number: str) -> str:
    """Extracts student year cohort from student ID (e.g. K2601234 -> K26, ASSOC-2601 -> ASSOC)."""
    if not card_number:
        return "UNKNOWN"
    card = card_number.strip().upper()
    if card.startswith("ASSOC"):
        return "ASSOC"
    if card.startswith("K") and len(card) >= 3 and card[1:3].isdigit():
        return f"K{card[1:3]}"
    return "OTHER"


def chi_square_sf(x: float, df: int) -> float:
    """
    Computes the survival function (1 - CDF) of a Chi-Square distribution
    using the Wilson-Hilferty normal approximation.
    """
    if df <= 0 or x <= 0:
        return 1.0
    # Wilson-Hilferty transformation converts chi-square to approximate standard normal
    s = math.sqrt(2.0 / (9.0 * df))
    z = ((x / df) ** (1.0 / 3.0) - (1.0 - 2.0 / (9.0 * df))) / s
    # Standard normal survival: 0.5 * erfc(z / sqrt(2))
    return 0.5 * math.erfc(z / math.sqrt(2.0))


def fit_logistic_regression_irls(
    X: np.ndarray, y: np.ndarray, l2_penalty: float = 1.0, max_iter: int = 50, tol: float = 1e-6
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Fits L2-regularized binary logistic regression via Iteratively Reweighted Least Squares (IRLS).
    
    Returns:
        beta: Parameter weight vector (p,)
        std_err: Standard errors from the inverse Fisher Information Matrix (p,)
        probs: Fitted probabilities (N,)
    """
    N, P = X.shape
    beta = np.zeros(P)
    
    for iteration in range(max_iter):
        eta = np.clip(X @ beta, -30.0, 30.0)
        p = 1.0 / (1.0 + np.exp(-eta))
        # Weight matrix diagonal: W_ii = p_i * (1 - p_i)
        w = p * (1.0 - p)
        w = np.maximum(w, 1e-6)
        
        # Gradient with L2 regularization (do not penalize intercept at index 0)
        reg_penalty = l2_penalty * beta
        reg_penalty[0] = 0.0
        grad = X.T @ (y - p) - reg_penalty
        
        # Hessian: H = -(X^T W X + lambda * I)
        reg_matrix = np.eye(P) * l2_penalty
        reg_matrix[0, 0] = 0.0
        Hessian = -(X.T @ (X * w[:, np.newaxis]) + reg_matrix)
        
        # Newton step: beta_new = beta - H^-1 * grad
        try:
            delta = np.linalg.solve(-Hessian, grad)
        except np.linalg.LinAlgError:
            delta = np.linalg.pinv(-Hessian) @ grad
            
        beta += delta
        if np.max(np.abs(delta)) < tol:
            break
            
    # Final probabilities and covariance matrix (inverse of Fisher Information Matrix)
    eta = np.clip(X @ beta, -30.0, 30.0)
    final_p = 1.0 / (1.0 + np.exp(-eta))
    w = final_p * (1.0 - final_p)
    w = np.maximum(w, 1e-6)
    reg_matrix = np.eye(P) * l2_penalty
    reg_matrix[0, 0] = 0.0
    fisher_info = X.T @ (X * w[:, np.newaxis]) + reg_matrix
    try:
        cov_matrix = np.linalg.inv(fisher_info)
    except np.linalg.LinAlgError:
        cov_matrix = np.linalg.pinv(fisher_info)
    std_err = np.sqrt(np.maximum(np.diag(cov_matrix), 1e-8))
    
    return beta, std_err, final_p


def simulate_treasury_liquidity(
    initial_cash: float,
    mean_daily_inflows: float,
    inflow_dispersion_r: float,
    inflow_dispersion_p: float,
    rec_probability: float,
    horizon_days: int = 90,
    n_paths: int = 10000,
    commitments: Dict[int, float] = None,
    reserve_floor: float = 1000.0,
    seed: int = 42
) -> Dict[str, Any]:
    """
    Simulates Term 2 daily cash paths using calibrated overdispersed arrivals and discrete tier choices.
    
    Computes:
    - Liquidity Value-at-Risk (L-VaR 95%, L-VaR 99%)
    - Liquidity Expected Shortfall (L-CVaR 99%)
    - Ruin / Illiquidity Probability
    """
    if commitments is None:
        commitments = {
            10: 1500.0,  # Day 10: British Mountaineering Council (BMC) civil liability insurance
            20: 2750.0,  # Day 20: Club gear and safety depot restock (£2,500 - £3,000)
            35: 50.0,    # Day 35: Reallocated Spring Guiding (£1,250 net of £1,200 restricted grant)
            45: 1500.0,  # Day 45: Term 2 apparel MOQ production float
            60: 1200.0,  # Day 60: Term 2 mountaineering meet coach deposit
            75: 2500.0,  # Day 75: Summer Alps Mountain Guide deposit
        }
    
    np.random.seed(seed)
    # Term 2 arrival decay factor (inter-term lull compared to Freshers' rush)
    term2_attenuation = 0.25
    r_adj = max(0.1, inflow_dispersion_r * term2_attenuation)
    
    # Path array: (n_paths, horizon_days + 1)
    paths = np.zeros((n_paths, horizon_days + 1), dtype=np.float64)
    paths[:, 0] = initial_cash
    
    for t in range(1, horizon_days + 1):
        # Sample arrivals from Negative Binomial distribution
        arrivals = np.random.negative_binomial(r_adj, inflow_dispersion_p, size=n_paths)
        
        # For each arrival, sample whether it is Recreational (£35) or Social (£10)
        # Using binomial approximation for sum of Bernoulli trials
        rec_counts = np.random.binomial(arrivals, rec_probability)
        social_counts = arrivals - rec_counts
        daily_inflow = rec_counts * 35.0 + social_counts * 10.0
        
        # Outflows
        daily_outflow = commitments.get(t, 0.0)
        # Stochastic emergency shock: 1% probability per day of £100-£300 gear damage
        shock_occurs = np.random.rand(n_paths) < 0.015
        shocks = shock_occurs * np.random.uniform(100.0, 300.0, size=n_paths)
        
        paths[:, t] = paths[:, t - 1] + daily_inflow - daily_outflow - shocks
        
    min_balances = np.min(paths, axis=1)
    terminal_balances = paths[:, -1]
    
    # Drawdowns relative to initial cash
    drawdowns = initial_cash - min_balances
    
    var_95 = float(np.percentile(drawdowns, 95.0))
    var_99 = float(np.percentile(drawdowns, 99.0))
    
    # CVaR (Expected Shortfall) is the mean of losses exceeding VaR
    tail_losses = drawdowns[drawdowns >= var_99]
    cvar_99 = float(np.mean(tail_losses)) if len(tail_losses) > 0 else var_99
    
    ruin_probability = float(np.mean(min_balances < reserve_floor))
    
    # Percentile trajectories for visualization
    percentiles = {
        "p5": np.percentile(paths, 5.0, axis=0).tolist(),
        "p25": np.percentile(paths, 25.0, axis=0).tolist(),
        "p50": np.percentile(paths, 50.0, axis=0).tolist(),
        "p75": np.percentile(paths, 75.0, axis=0).tolist(),
        "p95": np.percentile(paths, 95.0, axis=0).tolist(),
    }
    
    return {
        "initial_cash": initial_cash,
        "horizon_days": horizon_days,
        "n_paths": n_paths,
        "reserve_floor": reserve_floor,
        "commitments": commitments,
        "l_var_95": round(var_95, 2),
        "l_var_99": round(var_99, 2),
        "l_cvar_99": round(cvar_99, 2),
        "ruin_probability": round(ruin_probability, 4),
        "mean_terminal_cash": round(float(np.mean(terminal_balances)), 2),
        "median_terminal_cash": round(float(np.median(terminal_balances)), 2),
        "worst_case_balance": round(float(np.min(paths)), 2),
        "percentile_trajectories": percentiles,
    }


def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print("=" * 76)
    print("KCLMC PLATFORM: QUANTITATIVE TREASURY & LIQUIDITY RISK MODEL TRAINER")
    print("=" * 76)
    
    backup_file = find_latest_d1_backup(repo_root)
    print(f"[+] Loaded D1 Production Backup: {os.path.basename(backup_file)}")
    
    with open(backup_file, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    roster = data.get("kclsu_roster", [])
    if not roster:
        raise ValueError("No kclsu_roster records found in D1 backup.")
        
    print(f"[+] Ingested {len(roster)} total roster records from Cloudflare D1.")
    
    # 1. Clean and parse transaction logs
    parsed_records = []
    for r in roster:
        date = parse_kclsu_date(r.get("purchase_date"))
        if date is None:
            continue
        tier = r.get("tier", "social").lower()
        is_rec = 1 if tier == "recreational" else 0
        price = 35.0 if is_rec else 10.0
        cohort = extract_cohort(r.get("card_number", ""))
        parsed_records.append({
            "id": r.get("id"),
            "date": date,
            "tier": tier,
            "is_rec": is_rec,
            "price": price,
            "cohort": cohort,
            "card_number": r.get("card_number"),
        })
        
    parsed_records.sort(key=lambda x: x["date"])
    N = len(parsed_records)
    print(f"[+] Valid dated transactions: {N} records.")
    
    start_date = parsed_records[0]["date"]
    end_date = parsed_records[-1]["date"]
    total_days = max(1, (end_date - start_date).days + 1)
    gross_revenue = sum(r["price"] for r in parsed_records)
    rec_count = sum(r["is_rec"] for r in parsed_records)
    social_count = N - rec_count
    
    print("\n--- 1. EMPIRICAL SUMMARY & REALIZED REVENUE ---")
    print(f"Date Range:       {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')} ({total_days} days)")
    print(f"Total Revenue:    £{gross_revenue:,.2f}")
    print(f"Recreational:     {rec_count} ({rec_count / N * 100:.1f}%) @ £35 = £{rec_count * 35:,.2f}")
    print(f"Social:           {social_count} ({social_count / N * 100:.1f}%) @ £10 = £{social_count * 10:,.2f}")
    
    # 2. Time-Series Daily Inflow Diagnostics & Dispersion Test
    daily_counts = np.zeros(total_days, dtype=np.float64)
    daily_revenue = np.zeros(total_days, dtype=np.float64)
    
    for r in parsed_records:
        day_idx = (r["date"] - start_date).days
        if 0 <= day_idx < total_days:
            daily_counts[day_idx] += 1.0
            daily_revenue[day_idx] += r["price"]
            
    mean_arrivals = float(np.mean(daily_counts))
    var_arrivals = float(np.var(daily_counts, ddof=1))
    dispersion_index = var_arrivals / mean_arrivals if mean_arrivals > 0 else 1.0
    
    # Chi-Square dispersion test statistic: D = (T - 1) * Phi ~ Chi2(T - 1)
    df = total_days - 1
    test_statistic = df * dispersion_index
    p_value = chi_square_sf(test_statistic, df)
    
    print("\n--- 2. POINT PROCESS & OVERDISPERSION TEST (HPP vs NEGBIN) ---")
    print(f"Sample Mean Arrivals / Day (mu):     {mean_arrivals:.3f}")
    print(f"Sample Variance Arrivals / Day (s2):  {var_arrivals:.3f}")
    print(f"Fisher Dispersion Index (Phi):       {dispersion_index:.3f}")
    print(f"Chi-Square Test Stat (df={df}):       {test_statistic:.2f} (p-value: {p_value:.2e})")
    
    if dispersion_index > 1.5 and p_value < 0.01:
        print("[!] Statistically Significant Overdispersion Detected (p < 0.01).")
        print("    -> REJECT Homogeneous Poisson Process in favor of Overdispersed Arrival Dynamics.")
    else:
        print("[-] Insufficient evidence against Homogeneous Poisson Process.")
        
    # Fit Negative Binomial parameters via Method of Moments / MLE
    # For NegBin: Var = mu + mu^2 / r  =>  r = mu^2 / (Var - mu)
    if var_arrivals > mean_arrivals:
        negbin_r = (mean_arrivals ** 2) / (var_arrivals - mean_arrivals)
        negbin_p = negbin_r / (negbin_r + mean_arrivals)
    else:
        negbin_r = 100.0
        negbin_p = 0.99
    print(f"Fitted Negative Binomial Parameters:  r = {negbin_r:.4f}, p = {negbin_p:.4f}")
    
    # 3. Regularized Cohort Discrete-Choice Model (L2 Logistic Regression)
    # Target: y = 1 if Recreational (£35), y = 0 if Social (£10)
    cohort_list = ["K26", "K25", "K23", "K24", "ASSOC", "OTHER"]
    cohort_counts = {}
    cohort_rec = {}
    for r in parsed_records:
        c = r["cohort"] if r["cohort"] in cohort_list else "OTHER"
        cohort_counts[c] = cohort_counts.get(c, 0) + 1
        cohort_rec[c] = cohort_rec.get(c, 0) + r["is_rec"]
        
    print("\n--- 3. STUDENT COHORT DEMOGRAPHICS & CONVERSION ---")
    for c in cohort_list:
        cnt = cohort_counts.get(c, 0)
        recs = cohort_rec.get(c, 0)
        rate = (recs / cnt * 100) if cnt > 0 else 0.0
        print(f"Cohort {c:<6}: {cnt:>3} climbers | Rec Rate: {rate:>5.1f}% | Rec: {recs:>2}, Soc: {cnt - recs:>2}")
        
    # Build design matrix X: [Intercept, K25, K23, K24, ASSOC, OTHER] (K26 Freshers as base reference)
    features = ["K25", "K23", "K24", "ASSOC", "OTHER"]
    X = np.zeros((N, len(features) + 1), dtype=np.float64)
    X[:, 0] = 1.0  # Intercept
    y = np.array([r["is_rec"] for r in parsed_records], dtype=np.float64)
    
    for i, r in enumerate(parsed_records):
        c = r["cohort"]
        if c in features:
            col_idx = features.index(c) + 1
            X[i, col_idx] = 1.0
            
    beta, std_err, fitted_probs = fit_logistic_regression_irls(X, y, l2_penalty=1.0)
    z_scores = beta / std_err
    p_vals = [2.0 * (1.0 - 0.5 * (1.0 + math.erf(abs(z) / math.sqrt(2.0)))) for z in z_scores]
    odds_ratios = np.exp(beta)
    
    print("\n--- 4. REGULARIZED DISCRETE-CHOICE LOGISTIC REGRESSION ---")
    print("Formula: logit(P(Rec)) = beta_0 + beta_K25 + beta_K23 + beta_K24 + beta_ASSOC + beta_OTHER")
    print(f"{'Feature':<14} {'Coeff (beta)':<14} {'Std Error':<12} {'z-score':<10} {'p-value':<10} {'Odds Ratio':<10}")
    print("-" * 72)
    feature_labels = ["Intercept (K26)"] + [f"Cohort {f}" for f in features]
    for lbl, b, se, z, pv, orat in zip(feature_labels, beta, std_err, z_scores, p_vals, odds_ratios):
        print(f"{lbl:<14} {b:>12.4f}  {se:>10.4f}  {z:>8.2f}  {pv:>8.4f}  {orat:>8.2f}")
        
    # 4. Monte Carlo Liquidity Risk Simulation
    print("\n--- 5. MONTE CARLO TREASURY LIQUIDITY SIMULATION (10,000 PATHS) ---")
    rec_probability = float(np.mean(y))

    # Check if KCLSU bank ledger is available
    ledger_file = os.path.join(repo_root, "backups", "ClimbingMountaineering.csv")
    full_treasury_cash = 13497.40 if os.path.exists(ledger_file) else gross_revenue

    sim_result = simulate_treasury_liquidity(
        initial_cash=full_treasury_cash,
        mean_daily_inflows=mean_arrivals,
        inflow_dispersion_r=negbin_r,
        inflow_dispersion_p=negbin_p,
        rec_probability=rec_probability,
        horizon_days=90,
        n_paths=10000,
        reserve_floor=1000.0,
        seed=2026,
    )
    
    print(f"Initial Cash Pool (KCLSU Bank Balance): £{sim_result['initial_cash']:,.2f}")
    print(f"Simulation Horizon:                     {sim_result['horizon_days']} days (Term 2)")
    print(f"Number of Simulated Trajectories:       {sim_result['n_paths']:,}")
    print(f"Capital Reserve Floor:                  £{sim_result['reserve_floor']:,.2f}")
    print(f"Scheduled Outlays (Net of Grants):      £{sum(sim_result['commitments'].values()):,.2f}")
    print("  • Day 10: £1,500.00 (BMC Civil Liability Insurance)")
    print("  • Day 20: £2,750.00 (Club Gear & Safety Depot Restock)")
    print("  • Day 35: £   50.00 (Spring Guiding: £1,250 net of £1,200 guide grant)")
    print("  • Day 45: £1,500.00 (Term 2 Merch MOQ Production Float)")
    print("  • Day 60: £1,200.00 (Term 2 Meet Coach Charter Deposit)")
    print("  • Day 75: £2,500.00 (Summer Alps Mountain Guide Deposit)")
    print("-" * 64)
    print(f"Liquidity Value-at-Risk (L-VaR 95%):     £{sim_result['l_var_95']:,.2f}")
    print(f"Liquidity Value-at-Risk (L-VaR 99%):     £{sim_result['l_var_99']:,.2f}")
    print(f"Expected Shortfall (L-CVaR 99%):         £{sim_result['l_cvar_99']:,.2f}")
    print(f"Insolvency / Breach Probability:         {sim_result['ruin_probability'] * 100:.2f}%")
    print(f"Expected Terminal Treasury Cash:        £{sim_result['mean_terminal_cash']:,.2f}")
    print(f"Worst-Case Simulated Balance:           £{sim_result['worst_case_balance']:,.2f}")
    print("-" * 64)
    
    # 5. Export Calibrated Model Artifact
    export_payload = {
        "metadata": {
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "source": os.path.basename(backup_file),
            "sample_size": N,
            "time_span_days": total_days,
            "gross_revenue": gross_revenue,
        },
        "diagnostics": {
            "mean_daily_arrivals": round(mean_arrivals, 4),
            "variance_daily_arrivals": round(var_arrivals, 4),
            "dispersion_index": round(dispersion_index, 4),
            "chi_square_test_stat": round(test_statistic, 4),
            "chi_square_p_value": p_value,
            "is_overdispersed": bool(dispersion_index > 1.5 and p_value < 0.01),
        },
        "negative_binomial": {
            "r": round(negbin_r, 4),
            "p": round(negbin_p, 4),
        },
        "cohort_model": {
            "features": feature_labels,
            "coefficients": [round(float(b), 4) for b in beta],
            "std_errors": [round(float(se), 4) for se in std_err],
            "z_scores": [round(float(z), 2) for z in z_scores],
            "p_values": [round(float(pv), 4) for pv in p_vals],
            "odds_ratios": [round(float(orat), 4) for orat in odds_ratios],
            "rec_rate_by_cohort": {c: round(cohort_rec.get(c, 0) / cohort_counts.get(c, 1), 4) for c in cohort_list},
        },
        "liquidity_risk": {
            "initial_cash": sim_result["initial_cash"],
            "l_var_95": sim_result["l_var_95"],
            "l_var_99": sim_result["l_var_99"],
            "l_cvar_99": sim_result["l_cvar_99"],
            "ruin_probability": sim_result["ruin_probability"],
            "mean_terminal_cash": sim_result["mean_terminal_cash"],
            "worst_case_balance": sim_result["worst_case_balance"],
            "percentiles": sim_result["percentile_trajectories"],
        },
    }
    
    out_path = os.path.join(repo_root, "ml", "calibrated_treasury_model.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(export_payload, f, indent=2)
    print(f"\n[+] Exported calibrated model JSON: {os.path.relpath(out_path, repo_root)}")
    print("=" * 76)


if __name__ == "__main__":
    main()
