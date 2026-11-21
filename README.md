# PaySplit

PaySplit automatically splits an incoming salary into savings wallets and bank transfers to other people, based on rules the user defines (fixed amounts and/or percentages, in priority order).

Built for the Talent Nation Full Stack Engineer assessment. All integrations are real sandboxes: **Flutterwave** (collection accounts, pay-ins, transfers, webhooks), **Dojah** (BVN/NIN + selfie liveness) and **Brevo** (transactional email). No real money moves.

- Live app: https://paysplit-sigma.vercel.app
- Demo video: https://drive.google.com/file/d/1loSh4Px8I1ngM_Jgql_6TG_XPheaT2iH/view?usp=sharing
- Why each tool was chosen: [docs/TOOL-CHOICES.md](docs/TOOL-CHOICES.md)

---

## What it does

1. **Sign up → verify email → onboarding.** The user sets up wallets, beneficiaries and split rules straight away; none of that needs KYC.
2. **KYC** (Dojah): BVN or NIN lookup, then a selfie checked for liveness and matched against the identity record. Until KYC is approved, the user cannot move money; this is enforced on the server, not just hidden in the UI.
3. **Collection account** (Flutterwave): each user gets a dedicated virtual account number. Salary lands there.
4. **Salary arrives** → the pay-in is verified with Flutterwave, credited in the ledger, and the split runs automatically for that pay-in.
5. **Split execution**: wallet allocations happen instantly in the ledger; beneficiary allocations become Flutterwave transfers whose final status comes back by webhook.
6. **Run now**: a user can manually split any unallocated funds in their salary account, with a preview first.
7. **Rule options**: each rule can run on every inflow, only on inflows above a minimum, or only on inflows from a named sender (matched against the payer name Flutterwave reports); and either on every inflow or until a monthly target is reached.
8. **History**: transactions list with filters, per-transaction detail, PDF receipts, CSV/PDF statements, notifications (in-app + email), data export.
9. **Analytics**: monthly salary, savings and transfer totals with month-on-month change.
10. **Admin panel**: overview, Manage Users (with **Pay salary**, which sends a sandbox salary through the real Flutterwave checkout and verification flow), user detail and settings with integration status.

## Architecture

Next.js 15 App Router serves both the web app and the API (route handlers under `src/app/api`). Postgres (Neon) via Prisma. Deployed on Vercel with a daily Vercel Cron job.

```
src/
  core/                 Pure domain logic, no I/O
    money.ts            bigint minor units (kobo), parsing/formatting, basis points
    split-engine.ts     allocation algorithm (+ split-engine.test.ts)
  server/
    ledger.ts           double-entry ledger: post(), balances
    money-service.ts    pay-ins, split execution, transfers, retries, reconciliation
    providers/
      types.ts          PaymentProvider / VerificationProvider ports + normalized statuses
      index.ts          region router: picks adapters by user country
      flutterwave.ts    payment adapter
      dojah.ts          Nigerian KYC adapter
    auth.ts, ratelimit.ts, notify.ts, documents.ts, validation.ts, ...
  app/
    (auth)/  (app)/  admin/   pages
    api/                      route handlers
prisma/                 schema + migrations (incl. ledger DB triggers)
scripts/                seed-admin, smoke-money (end-to-end money check against sandbox)
```

**Provider-agnostic core.** `core/`, `ledger.ts` and `money-service.ts` never import a vendor. They talk to `PaymentProvider` and `VerificationProvider` interfaces with normalized statuses (`PENDING / SUCCESS / FAILED` for transfers; `IN_PROGRESS / PENDING_REVIEW / APPROVED / REJECTED / ACTION_REQUIRED` for KYC). `providers/index.ts` routes by country: `NG → Dojah`. An international adapter (e.g. Persona or Didit) is one new file plus one line in the router.

## How the money stays correct

**Money representation.** Every amount is a `bigint` in kobo (`BigInt` columns in Postgres). Percentages are stored as integer basis points (`1250` = 12.5%). There are no floats anywhere in the money path.

**Allocation engine** ([src/core/split-engine.ts](src/core/split-engine.ts)), a pure function:
- Rules run in priority order (1 = highest); ties are broken by creation time, then id, so the order is deterministic.
- Percentages are taken of the **original salary**, not of what's left.
- Percentages round **down** to the kobo, so the total can never exceed the salary.
- A rule that can't be fully funded is **skipped**, never partly paid; later, smaller rules still run.
- Anything not allocated stays in the salary account.
- A rule whose inflow condition doesn't match is skipped with a reason. Manual runs have no inflow, so conditional rules are skipped there.
- Monthly-target rules are capped at what's left of their target this month, then skipped once it's reached.

**Double-entry ledger** ([src/server/ledger.ts](src/server/ledger.ts)):
- Accounts: user salary, user wallets, cash at provider, transfers in flight.
- Every ledger transaction must sum to zero. This is checked in code **and** by a deferred Postgres constraint trigger at commit.
- Ledger entries are immutable (a trigger rejects `UPDATE`/`DELETE`). Corrections are new reversing transactions.
- Balances are always computed from entries, never stored.
- Each posting has a unique business `reference`, so posting the same event twice does nothing.

Money flow: pay-in `cash → salary`; wallet split `salary → wallet`; transfer `salary → in-flight`, then on success `in-flight → cash` or on failure `in-flight → salary` (refund).

