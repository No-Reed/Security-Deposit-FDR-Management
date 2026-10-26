# DepositDesk - Security Deposit & FDR Management

Prototype for AICTE problem statement **26265**. This is not an official AICTE service. No live bank verification, payment, bank instruction or real-world release is performed.

## Implementation status

This repository contains useful UI/API foundations, but the complete administrative lifecycle is still under repair. The original completion claims were not supported by end-to-end tests. Read [IMPLEMENTATION_AUDIT.md](IMPLEMENTATION_AUDIT.md) and [PROGRESS.md](PROGRESS.md) for the remaining work.

The foundation and submission/scrutiny slices now support real sessions, validated drafts and corrections, private document upload/download, complete submission snapshots, officer pickup, discrepancies and responses, resubmission, recorded review outcomes and scrutiny decisions. Registry, detail, submission, scrutiny and discrepancy screens use real API records with visible loading/error/retry states. They no longer substitute sample records or successful writes when requests fail.

Dashboard/maturity/renewal tracking, release-request UI, reports and administration still need their remaining workflow/contract repairs. The complete MVP is not yet accepted. Signing in opens the working registry. The full case-management visual redesign remains a later step.

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

Seeding creates eight synthetic institutions, 30 instruments (including three replacement records) and seven accounts, prints a different generated password for each account once, and refuses production execution. `DEMO_PASSWORD` may be supplied locally before seeding; there is no committed/default password. The seed refuses a nonempty instrument database before changing credentials. Use reset only for disposable local demo data. Seed dates use the current calendar date in Asia/Kolkata.

| Role | Seeded email |
| --- | --- |
| Institution A | vikram@sunrise.invalid |
| Institution B | meera@coastal.invalid |
| Institution C | sanjay@hillside.invalid |
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

This generates Prisma's client, lints all workspaces, builds shared types, checks TypeScript, runs unit tests, and builds API/frontend production output. Prisma's first generation needs access to its runtime download host. Passing this command does not imply database tests or the entire MVP pass.

For real database-backed authentication tests, first start `db-test` above and configure `DATABASE_URL_TEST` in root `.env`:

```powershell
npm.cmd run test:integration
```

This command **resets only a separate local database named depositdesk_test**, deploys migrations and runs API tests. It refuses production, nonlocal targets, other database names and a matching development database. It never resets the development database. Integration coverage includes authentication and audit integrity plus the complete submission/correction/scrutiny cycle: version conflicts and concurrent edits, invalid/oversized/forged uploads, authorized downloads, document supersession, original/resubmitted snapshots, demo verification, terminal rejection, and search/pagination. Test uploads are isolated under `tmp/test-uploads`.

Unit tests include date-status precedence, midnight IST boundaries, CUID validation, submission validation, renewal/release helpers and CSV formula neutralization. Integration tests are intentionally excluded from the unit command and must be reported separately.

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
- Some later workflow audit/authorization checks remain incomplete; a database trigger alone does not make the product secure or compliant.
- Dashboard/maturity contracts, reports, release UI, renewal UI, saved reminder settings and UI redesign remain scheduled. Real bank/AICTE integration, email delivery, scanning integration, PDF reports and object storage deployment are not implemented.
- The intended UI follows the supplied case-management reference: light surfaces, orange accents, sidebar navigation, compact filtered tables, status badges and tabbed detail/timeline panels.

## Troubleshooting

If Docker cannot connect, first confirm Docker Desktop's Linux engine is running. A Docker Desktop startup failure prevents database-backed checks; do not replace failed API calls with simulated successes. If installation or Prisma generation cannot download dependencies, restore network access and rerun the command. Never report blocked database tests as passed.

Database backup/retention, least-privilege deployment roles, authorized verification access and validated AICTE policy remain deployment/domain-expert responsibilities. Current checklist content is demo policy, not an assertion of applicable regulation.
