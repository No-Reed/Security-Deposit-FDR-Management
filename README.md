# DepositDesk - Security Deposit & FDR Management

Prototype for AICTE problem statement **26265**. This is not an official AICTE service. No live bank verification, payment, bank instruction or real-world release is performed.

## Implementation status

The core prototype now has database-backed submission and scrutiny, scoped dashboard/registries, maturity reminders and escalations, linked replacements, release/refund requests through review/decision/completion, secure evidence history, scoped audit/CSV reports, notifications and administration. The interface follows the supplied case-management reference with orange accents, compact navigation/tables, filters and a selected-record preview.

See [ACCEPTANCE.md](ACCEPTANCE.md) for verification evidence, remaining deployment limitations and teammate checks. [IMPLEMENTATION_AUDIT.md](IMPLEMENTATION_AUDIT.md) preserves the original assessment; [PROGRESS.md](PROGRESS.md) records delivery status. This is a synthetic-data MVP, not a production or regulatory certification.

## Requirements

- Node.js 22.15 or later in the Node 22 line (or a newer supported Node release).
- npm 10+.
- PostgreSQL 16. Docker Desktop with a working Linux engine is the provided local option.

## Local setup (PowerShell, repository root)

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

Generate a local session secret and put it in `.env` as `SESSION_SECRET`; never commit it:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

The workspace commands load the root `.env`. Existing process environment variables take precedence. The example connects development to localhost:5434/depositdesk and tests to localhost:5433/depositdesk_test. Both Docker ports bind only to 127.0.0.1. Development uses 5434 to avoid an existing local PostgreSQL service on 5432.

