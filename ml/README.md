# KCLMC Quantitative Research & Treasury Risk Engine

> **Subsystem**: Econometric calibration, discrete choice analysis, and stochastic liquidity modeling trained on King's College London Mountaineering Club (KCLMC) transaction records in Cloudflare D1.

---

## 1. Executive Summary & Mathematical Formulations

This package implements an empirical quantitative research pipeline trained on real student climbing society transactions. It addresses the club treasurer's capital allocation and liquidity problem: **"How much capital can the club commit to upfront merchandise manufacturer MOQs and coach charter deposits for mountain meets without breaching minimum operating reserve constraints?"**

### Core Mathematical Components

1. **Transaction Arrival Point Process & Overdispersion Diagnostics**:
   - Computes Fisher Dispersion Index $\Phi = \frac{s^2}{\bar{x}}$.
   - Tests the Homogeneous Poisson Process (HPP) hypothesis against an overdispersed process using the asymptotic Chi-Square statistic:
     $$D = (T - 1) \Phi \sim \chi^2(T - 1)$$
   - On KCLMC D1 data, $\Phi = 10.48$ ($p < 10^{-100}$), rejecting the Poisson hypothesis in favor of an **overdispersed Negative Binomial arrival process** capturing order flow clustering around Freshers' Fair and Welcome events.
2. **Negative Binomial Parameter Calibration**:
   - Inflow intensity parameters $(\hat{r}, \hat{p})$ are fitted to capture clustered arrival variance $\sigma^2 > \mu$:
     $$\hat{r} = \frac{\mu^2}{\sigma^2 - \mu}, \quad \hat{p} = \frac{\hat{r}}{\hat{r} + \mu}$$
3. **Regularized Cohort Discrete-Choice Model ($L_2$ Logistic Regression)**:
   - Estimates tier selection probability $P(Y_i = \text{Recreational (£35)} \mid \mathbf{x}_i)$:
     $$\text{logit}(P(Y_i = 1)) = \beta_0 + \sum_{k} \beta_k \cdot \mathbf{1}_{\{\text{cohort}_i = k\}}$$
   - Solved via Iteratively Reweighted Least Squares (IRLS / Newton-Raphson) with $L_2$ penalty to ensure numerical stability across smaller student cohorts.
   - Computes parameter standard errors from the inverse Fisher Information Matrix $\mathbf{I}(\hat{\beta}) = \mathbf{X}^T \mathbf{W} \mathbf{X} + \lambda \mathbf{I}$, z-scores, p-values, and Odds Ratios ($e^{\beta}$).
4. **Vectorized Monte Carlo Liquidity Engine (10,000 Paths)**:
   - Simulates 90-day Term 2 daily cash trajectories $C_t = C_0 + \sum_{\tau=1}^t (I_\tau - O_\tau - J_\tau)$.
   - Computes standard financial risk metrics:
     - **Liquidity Value-at-Risk ($\text{L-VaR}_{95\%}, \text{L-VaR}_{99\%}$)**: 95th/99th percentile maximum drawdown from initial cash pool ($£5,060$).
     - **Liquidity Conditional Value-at-Risk ($\text{L-CVaR}_{99\%}$ / Expected Shortfall)**: $\mathbb{E}[L \mid L \ge \text{L-VaR}_{99\%}]$.
     - **Insolvency / Ruin Probability**: $\mathbb{P}\left(\min_{t \in [0, T]} C_t < C_{\text{reserve}}\right)$.

---

## 2. Empirical Findings on KCLMC D1 Roster

Trained on 261 dated transactions spanning August–October 2026:

| Metric | Empirical Value | Economic / Quant Interpretation |
| :--- | :--- | :--- |
| **Gross Initial Cash ($C_0$)** | $£5,060.00$ | Total Term 1 dues (98 Rec @ £35 + 163 Social @ £10). |
| **Mean Daily Arrivals ($\mu$)** | $3.30$ tx/day | Baseline inflow intensity. |
| **Variance of Arrivals ($\sigma^2$)** | $34.62$ | Severe volatility in daily signups. |
| **Dispersion Index ($\Phi$)** | **$10.48$** | Extreme clustering / self-excitation ($p = 1.24 \times 10^{-110}$). |
| **Fitted NegBin $(r, p)$** | $r = 0.3485, p = 0.0954$ | Calibrated arrival distribution for simulation. |
| **$\text{L-VaR}_{95\%}$ (90 days)** | $£3,038.28$ | Max expected drawdown at 95% confidence with $£3,150$ outlays. |
| **$\text{L-VaR}_{99\%}$ (90 days)** | $£3,305.50$ | Max expected drawdown at 99% confidence. |
| **$\text{L-CVaR}_{99\%}$ (Expected Shortfall)** | $£3,447.69$ | Mean loss in the 1% tail. |
| **Ruin Probability ($C_t < £1,000$)** | **$0.00\%$** | $£5,060$ treasury pool safely absorbs $£3,150$ commitments without breaching $£1k$ floor. |

---

## 3. Usage & Execution

```bash
# Execute model trainer and export calibrated parameter JSON
python3 ml/train_treasury_model.py
```

The script automatically detects the latest D1 production backup in `backups/backup_d1_*.json`, trains the statistical models, runs the 10,000-path Monte Carlo engine, and exports calibrated weights to `ml/calibrated_treasury_model.json`.