**No double runs, no double payments:**
- A pay-in is unique on `(provider, providerRef)`, so a webhook delivered three times creates one pay-in.
- An automatic split has idempotency key `auto:<payinId>`, giving exactly one split per salary. Run Now uses a client-generated key, so a double click is one run.
- All money work for a user runs under a Postgres advisory lock (one at a time per user).
- Funds are moved to "in flight" when a transfer is created, so a later run can't spend money already committed.
- Transfers use a unique reference that Flutterwave also enforces. Before any retry the provider is asked for the status of that reference, and the transfer is only re-sent if the provider has no record of it. Timeouts are treated as "unknown", not "failed".
- Webhooks are signature-checked, stored once per event id, and **not trusted on their own**: pay-ins are re-verified with the Flutterwave API, and transfer status is re-fetched by reference.

**Scheduling and reconciliation.** Splits run when salary actually arrives (per pay-in) rather than on a fixed date, because a calendar split could run before the money is there. A daily Vercel Cron job (`/api/cron/reconcile`, protected by `CRON_SECRET`):
- re-checks stale pending transfers against the provider;
- runs any missed automatic splits (pay-ins without one, e.g. if the webhook processing failed or KYC was approved later);
- checks the whole ledger nets to zero and that "in flight" equals the sum of open transfers, logging any mismatch;
- sends "salary expected soon" reminders, based on the user's salary day and time zone.

## Security

- Sign-up requires accepting the Terms of Use and Privacy Policy (stored with a timestamp). "Remember me" gives a 7-day session; otherwise the session ends with the browser (12-hour server limit).
- Passwords hashed with bcrypt (cost 12). Changing the password in Settings requires the current one and signs out other sessions. Sessions are random tokens stored as SHA-256 hashes, sent in an `httpOnly`, `secure`, `SameSite=Lax` cookie, and can be revoked.
- Server-side checks on every route: signed in → email verified → KYC approved for money actions. Every query is scoped to the current user's id. Admin routes need the `ADMIN` role.
- All input validated with Zod.
- Rate limiting backed by Postgres (works across serverless instances) on login, register, password reset, resend verification, KYC, account resolution, beneficiary creation, account provisioning and Run Now.
- PII: raw BVN/NIN is never stored (only a masked value); beneficiary account numbers are masked in emails; logs never contain request bodies or identity numbers.
- Audit log for logins, rule changes, splits, KYC, admin pay-ins and reconciliation runs.
- Secrets live only in environment variables, read in server-only code.

## Running locally

Requirements: Node 20+, pnpm, a Postgres database (a free Neon project works), and sandbox accounts for Flutterwave, Dojah and (optionally) Brevo.

```bash
pnpm install                      # also runs prisma generate
cp .env.example .env              # fill in values
pnpm prisma migrate deploy        # create tables + ledger triggers
pnpm tsx --env-file=.env scripts/seed-admin.mts   # admin from ADMIN_EMAIL / ADMIN_PASSWORD
pnpm dev                          # http://localhost:3000
```

Without Brevo keys, emails (including the verify-email link) are printed to the terminal.

Checks:

```bash
pnpm test        # split engine unit tests (Vitest)
pnpm lint
pnpm tsx --env-file=.env scripts/smoke-money.mts   # end-to-end money check: real DB + Flutterwave sandbox
```

The smoke script sends the same pay-in three times concurrently, then checks there is exactly one pay-in and one split. It also checks a skipped rule, that two Run Now calls with the same key give one run, and that the ledger nets to zero.

### Sandbox test data

| What | Value |
|---|---|
| Dojah BVN | `22222222222` |
| Dojah NIN | `70123456789` |
| Flutterwave test card (admin test pay-in) | see Flutterwave's test cards docs |
| Flutterwave test beneficiary | Access Bank (`044`), `0690000031` |

In the sandbox, Dojah returns fixed test identities, so a name mismatch is shown but does not block verification.

Flutterwave sandbox limits:
- Card pay-ins are capped at **₦50,000** per charge.
- Test pay-ins do not fund the merchant payout balance. Top up the test balance in the Flutterwave dashboard (test mode → Balances), otherwise transfers fail with "Insufficient funds in customer wallet". The app handles that failure by returning the money to the salary account.
- Webhooks can't reach `localhost`. Locally, transfer statuses are updated by calling the reconcile job: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reconcile`.

## Deploying (Vercel)

1. Push the repo to GitHub and import it in Vercel.
2. Add every variable from `.env.example` in Project Settings → Environment Variables. Set `APP_URL` to the Vercel URL.
3. Deploy. The build runs `prisma migrate deploy` then `next build`.
4. In Flutterwave (test mode) → Settings → Webhooks, set the URL to `https://<your-app>/api/webhooks/flutterwave` and the secret hash to `FLW_WEBHOOK_HASH`.
5. The cron in `vercel.json` runs daily at 05:00 UTC (06:00 Lagos). Vercel sends `CRON_SECRET` automatically.
6. Seed the admin account against the production database with the command above.

## Known limitations and next steps

- **International KYC**: the router and interface are ready, but only the Nigerian (Dojah) adapter exists.
- **Tests**: the split engine has unit tests; the ledger, idempotency and webhook paths are covered by the smoke script against the real sandbox rather than automated integration tests.
- **API docs**: no OpenAPI spec yet.
- **Error tracking**: structured JSON logs only, no Sentry.
- **MFA**: not implemented.
- **Cron frequency**: Vercel's free plan allows one cron run per day, so a stuck transfer can wait up to a day for reconciliation. Webhooks normally resolve transfers within seconds.
- **Email deliverability**: the demo sends from a Gmail address, so mail may land in spam. A real deployment needs an authenticated domain.
