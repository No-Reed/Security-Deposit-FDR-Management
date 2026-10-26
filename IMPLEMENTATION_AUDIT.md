# DepositDesk implementation audit and ordered delivery plan

Audit date: 27 October 2026 (Asia/Kolkata).

## Scope and evidence

Step 1 is repository assessment against the original problem statement and the supplied 26-page **DepositDesk - Full Revised Implementation Brief, Revision 2**. The supplied FormKiQ image sets the visual direction. Existing useful work should be preserved.

This is a source inspection, not certification that the application works. No business code was changed during this step. Earlier README/PROGRESS completion claims are not acceptance evidence.

## Existing foundations worth preserving

- React/TypeScript/Vite frontend, Express/TypeScript API, shared Zod schemas and npm workspaces.
- Prisma models for institutions, staff scopes, instruments, snapshots, documents, verification, discrepancies, release requests, checklist configuration, notifications and audit events.
- Separate lifecycle, date, verification, renewal and release concepts; server-side date utility implements the stated date-status precedence.
- Many business transitions already check roles, institution access, versions and write audit events inside transactions.
- Private document delivery, signature/MIME checks, SHA-256 hashing and download audit logging exist.
- CSV sanitization includes formula prefixes, tabs and carriage returns.
- Seed uses synthetic institutions, .invalid addresses, generated passwords and relative dates, and refuses production execution.
- Existing screens and consistent badge components provide a starting point for UI improvement.

## Confirmed gaps, ordered by impact

This table is the initial audit baseline. Completed slices are recorded in follow-up sections below and in PROGRESS.md; unresolved rows remain subsequent work.

| Priority | Finding and source | Required correction |
| --- | --- | --- |
| P0 | `AuthContext.tsx` hardcodes demo mode, invents a logged-in user after any failed session request and accepts matching demo profiles after login failures. Pages also convert failed writes into local success. | Enforce real sessions. A 401/403/validation/server failure must remain a failure. Remove silent sample-data and simulated-success fallbacks from operational flows. |
| P0 | `schema.prisma` defines Session with id/userId/expiresAt, while `app.ts` uses connect-pg-simple's sid/sess/expire storage contract. No migrations are committed. | Add compatible session storage and reproducible initial migrations before claiming login or persistence works. |
| P0 | Prisma generates CUID identifiers, but shared creation/upload schemas require UUID identifiers. | Choose and consistently enforce one identifier format for schema, seed, requests and tests. |
| P0 | `buildInstrumentWhere` in instruments router replaces the authorized institution constraint with the supplied institution filter. | Intersect filters with permitted scope; test cross-institution query manipulation. |
| P0 | Instrument close lacks an institution access check. Audit listing does not restrict officer scope. Dashboard recent activity filters entity type but not institution scope. | Apply object authorization to closure and scope all audit/activity results. |
| P0 | Document upload has no role restriction preventing administrator uploads. When both parents exist, access checks on retrieval use only the first parent. Metadata includes internal storage fields. | Enforce the role matrix, validate parent consistency, and return safe document metadata. |
| P0 | Frontend and backend API contracts differ, including verification, renewal, release decisions, CSV exports and admin routes. | Reconcile methods, paths, payloads and response shapes; add API contract coverage. |
| P0 | Dashboard API returns nested summary fields unlike the frontend interface. Instrument detail returns verifications/documents/discrepancies with names and nested properties unlike the frontend types. | Define explicit shared response contracts and return exactly what screens consume, with money serialized as strings. |
| P0 | Instrument verify checks state/discrepancies but does not require completed document review and a recorded verification outcome. Resubmission snapshots omit several submitted fields. | Enforce review prerequisites and preserve complete original submission values and document references on each submission. |
| P0 | Release checklist mutation lacks input/version/state validation and a transactional audit event. No partial unique index enforces one open request. Submit/approve retry behavior is not idempotent. | Harden transitions and checklist updates, add database constraints, map conflicts to 409, and support safe retries. |
| P0 | No database trigger or migration enforces audit immutability. Some mutations, including release checklist updates, bypass the transaction/audit pairing. | Add database enforcement and test that mutation/audit either both commit or both roll back. |
| P0 | UI release workflow lacks the complete draft-submit-review-checklist-return/resubmit-forward sequence. Its decision method calls `/decision`, but backend has `/approve` and `/reject`. | Complete the entire UI/API workflow, preserve maker-checker enforcement, and keep approval separate from completion. |
| P0 | Renewal dialog is present but no createRenewal call is wired in the detail page. Client calls `/renew` while server exposes `/renewal`. | Implement creation, supporting evidence, review and visible predecessor/successor history. |
| P0 | Reminder job reads startup environment thresholds, not edited database settings. Escalation occurs immediately at one fixed level and queries all authorities. | Apply saved thresholds, timezone and escalation delay/cadence; notify only authorized recipients and test deduplication. |
| P0 | Date filtering runs after pagination and totals are computed before derived filtering. Several declared filters are not implemented. Dashboard renewalPending actually counts release requests. | Correct filters/counts before pagination and derive metrics from the dimension named. |
| P0 | Only two unit-test files exist. No API authorization/workflow tests or separate test-database harness exists. No ESLint configuration is committed. | Restore a reproducible verification pipeline and add meaningful coverage for all brief section 15 cases. |
| P1 | Uploads use memory storage and synchronous disk writes; extension is allowed independently of detected format. Version/supersession fields are not used for replacement evidence. | Stream privately, validate extension/MIME/signature agreement, support evidence version history and cleanup on failure; provide actual storage/scanner interfaces. |
| P1 | Institution, maturity, renewal tracking, notifications and About routes are missing (notifications currently use a dropdown). Admin save/settings/checklist flows are incomplete. | Add or consolidate functional screens so all required capabilities are reachable. |
| P1 | UI contains fabricated bank-confirmation evidence and policy-specific default text; frontend demo logins do not match seeded accounts. | Use visibly simulated verification, neutral configurable demo policy, seeded account instructions and accurate disclosures. |
| P1 | Environment loading/setup is incomplete; root .env example is not explicitly loaded by API startup. Test DB example uses 5432 while Compose test service exposes 5433. README omits full database setup. | Document and verify clean-checkout setup, migration/seed commands and separate test database configuration. |

