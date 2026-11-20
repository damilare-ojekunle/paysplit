// Read models shared by server-rendered pages and API routes. Every query is scoped to a userId.
import type { LedgerTxnType, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { balancesFor, salaryAccount } from "./ledger";

export async function walletsWithBalances(userId: string) {
  const wallets = await prisma.wallet.findMany({ where: { userId, archivedAt: null }, include: { rule: true }, orderBy: { createdAt: "asc" } });
  const bal = await balancesFor(wallets.map((w) => w.ledgerAccountId));
  return wallets.map((w) => ({ ...w, balanceMinor: bal.get(w.ledgerAccountId) ?? 0n }));
}

export async function salaryBalance(userId: string) {
  const acct = await salaryAccount(prisma, userId);
  return (await balancesFor([acct.id])).get(acct.id) ?? 0n;
}

export function nextSalaryDate(salaryDay: number | null, tz = "Africa/Lagos", from = new Date()) {
  if (!salaryDay) return null;
  // Compute in the user's timezone; months without that day use their last day (PRD FR-08).
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(from);
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value) - 1;
  const d = Number(parts.find((p) => p.type === "day")!.value);
  const pick = (yy: number, mm: number) => {
    const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
    return new Date(Date.UTC(yy, mm, Math.min(salaryDay, last)));
  };
  const thisMonth = pick(y, m);
  return thisMonth.getUTCDate() >= d ? thisMonth : pick(y, m + 1);
}

export type TxRow = {
  id: string;
  reference: string;
  type: LedgerTxnType;
  label: string;
  description: string;
  direction: "in" | "out" | "internal";
  amountMinor: bigint;
  status: string;
  createdAt: Date;
  source: string;
  destination: string;
  category: string;
  transferId?: string;
  executionId?: string;
  walletId?: string;
  beneficiaryId?: string;
  providerRef?: string;
  failureReason?: string | null;
};

const LABEL: Record<LedgerTxnType, string> = {
  SALARY_IN: "Salary received",
  WALLET_ALLOCATION: "Wallet allocation",
  TRANSFER_OUT: "Beneficiary transfer",
  TRANSFER_SETTLED: "Transfer settled",
  TRANSFER_REVERSAL: "Transfer reversal",
  WALLET_TO_SALARY: "Wallet → salary account",
};

export interface TxFilter {
  type?: LedgerTxnType;
  status?: string;
  q?: string;
  from?: Date;
  to?: Date;
  walletId?: string;
  beneficiaryId?: string;
  page?: number;
  pageSize?: number;
}

export async function listTransactions(userId: string, f: TxFilter = {}) {
  const pageSize = Math.min(f.pageSize ?? 20, 100);
  const page = Math.max(f.page ?? 1, 1);
  const where: Prisma.LedgerTransactionWhereInput = {
    userId,
    type: f.type ? f.type : { not: "TRANSFER_SETTLED" }, // settlement is internal; status shows on the transfer row
    createdAt: { gte: f.from, lte: f.to },
    ...(f.q ? { OR: [{ description: { contains: f.q, mode: "insensitive" } }, { reference: { contains: f.q, mode: "insensitive" } }] } : {}),
    ...(f.walletId ? { metadata: { path: ["walletId"], equals: f.walletId } } : {}),
    ...(f.beneficiaryId ? { metadata: { path: ["beneficiaryId"], equals: f.beneficiaryId } } : {}),
  };
  const inMemoryStatus = !!f.status;
  const [total, txns] = await Promise.all([
    prisma.ledgerTransaction.count({ where }),
    prisma.ledgerTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { entries: { include: { account: true } } },
      skip: inMemoryStatus ? 0 : (page - 1) * pageSize,
      take: inMemoryStatus ? 500 : pageSize,
    }),
  ]);
  let rows = await toRows(userId, txns);
  if (inMemoryStatus) {
    rows = rows.filter((r) => r.status === f.status);
    return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
  }
  return { rows, total, page, pageSize };
}

