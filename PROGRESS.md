# DepositDesk — PROGRESS.md

## Current reassessment - 27 October 2026

The completion checkmarks below are inherited implementation claims, not verified acceptance results. Step 1 source audit found incomplete UI/API contracts, silent sample-data/success fallbacks, missing migrations, a session-storage mismatch and authorization/workflow gaps. See [IMPLEMENTATION_AUDIT.md](IMPLEMENTATION_AUDIT.md) for evidence, the acceptance baseline and the ordered delivery plan.

- [x] Step 1: read revised brief, inspect existing implementation and record gaps.
- [ ] Step 2: establish a reproducible database/session/auth and verification foundation.
- [ ] Steps 3-5: complete submission/scrutiny, maturity/renewal and release/audit workflows.
- [ ] Step 6: apply the supplied UI reference and complete required navigation.
- [ ] Step 7: run and document all acceptance scenarios and improvement measurements.

Baseline: dependency installation failed with npm's `Exit handler never called!`; `npm run verify` stopped because eslint was unavailable. Docker's Linux engine is not running. Database-backed behavior, tests and production build are not yet verified in this checkout. No application code changed during the assessment.

### Step 2 foundation checkpoint - branch `codex/depositdesk-foundation`

Implemented:
- Recovered locked dependency installation and Prisma client generation; added ESLint configuration and working workspace verification scripts.
- Added initial PostgreSQL migrations, connect-pg-simple-compatible session columns, an append-only audit trigger and basic database integrity constraints.
- Aligned shared identifier validation with existing Prisma CUIDs.
- Removed client-created demo identities and hardcoded login passwords; login now requires a successful API response. Logout failures are visible.
- Persisted sessions before login responses, fixed async authentication error handling, used real Argon2 dummy verification and transactional lockout/audit updates.
- Narrowed institution filters within authorized scope rather than replacing it; tightened the CSRF login exemption.
- Added isolated test-database/reset runners, corrected test DB port, and documented setup and generated seed accounts.
- Fixed API runtime interoperability with the ESM-only file-type dependency.
- Added API boundary tests, shared validation tests and deterministic IST date-boundary tests; added separate database-backed auth/isolation/audit tests.

Validation: final `npm run verify` passed: Prisma client generation, lint, all workspace type checks, 24 unit/API boundary tests, and shared/API/frontend production builds. Local API tests required permission to use loopback networking in the Codex execution environment.

Database verification remains blocked: Docker Desktop crashed during startup because it could not access its local `dockerInference` file. `npm run test:integration` could not reach/reset the isolated database. Migrations, seed and persistent login/isolation/audit tests must run against PostgreSQL before Step 2 is accepted as complete. No Docker internal files were modified and no development data was reset. Later workflow/UI gaps remain as listed in the audit; their legacy completion claims below remain unverified.

## Status Legend
- ✅ Done
- 🔄 In Progress
- ⏳ Planned
- ✂️ Cut (deliberate)

---

## Slices

### Slice 0 — Scaffold & Schema ✅
- [x] npm workspaces (apps/web, apps/api, packages/shared)
- [x] Prisma schema with all models
- [x] .env.example & apps/api/.env configured
- [x] docker-compose.yml
- [x] Root package.json with all scripts
- [x] TypeScript configs (tsconfig.json, tsconfig.node.json)

### Slice 1 — Auth & Session ✅
- [x] Login / logout / me endpoints
- [x] Argon2id password hashing with timing attack dummy verification
- [x] Session cookies (HTTP-only, SameSite=Lax)
- [x] CSRF protection with header validation (x-csrf-token)
- [x] Rate limiting + lockout (5 failed attempts, 15 min lock)
- [x] Quick 1-click Demo Role Switcher (IU, SO, AA, SA)

### Slice 2 — Dashboard & Registry ✅
- [x] Institution management & access scoping
- [x] Instrument registry (search, multi-filters, sort, pagination)
- [x] Dashboard summary cards (Total value, active, expiring soon, matured)
- [x] RBAC middleware (requireRole, requireInstitutionAccess)

### Slice 3 — FDR Submission & Documents ✅
- [x] Instrument form (draft → submit for AICTE scrutiny)
- [x] Document upload with magic byte validation (file-type)
- [x] Secure download endpoint with access checks
- [x] Cryptographic SHA-256 integrity hash

### Slice 4 — Scrutiny, Verification & Discrepancies ✅
- [x] Dedicated Scrutiny queue for officers
- [x] Verification recording (Authorized bank letter / source reference)
- [x] Discrepancy flagging (Critical, High, Medium, Low)
- [x] Discrepancy resolution & dismissal workflow

### Slice 5 — Maturity & Notifications ✅
- [x] Date status derivation in IST (Active, Expiring Soon, Matured, Expired)
- [x] Scheduled midnight maturity check + on-demand admin execution
- [x] Idempotent reminders (dedupe keys preventing duplicate alerts)
- [x] In-app notification center with unread badge & mark-as-read

### Slice 6 — Renewals ✅
- [x] Create linked replacement instrument endpoint
- [x] Predecessor & successor renewal chain linking

### Slice 7 — Release/Refund Workflow ✅
- [x] Release request CRUD
- [x] 4-step Maker-checker enforcement (IU Maker → SO Checker → AA Authority → Completion)
- [x] Mandatory scrutiny checklist verification
- [x] Completion evidence & bank discharge reference step

### Slice 8 — Audit, Reports & Export ✅
- [x] Append-only audit events written in same transaction
- [x] CSV export with formula injection neutralization (=, +, -, @ prepending)
- [x] Audit trail UI with actor details and payload inspector

### Slice 9 — Polish & Tests ✅
- [x] TypeScript compilation & typecheck (100% clean across all workspaces)
- [x] Vite production bundle build (4.67s clean bundle)
- [x] Seamless demo mode fallback with rich synthetic datasets

---

## Deliberately Cut (P1 / Out of Scope)
- Email delivery (adapter interface only, in-app alerts used)
- PDF report generation (CSV done with injection neutralization)
- Maturity calendar view (bucketed horizon list done)
- Malware scanning (adapter interface only, "not scanned" shown)
- Object storage (local disk adapter, S3 interface defined)
- OCR / ML features
- Real AICTE or bank integration