P0 means required for a reliable MVP. P1 here means subsequent delivery order, not permission to omit required brief features. Optional email delivery, calendar, PDF reports, real scanning and object storage deployment can remain deferred with honest disclosures.

## Runtime baseline

This subsection records the initial inspection. The Step 2 follow-up below supersedes its environment blockers.

- Initial Git working tree was clean; no AGENTS.md was found in the repository or its immediate parent.
- `npm ci --no-audit --no-fund` was attempted. It failed with npm's `Exit handler never called!`; dependency installation is incomplete.
- `npm run verify` was attempted and stopped at lint because `eslint` was unavailable. Typecheck, tests and build did not run through this command. Missing lint configuration is an additional source-confirmed setup gap.
- Docker CLI is available, but `docker info` cannot connect to the Docker Desktop Linux engine. No listening PostgreSQL service was found on ports 5432/5433.
- Database migration, seed, session and end-to-end behavior remain unverified. No claim of a passing build, test suite or successful workflow is made.

### Step 2 follow-up validation

Docker is now available. Fresh migrations and seed were exercised successfully. Development uses loopback port 5434 because an existing host PostgreSQL service owns 5432; test data remains separate on port 5433. The corrected seed produces 8 institutions, 30 instruments, 7 accounts and 4 release requests with India-calendar-relative dates. A second seed refuses populated instrument data before modifying credentials.

`npm run verify` passes (24 tests, lint, type checks and production build), and `npm run test:integration` passes all 5 PostgreSQL authentication/isolation/audit tests. Two real seeded institution accounts also passed session restoration, scoped lists, denied cross-institution access and logout in a development-database smoke check. Step 2's foundation is verified; the broader module/acceptance gaps above still require their subsequent slices.

### Step 3 follow-up validation

Submission, correction and scrutiny are now real database-backed workflows. The registry, creation/edit form, detail, scrutiny queue and discrepancy list no longer fabricate data or successful mutations on request failure. Instrument/document response contracts match the screens. Private streamed uploads validate extension/MIME/signature, parent access and record versions; earlier evidence remains available after explicit supersession. Complete snapshots preserve submitted business values and evidence references.

