# DepositDesk — PROGRESS.md

## Current reassessment - 27 October 2026

The completion checkmarks below are inherited implementation claims, not verified acceptance results. Step 1 source audit found incomplete UI/API contracts, silent sample-data/success fallbacks, missing migrations, a session-storage mismatch and authorization/workflow gaps. See [IMPLEMENTATION_AUDIT.md](IMPLEMENTATION_AUDIT.md) for evidence, the acceptance baseline and the ordered delivery plan.

- [x] Step 1: read revised brief, inspect existing implementation and record gaps.
- [x] Step 2: establish a reproducible database/session/auth and verification foundation.
- [x] Step 3: complete submission, documents, correction/resubmission and scrutiny.
- [ ] Step 4: complete maturity monitoring and renewal/replacement workflows.
- [ ] Step 5: complete release/refund, remaining audit scope controls and reporting.
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

Initial database verification was blocked by Docker Desktop startup. This was resolved when the user opened Docker Desktop; no Docker internal files were modified.

### Step 2 database validation completed - 27 October 2026

- Both migrations applied successfully to fresh development and isolated test databases.
- An existing host PostgreSQL service owns port 5432. This project's development database now uses 127.0.0.1:5434; tests use 127.0.0.1:5433. Existing host database data and settings were not changed.
- Compose has database health checks and waits for readiness; database ports bind only to loopback.
- Seed verified with 8 institutions, 30 instruments (including 3 replacements), 7 accounts and 4 release requests. Seed calendar dates now use Asia/Kolkata, and seeding refuses a nonempty instrument database before rotating credentials.
- Local `.env` and generated demo credentials in `tmp/demo-seed-output.txt` are ignored by Git. Only the disposable demo database created in this session was rebuilt to validate the corrected seed.
- `npm run verify` passed again: lint, type checks, 24 unit/API boundary tests and production builds.
- `npm run test:integration` passed: 5 real PostgreSQL tests for persistent login/logout, CSRF, lockout, disabled accounts, institution isolation, immutable audit history and transaction rollback.
- A separate smoke check using two generated demo accounts passed login/session restoration, scoped lists, denied cross-institution detail access and logout against the seeded development database.

Step 2 is complete for the foundation scope. The application still has the workflow/UI gaps listed in the audit; inherited completion claims below are not evidence that the whole MVP passes. Next is Step 3: complete FDR submission, documents, correction/resubmission and scrutiny with real API responses and no silent fallback success.

### Step 3 submission and scrutiny checkpoint - 27 October 2026

- Registry, new/edit form, detail, scrutiny queue and discrepancies use real scoped API data. Empty responses clear results and failed writes remain errors. Login opens the working registry; dashboard and later modules remain scheduled.
- Shared validation rejects invalid calendar dates, nonpositive/oversized amounts, unsupported currency and arbitrary sorting fields. Edits require versions, validate merged fields and preserve omitted validity dates. Stale/concurrent writes conflict rather than overwrite.
- Evidence streams to private disk with extension/MIME/signature checks, parent/version/role/state authorization, failed-file cleanup and SHA-256 hashes. Replacements supersede metadata while retaining earlier files. Downloads reauthorize parents, hide storage keys and create audit events. Storage/scanner boundaries exist; scanning is unconfigured and labelled not scanned.
- Submission/resubmission capture all business values and evidence IDs/hashes/versions. Submission retries do not duplicate snapshots. Officers pick up submissions before recording outcomes. Flagging a discrepancy requests correction; institutions can respond but cannot resolve their own discrepancies.
- Completing scrutiny requires an outcome for the current submission, a completed document review, a reason and no unresolved discrepancies. Prior outcomes cannot cover corrected submissions. Demo evidence cannot claim authorized-source confirmation. Review, independent verification and lifecycle remain distinct.
- Detail supports edits, evidence replacement, discrepancy response/resolution, resubmission, review/rejection, original snapshots and a timeline including related evidence/review/discrepancy events. Rejected records stay terminal; a corrected-copy action creates a separate record.
- Notification response/routes and failure handling were reconciled so the shared layout no longer displays fabricated notifications.
- Browser check: seeded institution login, inline reversed-date validation, corrected draft save and inspection of the three provenance blocks passed. Full correction/review and denial scenarios use PostgreSQL API tests.
- All 10 database tests passed (5 foundation plus 5 submission tests with multiple workflow/security assertions). Final `npm run verify` passed: Prisma generation, lint, all type checks, 24 standard tests and production builds. Final `npm run test:integration` passed all 10 database tests. A Windows Prisma DLL lock was resolved by stopping the development server; README documents the requirement.

Remaining: Step 4 dashboard/maturity/renewal contracts and saved reminder settings; Step 5 full release UI, scoped global audit/reports and administrative completion; Step 6 composed UI redesign and responsive/accessibility polish; Step 7 full acceptance demonstration and measurements. Older slice checkmarks below are inherited claims.

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
