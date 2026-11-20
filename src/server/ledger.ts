// Double-entry ledger. Entries are immutable and every transaction sums to zero
// (enforced here and again by database triggers). Balances are always derived.
//
// Sign convention: debit > 0, credit < 0.
// Liability accounts (USER_SALARY, USER_WALLET, TRANSFERS_IN_FLIGHT) are credit-normal,
// so their balance is -SUM(entries). PROVIDER_CASH is an asset: balance = SUM(entries).

import type { LedgerAccountType, LedgerTxnType } from "@prisma/client";
import { prisma, isUniqueViolation, type Tx } from "./db";

const CREDIT_NORMAL: LedgerAccountType[] = ["USER_SALARY", "USER_WALLET", "TRANSFERS_IN_FLIGHT"];

export async function systemAccount(tx: Tx, type: "PROVIDER_CASH" | "TRANSFERS_IN_FLIGHT", currency = "NGN") {
  const systemKey = `${type}:${currency}`;
  return tx.ledgerAccount.upsert({
    where: { systemKey },
    update: {},
    create: { type, currency, systemKey, name: type === "PROVIDER_CASH" ? "Cash at payment provider" : "Transfers in flight" },
  });
}

export async function salaryAccount(tx: Tx, userId: string) {
  const systemKey = `SALARY:${userId}`;
  return tx.ledgerAccount.upsert({
    where: { systemKey },
    update: {},
    create: { type: "USER_SALARY", userId, systemKey, name: "Salary account" },
  });
}

export async function balanceOf(tx: Tx, accountId: string): Promise<bigint> {
  const acct = await tx.ledgerAccount.findUniqueOrThrow({ where: { id: accountId }, select: { type: true } });
  const agg = await tx.ledgerEntry.aggregate({ where: { accountId }, _sum: { amountMinor: true } });
  const sum = agg._sum.amountMinor ?? 0n;
  return CREDIT_NORMAL.includes(acct.type) ? -sum : sum;
}

export async function balancesFor(accountIds: string[]): Promise<Map<string, bigint>> {
  if (!accountIds.length) return new Map();
  const rows = await prisma.ledgerEntry.groupBy({ by: ["accountId"], where: { accountId: { in: accountIds } }, _sum: { amountMinor: true } });
  const accts = await prisma.ledgerAccount.findMany({ where: { id: { in: accountIds } }, select: { id: true, type: true } });
  const sums = new Map(rows.map((r) => [r.accountId, r._sum.amountMinor ?? 0n]));
  return new Map(accts.map((a) => [a.id, (CREDIT_NORMAL.includes(a.type) ? -1n : 1n) * (sums.get(a.id) ?? 0n)]));
}

export interface PostInput {
  reference: string; // unique business reference — posting twice is a no-op
  type: LedgerTxnType;
  userId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  /** Move `amount` from one account to another (debit `to`... see helpers below). */
  entries: { accountId: string; amountMinor: bigint }[];
}

/** Post a balanced transaction. Idempotent on `reference`. Returns { id, created }. */
export async function post(tx: Tx, input: PostInput): Promise<{ id: string; created: boolean }> {
  const sum = input.entries.reduce((s, e) => s + e.amountMinor, 0n);
  if (sum !== 0n) throw new Error(`Unbalanced ledger transaction ${input.reference}`);
  if (input.entries.some((e) => e.amountMinor === 0n)) throw new Error("Zero-amount ledger entry");

  const existing = await tx.ledgerTransaction.findUnique({ where: { reference: input.reference }, select: { id: true } });
  if (existing) return { id: existing.id, created: false };
  try {
    const txn = await tx.ledgerTransaction.create({
      data: {
        reference: input.reference,
        type: input.type,
        userId: input.userId,
        description: input.description,
        metadata: input.metadata as object | undefined,
        entries: { create: input.entries.map((e) => ({ accountId: e.accountId, amountMinor: e.amountMinor })) },
      },
      select: { id: true },
    });
    return { id: txn.id, created: true };
  } catch (e) {
    if (isUniqueViolation(e)) {
      const t = await tx.ledgerTransaction.findUniqueOrThrow({ where: { reference: input.reference }, select: { id: true } });
      return { id: t.id, created: false };
    }
    throw e;
  }
}

/** Value moves FROM a liability account TO another: debit source (reduce), credit destination (increase). */
export function move(fromId: string, toId: string, amount: bigint) {
  return [
    { accountId: fromId, amountMinor: amount },
    { accountId: toId, amountMinor: -amount },
  ];
}
