# King's College London Mountaineering Club (KCLMC) Portal

Official web platform and digital membership portal for King's College London Mountaineering Club.

---

## Overview

The KCLMC Portal provides verified membership passes, trip registrations, London climbing wall discounts, crag directories, and committee administration tools for King's College London climbers.

## Key Features

- **Digital Membership Cards**: Tamper-proof passes bound to official KCLSU purchase records with instant QR verification and high-resolution PNG export.
- **KCLSU Member Roster Synchronization**: Database-backed membership verification with automated Student Union CSV ingestion.
- **Club Hub & Expeditions**: Dedicated trip schedules covering trad, sport, bouldering, and winter mountaineering.
- **Wall & Crag Guides**: Comprehensive guides with student discount rates across London climbing centres and UK crags.
- **Committee Administration Suite**:
  - `/admin/reconcile`: Dual-mode KCLSU membership roster synchronization and merch payment matching.
  - `/admin/scan`: Mobile camera and manual scanner for verifying climber passes at the climbing wall.
  - `/admin/export`: Manufacturing sizing matrix for apparel group-buys.
  - `/admin/modules`: Role-based permissions and module gating.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Frontend**: React 19, Tailwind CSS, Framer Motion, Lucide React
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS)
- **Hosting & Edge**: Cloudflare Workers (`@opennextjs/cloudflare`)
- **Language**: TypeScript

## Getting Started

### 1. Installation

```bash
git clone https://github.com/RemTypes/kclmc-portal.git
cd kclmc-portal
npm install
```

### 2. Environment Configuration

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPERADMIN_EMAIL=remy.preston@outlook.com
COMMITTEE_EMAILS=president@kclmc.org,treasurer@kclmc.org,gear@kclmc.org
```

### 3. Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### 4. Production Build

```bash
npm run build
```

## Deployment

Configured for deployment to Cloudflare Workers using OpenNext:

```bash
npm run build:worker
npm run deploy:cloudflare
```

---

© King's College London Mountaineering Club.
