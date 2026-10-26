# DepositDesk — Security Deposit & FDR Lifecycle Management
> **AICTE Problem Statement ID 26265 · Prototype MVP**

DepositDesk is a specialized, functional prototype designed to streamline and modernize the regulatory lifecycle of security deposits and Fixed Deposit Receipts (FDRs) associated with AICTE approval-related processes.

---

## Key Capabilities & Features

### 1. Multi-Dimensional Status Model
Unlike traditional flat status models, DepositDesk separates lifecycle into 5 orthogonal dimensions:
- **Lifecycle Status**: `DRAFT` → `SUBMITTED` → `UNDER_REVIEW` → `ACTION_REQUIRED` → `RESUBMITTED` → `VERIFIED` / `REJECTED` / `CLOSED`
- **Date Status**: `ACTIVE`, `EXPIRING_SOON` (≤90 days alert threshold), `MATURED`, `EXPIRED`
- **Independent Verification Status**: `NOT_CHECKED`, `PENDING`, `CONFIRMED_BY_AUTHORIZED_SOURCE`, `DISCREPANCY_FOUND`, `DEMO_SIMULATED`
- **Renewal Status**: `NONE`, `REQUIRED`, `IN_PROGRESS`, `COMPLETED` (with linked renewal chains)
- **Release Status**: `NONE`, `OPEN`, `APPROVED`, `COMPLETED`, `REJECTED`

### 2. Four-Role RBAC & Maker-Checker Governance
- **Institution User (IU)**: Registers deposits, uploads FDR scans, tracks maturities, submits release requests.
- **Scrutiny Officer (SO)**: First-line checker; examines FDR scans, records official bank verification letters, flags deficiencies.
- **Approving Authority (AA)**: Competent regional officer; executes maker-checker second-signoff, approves or rejects release/refund orders.
- **System Administrator (SA)**: Configures reminder thresholds (90/60/30/15/7/1 days), checklist parameters, user accounts, and triggers on-demand maturity audits.

### 3. Rigorous Security & Audit Hardening
- **Argon2id Hashing**: Password hashing with dummy verification to mitigate timing attacks.
- **Session & CSRF Protection**: Postgres-backed HTTP-only sessions with `x-csrf-token` header enforcement.
- **Account Lockout**: 5 failed login attempts trigger an automatic 15-minute lockout.
- **Magic Byte Validation**: Uploaded documents are verified by file header magic bytes (`file-type`), not spoofable filename extensions.
- **Cryptographic Integrity**: Every uploaded document generates a tamper-evident SHA-256 hash.
- **Immutable Audit Trail**: Audit events are recorded in the same database transaction as business operations; update/delete operations are strictly forbidden.
- **Formula Injection Neutralization**: All CSV reports prepend special characters (`=`, `+`, `-`, `@`) with single quotes to protect spreadsheet users.

---

## Architecture

```
DepositDesk/
├── apps/
│   ├── web/                     # React 18, Vite, Tailwind CSS, Notion-inspired UI
│   │   ├── src/
│   │   │   ├── components/      # StatCard, StatusBadge, Modal, AppLayout
│   │   │   ├── context/         # AuthContext & Demo Role Switcher
│   │   │   ├── lib/             # Axios API client & typed interfaces
│   │   │   └── pages/           # Dashboard, Registry, Detail, Scrutiny, Release, Reports, Admin
│   └── api/                     # Node.js, Express, TypeScript, Prisma ORM
│       ├── src/
│       │   ├── modules/         # Auth, Instruments, Verification, Discrepancies, Release, Audit
│       │   ├── jobs/            # Scheduled & On-Demand Maturity Check Job
│       │   ├── middleware/      # CSRF, RBAC, Rate-Limit, Error Handler
│       │   └── config/          # Environment & Prisma client
└── packages/
    └── shared/                  # Monorepo shared Zod schemas & TypeScript domain types
```

---

## Getting Started

### Prerequisites
- Node.js (v20+ or v22+)
- npm (v10+ or v11+)
- Docker (optional for local PostgreSQL)

### 1. Installation
Install dependencies across all workspaces:
```bash
npm install
```

### 2. Build & Typecheck
Build all packages (`@depositdesk/shared`, `@depositdesk/api`, `@depositdesk/web`):
```bash
npm run build
npm run typecheck
```

### 3. Run the Development Server
Start the frontend web application:
```bash
npm run dev -w apps/web
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## Demo Logins & Instant Role Switching

The application comes with an instant 1-click role switcher in the top banner and on the login page:

| Role | Demo Email | Role Description |
| :--- | :--- | :--- |
| **Institution User (IU)** | `iu@demo.aicte.gov.in` | Dr. Ramesh Sharma (Registrar) |
| **Scrutiny Officer (SO)** | `so@demo.aicte.gov.in` | Ananya Verma (First-line Scrutiny) |
| **Approving Authority (AA)** | `aa@demo.aicte.gov.in` | Prof. K. S. Sundaram (Regional Officer) |
| **System Admin (SA)** | `admin@demo.aicte.gov.in` | Vikram Mehta (AICTE HQ Admin) |

*Default demo password: `DemoPassword123!` (or click any 1-click instant login button).*

---

## License & Disclaimer
This is a prototype demonstration developed for AICTE Problem Statement ID 26265. It is not an official AICTE system and does not replace applicable regulatory procedures or competent authority decisions.
