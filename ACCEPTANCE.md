# DepositDesk MVP acceptance record

Checked 27 October 2026 on branch `codex/depositdesk-foundation` against the supplied revised brief and original problem statement. This records prototype evidence, not regulatory or production certification.

## Automated verification

`npm run verify` passes Prisma generation, lint, all workspace TypeScript checks, **26 unit/API boundary tests**, **22 PostgreSQL integration tests**, and shared/API/web production builds. Integration tests reset only the separate loopback `depositdesk_test` database. Expected Prisma error messages in negative tests prove immutable audit rejection, stale versions and deduplication; the suite exits successfully.

A separate subprocess test verifies that the seed refuses production before a database connection. Re-running the seed against a populated seed-check database also refused before credential changes.

The integration suites are `auth.integration.test.ts`, `submission.integration.test.ts` and `workflows.integration.test.ts`. They exercise persistent sessions, scopes/IDOR, CSRF and lockout; invalid fields/duplicates; upload type/signature/size/private access; correction snapshots/evidence supersession; scrutiny prerequisites; live reminder settings/cadence/deduplication; linked replacements/new reminders; full release lifecycle; required-checklist approval; maker-checker across role changes; optimistic versions/concurrency; scoped audit/reports/notifications; and administrative permissions.

## Traceability to the brief, section 14

| # | Acceptance criterion | Evidence |
| --- | --- | --- |
| 1 | Sign-in and role/institution scope | Auth/API tests; two-institution browser/session smoke checks from the foundation slice; current browser review under institution, two officers, authority and administrator. |
| 2 | Draft, permitted evidence, validation and submission | Submission integration cycle; earlier browser draft/validation check; current private synthetic fixtures parse as valid PDFs. |
| 3 | Queue, observations, discrepancy, correction and review | Submission integration cycle; working scrutiny/discrepancy/detail screens. |
| 4 | Submitted information, document review and independent verification remain distinct | Detail Overview/Verification blocks and separate badges; demo outcomes cannot claim bank confirmation. |
| 5 | Derived maturity dashboard/list | IST boundary tests, saved-setting tests and matching dashboard/filter counts; seeded browser dashboard shows approaching deadlines. |
| 6 | Scheduled/on-demand reminders without duplicates | The same tested job powers cron and admin action; exact thresholds and delayed repeating scoped escalation tests; browser on-demand runs produced 15 reminders then 0. |
| 7 | Linked replacement preserves history | Renewal API tests and browser-created replacement draft with visible predecessor link; original history retained. |
| 8 | Institution release submission and tracking | Release API tests cover evidence/submission; browser institution release tracking/detail. |
| 9 | Reasoned review/return/decision and separate evidenced completion | Full release API tests; browser assigned-officer checklist/forward, authority approval, then completion with reference/date/notes. |
| 10 | IDOR protection for instrument/document/release | Tests deny cross-institution access, scope-filter manipulation, downloads and release access. |
| 11 | Important mutations audited | Transactional business/admin changes, notifications and report-export events; audit immutability/rollback tests; scoped audit/activity views. |
| 12 | Real search/filter/pagination/CSV | Database tests and browser registry/report review; completed-release CSV downloaded and contained `DEMO-BROWSER-COMPLETE-001`. |
| 13 | Invalid transitions rejected | Tests assert 403/409/422, stale versions, incomplete checklist, missing evidence, maker-checker and concurrent creation/closure. |
| 14 | Empty/loading/error states and responsive UI | Explicit feedback/retry/empty states; browser checks at 375, 768 and 1280 px, mobile navigation focus, contained table scrolling and selected-record panel. |
| 15 | Reproducible migrations and seed/setup | All three migrations deployed to a new isolated seed-check database; revised seed produced 8 institutions, 30 instruments, 12 accounts and 31 private synthetic PDFs. Locked dependencies were installed in the foundation slice. An independent clean-clone run on a teammate machine remains the recommended portability check. |
| 16 | Core tests and verification | Combined `npm run verify` includes both suites and production build, rather than omitting the database tests. |

## Browser observations and synthetic measurements

- Institution dashboard initially showed 7 scoped instruments, 6 with evidence and 0 non-draft records missing evidence; this is synthetic seed quality, not an authenticity claim.
- Monitoring check on the seed-check database: 26 records checked, 15 reminders, 0 escalations. Immediate repeat: 26 checked, 0 reminders, 0 escalations.
- Officer Rahul completed a required item and forwarded `RR-DEMO-0032`; Officer Priya could view that scoped request but could not change another assigned officer's review.
- Authority Anita approved with a reason; completion remained a separate action. Completion reference `DEMO-BROWSER-COMPLETE-001`, evidence date and synthetic notes appeared in the case/timeline and CSV.
- Institution user saved `DEMO-BROWSER-REPLACEMENT-001`; its Related records panel linked to the unchanged original.
- Desktop sidebar/compact table/preview/timeline and mobile/tablet navigation follow the supplied visual reference. Wide tables scroll within their cards. Screenshots from local review are under ignored `tmp/`.
- There is no real manual-processing baseline, so no percentage improvement, authenticity guarantee or real-world turnaround reduction is asserted. Review intervals use stored timestamps and may describe fabricated seed history.

## Teammate handoff

1. Review the uncommitted completion changes and the additive migration; the earlier three slices are already committed on this branch. No push or commit was performed for this completion batch.
2. Follow README setup with your own `.env` secret. Fresh databases can seed; existing populated databases should migrate without reseeding. Generated passwords, private evidence and local `.env` are excluded from Git.
3. Run `npm run verify` with the Docker test database available and the development API stopped on Windows. Follow the README role-by-role demo using synthetic files.
4. Test deployment portability and domain-policy wording with the team before any real data or authorized operational rollout.

## Explicit limitations

Required P0 prototype workflows are implemented. Optional/live services are not configured: bank/AICTE/payment operations, real email delivery, calendar/PDF reports, malware scanning, object storage and external identity. The UI labels synthetic data, administrative verification, unscanned uploads and separate completion honestly. Date-derived filtering/audit scope expansion happens over the authorized prototype dataset; large-scale query/index tuning is future work. Production requires least-privilege database credentials without schema ownership, HTTPS, backups/retention, storage/scanning operations, monitoring and domain-approved eligibility/checklist policy.
