# DepositDesk — PROGRESS.md

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