Server controls now enforce officer pickup, current-submission review outcomes, unresolved discrepancy blocking, institution response without self-resolution, terminal rejection, versioned mutations and honest demo verification. Related evidence/review/discrepancy audit events appear in the authorized record timeline. Browser checks cover login, inline date validation, real draft save and provenance display; PostgreSQL tests cover the complete correction-to-verification cycle and unauthorized/stale/invalid requests. Standard verification and database test results are recorded in PROGRESS.md.

The global audit/report scope gaps, dashboard/maturity/reminder configuration, renewal and release UI, remaining administration and composed visual redesign still require their planned steps. The registry currently derives date filtering across the scoped prototype dataset before pagination; scaling that calculation into database queries is future work.

## Ordered implementation steps

1. **Assessment (this step):** identify reusable code, confirmed defects, runtime prerequisites and acceptance coverage.
2. **Reliable foundation:** repair installation/verification tooling, database/session schema and migrations, identifier consistency, environment handling, seed/login documentation and separate test DB. Prove real login/logout and institution isolation.
3. **Submission and scrutiny:** repair contracts, remove silent fallbacks, complete draft/edit/upload/submit/correct/resubmit/review/verification, preserve snapshots and evidence. Prove through UI/API with durable records.
4. **Maturity and renewal:** correct filtering/dashboard counts, apply saved settings, scoped reminders/escalation and linked replacement workflow. Prove date boundaries and repeat-run behavior.
5. **Release and accountability:** complete request/checklist/decision/completion flows, database constraints, audit immutability and scoped reports. Prove denial cases and concurrent/repeated actions.
6. **UI and navigation:** apply the supplied visual direction to working modules, complete required screens, responsive states and keyboard access.
7. **Acceptance:** execute all 16 criteria in brief section 14, complete the demo walkthrough, update truthful setup/limitations and record measurements.

Run the verification command before marking an implementation slice complete. A blocked database test remains unverified, never a pass. Do not reset existing data without confirming the target is an isolated demo/test database.

## Visual direction from the supplied image

Use DepositDesk branding, a light neutral canvas, compact persistent sidebar, restrained orange highlights for primary actions/selected navigation, clear search/filter controls, compact tables, soft dimension-specific badges, and a selected-record detail panel with tabs and an action timeline. Use adequate contrast and responsive navigation at 375, 768 and 1280 px. The sample's promotional text outside the app is not part of the portal layout. The user's image preference takes precedence over the brief's default navy/blue accent suggestion.

## Acceptance baseline (brief section 14)

| Criteria | Current assessment |
| --- | --- |
| 1 and 10: login, role/scope isolation and IDOR protection | Blocked by session contract; source-confirmed authorization gaps. |
| 2 and 3: real submission, correction and scrutiny | Partial backend; identifier, contract and UI gaps prevent a complete flow. |
| 4: distinguish submitted/reviewed/independently confirmed facts | Status concepts exist; sample confirmation and detail contract need correction. |
| 5 and 6: dates and idempotent reminders | Date helper/unit tests exist; dashboard/filter/settings/escalation and DB tests remain. |
| 7: linked replacement and retained history | Backend foundation exists; UI wiring and API path are incomplete. |
| 8 and 9: release request through decision and completion | Backend foundation exists; full UI path and integrity controls remain. |
| 11: audit every important mutation | Partial transactional logging; missing mutation coverage and database enforcement. |
| 12: real search/filter/pagination/export | Implemented partially; contract, scope and derived-filter defects remain. |
| 13: invalid transitions rejected | Many checks exist; missing prerequisites, concurrency and retry tests remain. |
| 14: loading/error/empty states and responsive UI | Silent fallback behavior conflicts with reliable errors; visual/browser checks pending. |
| 15: clean setup including migrations/seed | Not satisfied: migrations absent and installation/database baseline blocked. |
| 16: complete core tests and passing verify | Not satisfied: limited unit coverage; verification did not reach tests/build. |

Prototype improvement measurements should record submission completeness/accuracy, verification turnaround, reminders generated on time, remaining overdue cases and manual tracking steps. No improvement percentages should be invented.
