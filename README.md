# King's College London Mountaineering Club (KCLMC) Platform

The official digital platform and operational engine of the **King's College London Mountaineering & Climbing Club (KCLMC)**, accredited society of the King's College London Students' Union (KCLSU, Charity No. 1136043).

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Run all tests (roster, verification, and security suite)
npm test

# 4. Run automated security testing suite
npm run test:security

# 5. Build for production
npm run build
```

## Documentation & Manuals

- **[Committee Handover Manual](docs/COMMITTEE_HANDOVER_MANUAL.md)**: Full architecture, tech stack, database schema, RLS policies, RBAC setup, pass lifecycle, deployment guide, and tenure transition checklist.
- **[Legal Compliance & Risk Audit](docs/LEGAL_COMPLIANCE_AND_RISK_AUDIT.md)**: Statutory ICO fee exemption, negligence defense shield (*volenti non fit injuria*), and Equality Act 2010 accessibility policy.
- **[Environment Configuration Template](sample.env)**: Reference for all required environment variables and secrets.

## Core Features

- **Digital Climbing Pass**: Authenticated pass with live QR code for climbing gyms and trip leaders.
- **KCLSU Roster Reconciliation**: Automated CSV ingest with Soc-to-Rec tier upgrade support and CSV formula injection protection.
- **Where We Climb (Beta)**: Indoor walls and crag guides linked directly to BMC Regional Access Database (RAD) and UK Climbing (UKC) topos.
- **Meets & Expeditions**: Club meets calendar with difficulty ratings and registration tracking.
- **LUBE Competition Engine**: London University Bouldering Event scoring and live rankings.
- **Automated Security Suite**: Static credential leakage detection, SQL injection resistance, XSS sanitization, and RBAC defense.