const REF_PREFIX: Record<LedgerTxnType, string> = { SALARY_IN: "PAY", WALLET_ALLOCATION: "ALC", TRANSFER_OUT: "TRF", TRANSFER_SETTLED: "STL", TRANSFER_REVERSAL: "RFD", WALLET_TO_SALARY: "WTS" };
/** Short human reference, e.g. PAY-20261120-4K7Q (date in Lagos time + id suffix). */
export function displayRef(type: LedgerTxnType, at: Date, id: string) {
  const d = at.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }).replace(/-/g, "");
  return `${REF_PREFIX[type]}-${d}-${id.slice(-4).toUpperCase()}`;
}

type TxnWithEntries = Prisma.LedgerTransactionGetPayload<{ include: { entries: { include: { account: true } } } }>;

async function toRows(userId: string, txns: TxnWithEntries[]): Promise<TxRow[]> {
  const meta = (t: TxnWithEntries) => (t.metadata || {}) as Record<string, string>;
  const transferIds = txns.map((t) => meta(t).transferId).filter(Boolean);
  const walletIds = txns.map((t) => meta(t).walletId).filter(Boolean);
  const [transfers, wallets, payins] = await Promise.all([
    prisma.transfer.findMany({ where: { id: { in: transferIds }, userId }, include: { beneficiary: true } }),
    prisma.wallet.findMany({ where: { id: { in: walletIds }, userId } }),
    prisma.payin.findMany({ where: { id: { in: txns.map((t) => meta(t).payinId).filter(Boolean) } } }),
  ]);
  const tMap = new Map(transfers.map((t) => [t.id, t]));
  const wMap = new Map(wallets.map((w) => [w.id, w]));
  const pMap = new Map(payins.map((p) => [p.id, p]));

  return txns.map((t) => {
    const m = meta(t);
    const userEntry = t.entries.find((e) => e.account.userId === userId) ?? t.entries[0];
    const amount = userEntry.amountMinor < 0n ? -userEntry.amountMinor : userEntry.amountMinor;
    const transfer = m.transferId ? tMap.get(m.transferId) : undefined;
    const wallet = m.walletId ? wMap.get(m.walletId) : undefined;
    const base = { id: t.id, reference: displayRef(t.type, t.createdAt, t.id), type: t.type, label: LABEL[t.type], description: t.description, amountMinor: amount, createdAt: t.createdAt, executionId: m.executionId, transferId: m.transferId, walletId: m.walletId, beneficiaryId: m.beneficiaryId };
    switch (t.type) {
      case "SALARY_IN": {
        const p = pMap.get(m.payinId);
        return { ...base, direction: "in", status: "SUCCESS", source: p?.source === "ADMIN_TEST" ? "Test pay-in" : "Employer", destination: "Salary account", category: "Salary", providerRef: p?.providerRef };
      }
      case "WALLET_ALLOCATION":
        return { ...base, direction: "internal", status: "SUCCESS", source: "Salary account", destination: wallet?.name ?? "Wallet", category: wallet?.category ?? "Wallet" };
      case "WALLET_TO_SALARY":
        return { ...base, direction: "internal", status: "SUCCESS", source: wallet?.name ?? "Wallet", destination: "Salary account", category: wallet?.category ?? "Wallet" };
      case "TRANSFER_OUT":
        return { ...base, reference: transfer?.reference ?? base.reference, direction: "out", status: transfer?.status ?? "PENDING", source: "Salary account", destination: transfer ? `${transfer.beneficiary.name} · ${transfer.beneficiary.bankName}` : "Beneficiary", category: transfer?.beneficiary.category ?? "Beneficiary", providerRef: transfer?.providerCode ?? undefined, failureReason: transfer?.lastError };
      case "TRANSFER_REVERSAL":
        return { ...base, reference: transfer ? `${transfer.reference}-R` : base.reference, direction: "in", status: "REVERSED", source: transfer?.beneficiary.name ?? "Beneficiary", destination: "Salary account", category: "Refund" };
      default:
        return { ...base, direction: "internal", status: "SUCCESS", source: "", destination: "", category: "" };
    }
  }) as TxRow[];
}

