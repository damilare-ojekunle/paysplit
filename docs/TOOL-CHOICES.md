# Tool choices

Every tool below is free to use for this project. The main constraints were: one week, one developer, real sandbox integrations, a free host, and grading that weighs money correctness and security most.

## Language and framework

**TypeScript, end to end.** One language for UI, API and domain logic means the split engine and money types are shared, not duplicated. Strict typing catches whole classes of money bugs, for example mixing `bigint` kobo with `number`.

**Next.js 15 (App Router) as both web app and API.** Pages and route handlers live in one project, with one deploy and one set of types.
- *Considered:* a separate NestJS API plus a Next.js frontend. It gives cleaner service boundaries, but doubles the deploy, auth and type-sharing work in a one-week timebox.
- *How the trade-off is contained:* the domain code doesn't depend on Next.js. `src/core` is pure TypeScript, and `src/server` only depends on Prisma and the provider interfaces, so it could move behind a standalone API later without a rewrite.

**Tailwind CSS 4** for matching the Figma designs quickly with design tokens. **lucide-react** for icons.

## Data

**PostgreSQL on Neon (free tier).** A ledger needs real transactions, row locks, unique constraints and triggers, which rules out most document stores and many free key-value services.
- Postgres lets the database itself enforce the money rules: a deferred constraint trigger rejects unbalanced ledger transactions; another trigger makes ledger entries immutable; `CHECK` constraints keep amounts positive and rules valid.
- Advisory locks (`pg_advisory_xact_lock`) serialise money work per user without a separate queue or Redis.
- Neon's free tier is serverless Postgres that works well with Vercel.
- *Gotcha found:* Neon's pooled (PgBouncer) URL broke Prisma interactive transactions, even with `pgbouncer=true`. The app uses the direct connection with `connection_limit=5`.

**Prisma 6** as the ORM. It has typed queries, `BigInt` columns mapped to JS `bigint`, migrations in Git, and interactive transactions. Raw SQL is used where Prisma can't express something (triggers, advisory locks, the rate-limit upsert).

**Rate limiting in Postgres, not Redis.** Serverless functions don't share memory, so an in-memory limiter doesn't work. A single `INSERT … ON CONFLICT … RETURNING count` is enough at this scale and avoids another service.

## Payments: Flutterwave (test mode)

Requirement: a dedicated collection account per user, simulated pay-ins, transfers to Nigerian banks, and webhooks.

- **Paystack was the first choice** (it's the suggested sandbox). In practice the test account had Dedicated Virtual Accounts (NUBAN) disabled, and creating transfer recipients failed, which blocks the two core features.
- **Flutterwave** offers permanent virtual account numbers, transfers, a transfer status lookup by reference, a pay-in verification API, and signed webhooks, all in test mode.
- The status-by-reference lookup matters most: it lets the app check what the provider actually did before any retry, which is what prevents double payments.
- Pay-ins are simulated through Flutterwave's real hosted checkout (admin "test salary" tool). The money then comes back through the same webhook, verification and ledger path a real salary would take, rather than a fake database insert.

## KYC: Dojah (sandbox)

- Nigerian provider that covers both BVN and NIN lookups plus selfie matching against the identity photo, which is what the brief asks for Nigerian users.
- Sandbox is free, works immediately with test identities, and uses simple header-key auth.
- *Considered:* Smile ID and Prembly. Both are capable; Dojah had the quickest self-serve sandbox setup.
- It sits behind a `VerificationProvider` interface with a region router, so an international provider such as Persona or Didit plugs in without touching core code.

## Email: Brevo

- The free plan allows 300 emails a day through a plain HTTPS API: one `fetch` call, no SDK.
- *Considered:* Resend, which needs a verified domain before sending to arbitrary addresses, and Mailtrap, which is a test inbox only so real users wouldn't receive mail.
- Emails go through one `notify()` function that writes the in-app notification first, with a unique dedupe key, and only then emails. Retried webhooks therefore never send duplicate emails.

## Hosting and scheduling: Vercel (Hobby)

- Native Next.js hosting, preview deploys, environment variables per environment, and **Vercel Cron**, so no separate scheduler service is needed.
- The Hobby plan limits cron jobs to once a day. That's acceptable here because splits are triggered by the pay-in itself, not by the clock. The daily job is a safety net: reconcile stale transfers, run missed splits, check the ledger, send reminders.
- The build runs `prisma migrate deploy` so the schema is always in sync with the deployed code.

## Auth: built in-house

- Email and password with bcrypt (cost 12), random session tokens stored only as SHA-256 hashes, `httpOnly` cookies, revocable sessions, email verification and password reset with single-use hashed tokens.
- *Considered:* Auth.js or Clerk. Clerk is a paid-tier risk and an extra vendor holding user PII. Auth.js's credentials provider only supports JWT sessions, but this app needs database sessions so they can be revoked (for example, all sessions are signed out on password reset). The auth code is small, and it uses the same rate limiting and audit log as the rest of the app.

## Smaller libraries

| Library | Why |
|---|---|
| Zod | Validates every request body and query, and the environment at startup. |
| pdf-lib | Generates PDF receipts and statements in pure JS, so it runs on serverless without a headless browser. |
| bcryptjs | Password hashing without native builds, which keeps Vercel deploys simple. |
| Vitest | Fast unit tests for the split engine with no extra config for TypeScript. |
| pnpm | Faster installs and a strict dependency tree. |

## What I'd add with more time

Sentry for error tracking, an OpenAPI spec, integration tests for the ledger and webhook paths against a test database, an international KYC adapter, MFA, and an authenticated email domain.
