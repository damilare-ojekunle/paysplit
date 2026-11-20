// End-to-end check of the money core against the real DB + Flutterwave sandbox (no HTTP layer).
import { prisma } from "@/server/db";
import { confirmPayin, executeSplit, reconcile } from "@/server/money-service";
import { walletsWithBalances, salaryBalance } from "@/server/queries";
import { formatMinor } from "@/core/money";

const email = `smoke-${Date.now()}@example.com`;
const user = await prisma.user.create({ data: { email, passwordHash: "x", firstName: "Smoke", lastName: "Test", emailVerifiedAt: new Date(), kycStatus: "APPROVED", country: "NG" } });
const acct = await prisma.ledgerAccount.create({ data: { type: "USER_WALLET", userId: user.id, name: "Wallet: Emergency" } });
const wallet = await prisma.wallet.create({ data: { userId: user.id, name: "Emergency", category: "Emergency", ledgerAccountId: acct.id } });
const acct2 = await prisma.ledgerAccount.create({ data: { type: "USER_WALLET", userId: user.id, name: "Wallet: Rent" } });
const rent = await prisma.wallet.create({ data: { userId: user.id, name: "Rent", category: "Rent", ledgerAccountId: acct2.id } });
const mum = await prisma.beneficiary.create({ data: { userId: user.id, name: "Mum", category: "Family", bankCode: "044", bankName: "Access Bank", accountNumber: "0690000031", accountName: "Forrest Green" } });
await prisma.splitRule.createMany({ data: [
  { userId: user.id, name: "Tithe-ish 10%", destinationType: "WALLET", walletId: wallet.id, method: "PERCENT", percentBps: 1000, priority: 1, status: "ACTIVE" },
  { userId: user.id, name: "Mum", destinationType: "BENEFICIARY", beneficiaryId: mum.id, method: "FIXED", amountMinor: 10_000_00n, priority: 2, status: "ACTIVE" },
  { userId: user.id, name: "Rent (too big)", destinationType: "WALLET", walletId: rent.id, method: "FIXED", amountMinor: 900_000_00n, priority: 3, status: "ACTIVE" },
]});

const ref = `smoke-${Date.now()}`;
// Same pay-in delivered 3x concurrently (webhook retry storm) → exactly one pay-in, one split.
const results = await Promise.all([1, 2, 3].map(() => confirmPayin({ userId: user.id, providerRef: ref, amountMinor: 600_000_00n, currency: "NGN", source: "ADMIN_TEST" })));
console.log("payin ids:", new Set(results.map((r) => r.payin.id)).size, "unique");
const execs = await prisma.splitExecution.findMany({ where: { userId: user.id }, include: { items: { include: { transfer: true } } } });
console.log("executions:", execs.length);
for (const i of execs[0].items) console.log(`  P${i.priority} ${i.destinationName.padEnd(8)} req ${formatMinor(i.requestedMinor).padEnd(12)} alloc ${formatMinor(i.allocatedMinor).padEnd(10)} ${i.status} ${i.skipReason ?? ""} ${i.transfer ? `[transfer ${i.transfer.status}${i.transfer.lastError ? ": " + i.transfer.lastError : ""}]` : ""}`);
console.log("execution:", execs[0].status, "allocated", formatMinor(execs[0].allocatedMinor), "remaining", formatMinor(execs[0].remainingMinor));

// Run Now twice with the same key → one execution.
const k = `run-${Date.now()}`;
const [a, b] = await Promise.allSettled([executeSplit(user.id, { trigger: "MANUAL", idempotencyKey: k }), executeSplit(user.id, { trigger: "MANUAL", idempotencyKey: k })]);
console.log("run-now same key:", a.status, b.status, a.status === "fulfilled" && b.status === "fulfilled" ? (a.value.id === b.value.id ? "same execution ✔" : "DIFFERENT ✘") : (a as any).reason?.message ?? (b as any).reason?.message);

console.log("salary balance:", formatMinor(await salaryBalance(user.id)));
for (const w of await walletsWithBalances(user.id)) console.log(`wallet ${w.name}:`, formatMinor(w.balanceMinor));
const total = await prisma.ledgerEntry.aggregate({ _sum: { amountMinor: true } });
console.log("global ledger sum (must be 0):", total._sum.amountMinor?.toString());
console.log("reconcile:", JSON.stringify(await reconcile()));
await prisma.$disconnect();