export async function getTransaction(userId: string, id: string) {
  const t = await prisma.ledgerTransaction.findFirst({ where: { id, userId }, include: { entries: { include: { account: true } } } });
  if (!t) return null;
  return (await toRows(userId, [t]))[0];
}

export async function dashboard(userId: string) {
  const [user, account, salary, wallets, recent, lastExec, salaryIn, rules, notifications] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.collectionAccount.findUnique({ where: { userId } }),
    salaryBalance(userId),
    walletsWithBalances(userId),
    listTransactions(userId, { pageSize: 6 }),
    prisma.splitExecution.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, include: { items: true } }),
    prisma.payin.aggregate({ where: { userId, status: "CONFIRMED", receivedAt: { gte: new Date(Date.now() - 30 * 864e5) } }, _sum: { amountMinor: true } }),
    prisma.splitRule.findMany({ where: { userId }, include: { wallet: true, beneficiary: true }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] }),
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const walletTotal = wallets.reduce((s, w) => s + w.balanceMinor, 0n);
  const sentToBeneficiaries = await prisma.transfer.aggregate({ where: { userId, status: "SUCCESS", createdAt: { gte: new Date(Date.now() - 30 * 864e5) } }, _sum: { amountMinor: true } });
  return {
    user, account, salary, wallets, walletTotal, recent: recent.rows, lastExec, rules, notifications,
    salaryReceived30d: salaryIn._sum.amountMinor ?? 0n,
    sentToBeneficiaries30d: sentToBeneficiaries._sum.amountMinor ?? 0n,
    nextSalary: nextSalaryDate(user.salaryDay, user.timezone),
  };
}

export type CashFlowMonth = { month: string; label: string; wallets: bigint; beneficiaries: bigint };

/** Last `months` months of net money moved to wallets (up) and to beneficiaries (down), Lagos time. */
export async function cashFlow(userId: string, months = 9): Promise<CashFlowMonth[]> {
  const rows = await prisma.$queryRaw<{ m: string; type: LedgerTxnType; amt: bigint }[]>`
    SELECT to_char(date_trunc('month', (t."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Lagos'), 'YYYY-MM') AS m, t.type, SUM(e."amountMinor")::bigint AS amt
    FROM "LedgerTransaction" t JOIN "LedgerEntry" e ON e."transactionId" = t.id
    WHERE t."userId" = ${userId} AND e."amountMinor" > 0
      AND t.type IN ('WALLET_ALLOCATION','WALLET_TO_SALARY','TRANSFER_OUT','TRANSFER_REVERSAL')
      AND (t."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Lagos' >= date_trunc('month', now() AT TIME ZONE 'Africa/Lagos') - make_interval(months => ${months - 1}::int)
    GROUP BY 1, 2`;
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
  const out: CashFlowMonth[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const sum = (t: LedgerTxnType) => rows.filter((r) => r.m === key && r.type === t).reduce((s, r) => s + BigInt(r.amt), 0n);
    const w = sum("WALLET_ALLOCATION") - sum("WALLET_TO_SALARY");
    const b = sum("TRANSFER_OUT") - sum("TRANSFER_REVERSAL");
    out.push({ month: key, label: d.toLocaleDateString("en-NG", { month: "short" }) + " " + String(d.getFullYear()).slice(2), wallets: w > 0n ? w : 0n, beneficiaries: b > 0n ? b : 0n });
  }
  return out;
}

/** Confirmed salary received in a calendar month (Lagos), offset 0 = this month. */
export async function salaryForMonth(userId: string, offset = 0) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - offset, 1) - 3600_000);
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() - offset + 1, 1) - 3600_000);
  const r = await prisma.payin.aggregate({ where: { userId, status: "CONFIRMED", receivedAt: { gte: start, lt: end } }, _sum: { amountMinor: true } });
  return r._sum.amountMinor ?? 0n;
}