```powershell
docker compose up -d --wait db db-test
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

Open http://localhost:5173. The API listens on http://localhost:4000 and the frontend proxies `/api` to it. A fresh database is required for initial migration deployment. Do not apply these migrations blindly to a populated database created outside the migration history; back up and plan a baseline first.

Seeding creates eight synthetic institutions, 30 instruments (including three replacement records) and twelve accounts, prints a different generated password for each account once, and refuses production execution. `DEMO_PASSWORD` may be supplied locally before seeding; there is no committed/default password. The seed refuses a nonempty instrument database before changing credentials. Use reset only for disposable local demo data. Seed dates use the current calendar date in Asia/Kolkata. The seed also creates private PDF fixtures explicitly marked synthetic, complete submission snapshots and captured release checklists. Existing populated databases are preserved; apply migrations without reseeding.

| Role | Seeded email |
| --- | --- |
| Institution A | vikram@sunrise.invalid |
| Institution B | meera@coastal.invalid |
| Institution C | sanjay@hillside.invalid |
| Northern institution | registrar@northern.invalid |
| Southern institution | registrar@southern.invalid |
| Eastern institution | registrar@eastern.invalid |
| Central institution | registrar@central.invalid |
| Western institution | registrar@western.invalid |
| Scrutiny Officer | officer.priya@depositdesk.invalid |
| Scrutiny Officer | officer.rahul@depositdesk.invalid |
| Approving Authority | authority.anita@depositdesk.invalid |
| System Administrator | admin@depositdesk.invalid |

Sign in with an email above and its password from the seed output. To change roles, sign out and sign in to a different account. Browser-selected roles cannot authenticate users. A failed login does not grant offline access.

## Verification

On Windows, stop the local development server before running commands that regenerate Prisma's client (`verify`, migrations and integration tests). A running API holds the query-engine DLL open and can prevent generation.

```powershell
npm.cmd run verify
```

This generates Prisma's client, lints all workspaces, checks TypeScript, runs unit/API tests and real PostgreSQL workflow tests, then builds API/frontend production output. Start `db-test` and configure `DATABASE_URL_TEST` first. Prisma's first generation needs access to its runtime download host. Verification resets only the isolated test database; it preserves development data.

To run the database workflow tests separately:

```powershell
npm.cmd run test:integration
```

This command **resets only a separate local database named depositdesk_test**, deploys migrations and runs API tests. It refuses production, nonlocal targets, other database names and a matching development database. It never resets the development database. Integration coverage includes authentication and audit integrity plus the complete submission/correction/scrutiny cycle: version conflicts and concurrent edits, invalid/oversized/forged uploads, authorized downloads, document supersession, original/resubmitted snapshots, demo verification, terminal rejection, and search/pagination. Test uploads are isolated under `tmp/test-uploads`.

Unit tests include date-status precedence, midnight IST boundaries, CUID validation, submission validation, renewal/release helpers and CSV formula neutralization. `npm run test` runs the fast unit/API boundary suite; `npm run verify` includes both suites. Database tests additionally cover reminders, escalation cadence, renewal chains, release checklist/decisions/completion, maker-checker, concurrent requests/closure, scoped exports and administration.

To build and run compiled output:

```powershell
npm.cmd run build
npm.cmd run start -w apps/api
```

`start` runs the API; host `apps/web/dist` through an appropriately configured web server for deployment. Production requires `NODE_ENV=production`, `DEMO_MODE=false`, a non-placeholder session secret of at least 64 characters, HTTPS and deployment-specific database/storage configuration. Production readiness is not claimed.

## Submission and scrutiny walkthrough

1. Sign in as an institution user. Open **Register instrument**, enter details and attach a synthetic PDF/JPG/PNG. Use **Save draft** or **Save and submit**. A saved draft can be resumed from the registry. Failed uploads/submissions retain entered values and link to the saved draft.
2. Sign out and sign in as a scoped Scrutiny Officer. Open **Scrutiny Queue**, choose the record, then **Start review**. The overview keeps institution-submitted details, document review and independent verification separate.
3. Under **Discrepancies**, enter a description, reason and severity. **Flag discrepancy** records the observation and requests institution corrections. Alternatively, an officer can request correction with an observation from Overview.
4. As the institution user, edit the returned record, upload replacement evidence from **Documents** (select the previous document to supersede), and send a discrepancy response. Under Overview enter a correction summary and **Resubmit corrections**.
5. As the officer, **Start review** again. Review the response and **Resolve** or **Dismiss** the discrepancy with notes. Under **Verification**, choose **DEMO_SIMULATED** for synthetic evidence, enter review notes and **Save review outcome**. Then under Overview enter a decision reason and **Finish scrutiny**.
6. Inspect **History** for both original and corrected submission values, the exact evidence versions and the action timeline. Superseded documents remain downloadable by authorized users. A rejected instrument stays terminal; **Create corrected copy** starts a separate record without changing the original.

`VERIFIED` means this administrative scrutiny step completed; independent verification remains a separate status. Demo mode refuses claims of authorized-source confirmation. A completed review outcome for the current submission and no unresolved discrepancies are required before scrutiny can finish. No live bank verification or actual financial release occurs.

The current registry derives date filters before paginating the authorized dataset; this is suitable for the small prototype dataset. Large-scale database-side filtering remains future work.

## Five-minute team demo

Use synthetic records/files only. Sign out between roles; passwords come from your local seed output.

1. **Institution user:** show the demo banner, own-institution registry and denied cross-institution URL. Register an instrument, show issue-after-maturity validation, correct it, attach a synthetic PDF and submit.
2. **Scoped officer:** open Scrutiny, start review, inspect the separate submitted/document/independent-verification blocks. Flag a discrepancy with a reason; the institution receives an action-required record.
3. **Institution then officer:** correct and resubmit, then resolve the discrepancy and save a DEMO_SIMULATED review outcome. Finish scrutiny with notes. Inspect the original/corrected snapshots and evidence versions in History.
4. **Dashboard and reminders:** follow an approaching-deadline card to the matching filtered registry. As administrator, run the maturity check twice; inspect in-app notifications to show deduplication. Saved thresholds and escalation intervals apply on the next read/run. Scheduled checks run daily at 06:00 Asia/Kolkata while the API is running.
5. **Replacement:** as institution user, open a matured record → Related records → Create replacement. Save/submit the new evidence through its own scrutiny flow. The predecessor remains intact and links both ways.
6. **Release:** on a VERIFIED record with no current/completed release, create a request, add supporting evidence and Submit. As officer, Start review, check required captured items, add notes and Forward; optionally Return for information, then institution Resubmit. Resubmission/evidence changes reset the review checklist.
7. **Authority:** open the forwarded request, approve or reject with a reason. Approval alone does not mark it completed. A scoped officer/authority records a separate completion reference, calendar date and notes. This records synthetic external evidence; it performs no financial action.
8. **Audit/export:** inspect the scoped timeline and audit log, download a CSV report. Administrators can manage accounts, institution mappings, staff scopes, reminders and demo checklist configuration; they cannot make business decisions.

## Prototype measurements

Dashboard quality indicators use persisted records: evidence coverage, unresolved discrepancies and recorded review intervals. A new submission snapshot preserves exact submitted values, rather than claiming that document contents are authentic. Record reminder counts on the first and repeated check, overdue cases, and the number of manual tracking steps during the demo. There is no real-world manual baseline here, so no percentage improvement or guaranteed turnaround is claimed. See [ACCEPTANCE.md](ACCEPTANCE.md) for reproducible synthetic checks.

## Reset disposable local demo data

```powershell
npm.cmd run db:reset -- --confirm-local-demo-reset
```

This deletes and recreates only the local database named depositdesk outside production, then seeds it. It is never required for normal application startup. The explicit flag acknowledges data deletion; remote and production targets are refused.

## Foundation behavior and limitations

- Sessions use connect-pg-simple's `sid`, `sess` and `expire` columns and are saved before login succeeds. Cookies are HTTP-only, SameSite=Lax, and Secure in production. Mutations require a CSRF token.
- Passwords use Argon2id; repeated failed attempts lock the account temporarily. Session identity is reloaded from the database so disabled users lose access.
- Prisma-generated CUIDs are validated consistently in shared request schemas.
- Database migrations enforce one open release request, positive instrument amounts, issue/maturity ordering, document parent presence and append-only audit events. Normal app credentials must not own schema/DDL privileges in deployment.
- Business changes pair audit events with their database transactions. Captured release checklists cannot be bypassed at approval; a reviewer cannot decide the same request even after a role change.
- Real bank/AICTE integration, email delivery, scanning integration, PDF reports, calendar view and object storage deployment are not implemented. Uploads use private local storage and are labelled not malware-scanned.
- The implemented UI follows the supplied case-management reference: light surfaces, orange accents, sidebar navigation, compact filtered tables, status badges and tabbed detail/timeline panels.

## Troubleshooting

If Docker cannot connect, first confirm Docker Desktop's Linux engine is running. A Docker Desktop startup failure prevents database-backed checks; do not replace failed API calls with simulated successes. If installation or Prisma generation cannot download dependencies, restore network access and rerun the command. Never report blocked database tests as passed.

Database backup/retention, least-privilege deployment roles, authorized verification access and validated AICTE policy remain deployment/domain-expert responsibilities. Current checklist content is demo policy, not an assertion of applicable regulation.
