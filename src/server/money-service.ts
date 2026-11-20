// Money movement orchestration: pay-ins, split execution, transfers, reconciliation.
// Uses only provider *interfaces* (via the region router) — no vendor specifics here.

import type { ExecutionStatus, Prisma, TransferStatus } from "@prisma/client";
import { planAllocations, type EngineRule } from "@/core/split-engine";
import { formatMinor, formatBps } from "@/core/money";
import { prisma, lockUser, isUniqueViolation, type Tx } from "./db";
import { post, move, salaryAccount, systemAccount, balanceOf } from "./ledger";
import { paymentProvider } from "./providers";
import { ProviderUncertainError, type TransferState } from "./providers/types";
import { notify, audit } from "./notify";
import { HttpError } from "./http";
import { log } from "./log";

const MAX_TRANSFER_ATTEMPTS = 5;
const TX_OPTS = { timeout: 20_000, maxWait: 10_000 } as const;

// ---------------------------------------------------------------- pay-ins

export async function resolvePayinUser(hint: { txRef?: string; email?: string; accountNumber?: string }) {
  const fromRef = hint.txRef?.match(/^salary-([a-z0-9]+)-/)?.[1];
  if (fromRef) return prisma.user.findUnique({ where: { id: fromRef } });
  if (hint.accountNumber) {
    const acct = await prisma.collectionAccount.findFirst({ where: { accountNumber: hint.accountNumber }, include: { user: true } });
    if (acct) return acct.user;
  }
  if (hint.email) return prisma.user.findUnique({ where: { email: hint.email.toLowerCase() } });
  return null;
}

/**
 * Record a confirmed salary pay-in (idempotent on provider+providerRef), credit the user's salary
 * account in the ledger, then trigger the automatic split for that pay-in.
 */
export async function confirmPayin(input: { userId: string; providerRef: string; amountMinor: bigint; currency: string; source: "WEBHOOK" | "ADMIN_TEST"; initiatedBy?: string }) {
  const provider = paymentProvider().name;
  const payin = await prisma.$transaction(async (tx) => {
    await lockUser(tx, input.userId);
    let p = await tx.payin.findUnique({ where: { provider_providerRef: { provider, providerRef: input.providerRef } } });
    if (p) return { payin: p, isNew: false };
    p = await tx.payin.create({
      data: { userId: input.userId, provider, providerRef: input.providerRef, amountMinor: input.amountMinor, currency: input.currency, status: "CONFIRMED", source: input.source, initiatedBy: input.initiatedBy },
    });
    const cash = await systemAccount(tx, "PROVIDER_CASH");
    const salary = await salaryAccount(tx, input.userId);
    await post(tx, {
      reference: `payin:${p.id}`,
      type: "SALARY_IN",
      userId: input.userId,
      description: input.source === "ADMIN_TEST" ? "Salary received (test pay-in)" : "Salary received",
      metadata: { payinId: p.id, providerRef: input.providerRef },
      entries: move(cash.id, salary.id, input.amountMinor),
    });
    return { payin: p, isNew: true };
  }, TX_OPTS);

  if (payin.isNew) {
    await notify(input.userId, {
      type: "salary",
      title: "Salary received",
      body: `${formatMinor(input.amountMinor)} arrived in your salary account.`,
      dedupeKey: `salary:${payin.payin.id}`,
      email: { subject: `Salary received: ${formatMinor(input.amountMinor)}`, html: `<p>${formatMinor(input.amountMinor)} has arrived in your PaySplit salary account. Your active split rules will run automatically.</p>` },
    });
  }
  const execution = await runAutoSplitForPayin(payin.payin.id).catch((e) => {
    log.error("auto_split_failed", { payinId: payin.payin.id, err: (e as Error).message });
    return null;
  });
  return { payin: payin.payin, execution };
}

export async function runAutoSplitForPayin(payinId: string) {
  const payin = await prisma.payin.findUniqueOrThrow({ where: { id: payinId }, include: { user: true } });
  if (payin.status !== "CONFIRMED") return null;
  if (payin.user.kycStatus !== "APPROVED") {
    await notify(payin.userId, { type: "split", title: "Split on hold", body: "Your salary arrived but splits are paused until identity verification is approved.", dedupeKey: `split-hold:${payin.id}` });
    return null;
  }
  return executeSplit(payin.userId, { trigger: "AUTO", payinId: payin.id, idempotencyKey: `auto:${payin.id}` });
}

// ---------------------------------------------------------------- split execution

async function activeRules(tx: Tx, userId: string) {
  return tx.splitRule.findMany({
    where: {
      userId,
      status: "ACTIVE",
      OR: [{ wallet: { archivedAt: null } }, { beneficiary: { archivedAt: null } }],
    },
    include: { wallet: true, beneficiary: true },
  });
}

type RuleRow = Awaited<ReturnType<typeof activeRules>>[number];
const toEngine = (r: RuleRow): EngineRule => ({ id: r.id, priority: r.priority, createdAt: r.createdAt, method: r.method, amountMinor: r.amountMinor, percentBps: r.percentBps });
const ruleValue = (r: RuleRow) => (r.method === "FIXED" ? formatMinor(r.amountMinor!) : formatBps(r.percentBps!));
const destName = (r: RuleRow) => (r.wallet ? r.wallet.name : r.beneficiary!.name);

/** Read-only preview for Run Now. */
export async function previewManualSplit(userId: string) {
  const salary = await salaryAccount(prisma, userId);
  const available = await balanceOf(prisma, salary.id);
  const rules = await activeRules(prisma, userId);
  const plan = planAllocations(rules.map(toEngine), available, available);
  const byId = new Map(rules.map((r) => [r.id, r]));
  return {
    available,
    totalAllocated: plan.totalAllocated,
    remaining: plan.remaining,
    items: plan.allocations.map((a) => {
      const r = byId.get(a.ruleId)!;
      return { ruleId: r.id, ruleName: r.name, destination: destName(r), destinationType: r.destinationType, priority: r.priority, value: ruleValue(r), requestedMinor: a.requestedMinor, allocatedMinor: a.allocatedMinor, status: a.status, skipReason: a.skipReason };
    }),
  };
}

/**
 * Execute active rules against salary funds. Serialised per user (advisory lock) and idempotent on
 * idempotencyKey, so retries, concurrent webhooks and double-clicked Run Now can never allocate the
 * same funds twice. Allocations debit the salary account immediately (transfers move to "in flight"),
 * so funds committed to a pending transfer are never available to a later run.
 */
export async function executeSplit(userId: string, opts: { trigger: "AUTO" | "MANUAL"; payinId?: string; idempotencyKey: string }) {
  const execution = await prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const existing = await tx.splitExecution.findUnique({ where: { idempotencyKey: opts.idempotencyKey }, include: { items: true } });
    if (existing) return existing;

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.kycStatus !== "APPROVED") throw new HttpError(403, "Complete identity verification to run splits", "KYC_REQUIRED");

    const salary = await salaryAccount(tx, userId);
    const inFlight = await systemAccount(tx, "TRANSFERS_IN_FLIGHT");
    const balance = await balanceOf(tx, salary.id);

    let base: bigint;
    let available: bigint;
    if (opts.trigger === "AUTO") {
      const payin = await tx.payin.findUniqueOrThrow({ where: { id: opts.payinId! } });
      base = payin.amountMinor; // percentages use the original confirmed salary
      available = balance < payin.amountMinor ? balance : payin.amountMinor; // only this salary's funds
    } else {
      base = balance; // Run Now: rules apply to unallocated funds currently available
      available = balance;
    }

    const rules = await activeRules(tx, userId);
    if (!rules.length) throw new HttpError(409, "You have no active split rules");
    if (available <= 0n) throw new HttpError(409, "There are no unallocated salary funds to split");

    const plan = planAllocations(rules.map(toEngine), base, available);
    const byId = new Map(rules.map((r) => [r.id, r]));

    const exec = await tx.splitExecution.create({
      data: { userId, payinId: opts.payinId, trigger: opts.trigger, idempotencyKey: opts.idempotencyKey, baseMinor: base, availableMinor: available, allocatedMinor: plan.totalAllocated, remainingMinor: plan.remaining },
    });

    for (const a of plan.allocations) {
      const r = byId.get(a.ruleId)!;
      const snapshot = {
        executionId: exec.id, ruleId: r.id, ruleName: r.name, destinationType: r.destinationType,
        destinationId: (r.walletId || r.beneficiaryId)!, destinationName: destName(r), method: r.method,
        ruleValue: ruleValue(r), priority: r.priority, requestedMinor: a.requestedMinor,
      };
      if (a.status === "SKIPPED") {
        await tx.splitExecutionItem.create({ data: { ...snapshot, status: "SKIPPED", skipReason: `${a.skipReason}: requested ${formatMinor(a.requestedMinor)}, available ${formatMinor(a.availableBefore)}` } });
        continue;
      }
      if (r.wallet) {
        const item = await tx.splitExecutionItem.create({ data: { ...snapshot, status: "SUCCESS", allocatedMinor: a.allocatedMinor } });
        await post(tx, {
          reference: `alloc:${item.id}`, type: "WALLET_ALLOCATION", userId,
          description: `Split to ${r.wallet.name}`, metadata: { executionId: exec.id, itemId: item.id, walletId: r.wallet.id, ruleId: r.id },
          entries: move(salary.id, r.wallet.ledgerAccountId, a.allocatedMinor),
        });
      } else {
        const b = r.beneficiary!;
        const transfer = await tx.transfer.create({
          data: { userId, beneficiaryId: b.id, amountMinor: a.allocatedMinor, reference: `PS-${exec.id.slice(-10)}-${r.id.slice(-8)}`.toUpperCase(), provider: paymentProvider().name },
        });
        await tx.splitExecutionItem.create({ data: { ...snapshot, status: "PENDING", allocatedMinor: a.allocatedMinor, transferId: transfer.id } });
        await post(tx, {
          reference: `xfer-out:${transfer.id}`, type: "TRANSFER_OUT", userId,
          description: `Transfer to ${b.name}`, metadata: { executionId: exec.id, transferId: transfer.id, beneficiaryId: b.id, ruleId: r.id },
          entries: move(salary.id, inFlight.id, a.allocatedMinor),
        });
      }
    }
    await recomputeExecution(tx, exec.id);
    return tx.splitExecution.findUniqueOrThrow({ where: { id: exec.id }, include: { items: true } });
  }, TX_OPTS);

  await audit(opts.trigger === "MANUAL" ? userId : null, `split.${opts.trigger.toLowerCase()}`, { type: "SplitExecution", id: execution.id }, { allocated: execution.allocatedMinor.toString() });

  // Dispatch transfers outside the DB transaction (network I/O never holds locks).
  for (const it of execution.items) if (it.transferId && it.status === "PENDING") await dispatchTransfer(it.transferId).catch((e) => log.error("dispatch_failed", { transferId: it.transferId, err: (e as Error).message }));

  return finaliseNotice(execution.id);
}

async function recomputeExecution(tx: Tx, executionId: string): Promise<ExecutionStatus> {
  const items = await tx.splitExecutionItem.findMany({ where: { executionId } });
  const succeeded = items.filter((i) => i.status === "SUCCESS");
  const allocated = items.filter((i) => i.status === "SUCCESS" || i.status === "PENDING").reduce((s, i) => s + i.allocatedMinor, 0n);
  let status: ExecutionStatus;
  if (items.some((i) => i.status === "PENDING")) status = "PENDING";
  else if (succeeded.length === items.length) status = "SUCCESS";
  else if (succeeded.length > 0) status = "PARTIAL";
  else status = "FAILED";
  const exec = await tx.splitExecution.findUniqueOrThrow({ where: { id: executionId } });
  await tx.splitExecution.update({ where: { id: executionId }, data: { status, allocatedMinor: allocated, remainingMinor: exec.availableMinor - allocated } });
  return status;
}

async function finaliseNotice(executionId: string) {
  const e = await prisma.splitExecution.findUniqueOrThrow({ where: { id: executionId }, include: { items: { include: { transfer: true } } } });
  if (e.status !== "PENDING") {
    const skipped = e.items.filter((i) => i.status === "SKIPPED").length;
    const failed = e.items.filter((i) => i.status === "FAILED").length;
    const word = e.status === "SUCCESS" ? "completed" : e.status === "PARTIAL" ? "partially completed" : "failed";
    const rows = e.items.map((i) => `<tr><td>${i.priority}</td><td>${i.destinationName}</td><td>${formatMinor(i.allocatedMinor)}</td><td>${i.status}${i.skipReason ? ` — ${i.skipReason}` : ""}</td></tr>`).join("");
    await notify(e.userId, {
      type: "split",
      title: `Split ${word}`,
      body: `${formatMinor(e.allocatedMinor)} allocated, ${formatMinor(e.remainingMinor)} remains in your salary account.${skipped ? ` ${skipped} rule(s) skipped for insufficient funds.` : ""}${failed ? ` ${failed} transfer(s) failed.` : ""}`,
      dedupeKey: `split-done:${e.id}`,
      email: { subject: `Your salary split ${word}`, html: `<p>${formatMinor(e.allocatedMinor)} allocated · ${formatMinor(e.remainingMinor)} remaining.</p><table cellpadding="6" style="border-collapse:collapse;font-size:13px"><tr><th>#</th><th>Destination</th><th>Amount</th><th>Status</th></tr>${rows}</table>` },
    });
  }
  return e;
}

// ---------------------------------------------------------------- transfers

/**
 * Send (or re-send) a transfer. Before any retry we ask the provider for the authoritative status of
 * our reference; we only call transfer() again if the provider has no record of it. The provider also
 * enforces reference uniqueness, so a beneficiary can never be paid twice for one instruction.
 */
export async function dispatchTransfer(transferId: string) {
  const t = await prisma.transfer.findUniqueOrThrow({ where: { id: transferId }, include: { beneficiary: true } });
  if (!["PENDING", "RETRYING"].includes(t.status)) return;
  const provider = paymentProvider();

  if (t.attempts > 0) {
    try {
      const known = await provider.getTransfer(t.reference);
      if (known) return applyTransferState(t.id, known.state, known.providerCode, known.message);
    } catch (e) {
      log.warn("transfer_reconcile_unavailable", { transferId, err: (e as Error).message });
      return; // can't confirm — never blind-retry
    }
    if (t.attempts >= MAX_TRANSFER_ATTEMPTS) return applyTransferState(t.id, "FAILED", undefined, "Gave up after repeated provider errors");
  }

  // Claim the attempt atomically so concurrent dispatchers don't double-send.
  const claimed = await prisma.transfer.updateMany({ where: { id: t.id, attempts: t.attempts, status: { in: ["PENDING", "RETRYING"] } }, data: { attempts: { increment: 1 } } });
  if (claimed.count === 0) return;

  try {
    const r = await provider.transfer({ reference: t.reference, amountMinor: t.amountMinor, bankCode: t.beneficiary.bankCode, accountNumber: t.beneficiary.accountNumber, narration: t.beneficiary.narration || "PaySplit transfer" });
    await prisma.transfer.update({ where: { id: t.id }, data: { providerCode: r.providerCode } });
    await applyTransferState(t.id, r.state, r.providerCode, r.message);
  } catch (e) {
    if (e instanceof ProviderUncertainError) {
      await prisma.transfer.update({ where: { id: t.id }, data: { status: "RETRYING", lastError: e.message } });
      await notify(t.userId, { type: "transfer", title: "Transfer delayed", body: `Your transfer of ${formatMinor(t.amountMinor)} to ${t.beneficiary.name} is taking longer than usual. We'll confirm its status before retrying.`, dedupeKey: `xfer-retry:${t.id}` });
      return;
    }
    throw e;
  }
}

/** Apply a provider status to a transfer. Final states never regress; ledger postings are idempotent. */
export async function applyTransferState(transferId: string, state: TransferState, providerCode?: string, message?: string) {
  const t0 = await prisma.transfer.findUniqueOrThrow({ where: { id: transferId } });
  const result = await prisma.$transaction(async (tx) => {
    await lockUser(tx, t0.userId);
    const t = await tx.transfer.findUniqueOrThrow({ where: { id: transferId }, include: { item: true, beneficiary: true } });
    const final: TransferStatus[] = ["SUCCESS", "FAILED", "REVERSED"];
    if (final.includes(t.status)) return null;
    if (state === "PENDING") {
      await tx.transfer.update({ where: { id: t.id }, data: { providerCode: providerCode ?? t.providerCode } });
      return null;
    }
    const inFlight = await systemAccount(tx, "TRANSFERS_IN_FLIGHT");
    if (state === "SUCCESS") {
      const cash = await systemAccount(tx, "PROVIDER_CASH");
      await post(tx, { reference: `xfer-settle:${t.id}`, type: "TRANSFER_SETTLED", userId: t.userId, description: `Transfer to ${t.beneficiary.name} settled`, metadata: { transferId: t.id }, entries: move(inFlight.id, cash.id, t.amountMinor) });
    } else {
      const salary = await salaryAccount(tx, t.userId);
      await post(tx, { reference: `xfer-rev:${t.id}`, type: "TRANSFER_REVERSAL", userId: t.userId, description: `Transfer to ${t.beneficiary.name} failed — funds returned`, metadata: { transferId: t.id }, entries: move(inFlight.id, salary.id, t.amountMinor) });
    }
    await tx.transfer.update({ where: { id: t.id }, data: { status: state, providerCode: providerCode ?? t.providerCode, lastError: state === "FAILED" ? message?.slice(0, 300) : null } });
    if (t.item) {
      await tx.splitExecutionItem.update({ where: { id: t.item.id }, data: { status: state === "SUCCESS" ? "SUCCESS" : "FAILED", skipReason: state === "FAILED" ? `Transfer failed: ${message || "rejected by provider"}` : null } });
      await recomputeExecution(tx, t.item.executionId);
    }
    return { t, executionId: t.item?.executionId };
  }, TX_OPTS);

  if (!result) return;
  const { t } = result;
  if (state === "SUCCESS") {
    await notify(t.userId, { type: "transfer", title: "Transfer sent", body: `${formatMinor(t.amountMinor)} sent to ${t.beneficiary.name}.`, dedupeKey: `xfer-ok:${t.id}`, email: { subject: `Receipt: ${formatMinor(t.amountMinor)} sent to ${t.beneficiary.name}`, html: `<p>Reference: <b>${t.reference}</b><br/>Amount: ${formatMinor(t.amountMinor)}<br/>To: ${t.beneficiary.name} · ${t.beneficiary.bankName} ••••${t.beneficiary.accountNumber.slice(-4)}<br/>Status: Successful</p>` } });
  } else {
    await notify(t.userId, { type: "transfer", title: "Transfer failed", body: `${formatMinor(t.amountMinor)} to ${t.beneficiary.name} failed and was returned to your salary account. ${message || ""}`.trim(), dedupeKey: `xfer-fail:${t.id}`, email: { subject: `Transfer failed: ${formatMinor(t.amountMinor)} to ${t.beneficiary.name}`, html: `<p>Your transfer (ref <b>${t.reference}</b>) failed${message ? `: ${message}` : ""}. The funds have been returned to your salary account.</p>` } });
  }
  if (result.executionId) await finaliseNotice(result.executionId);
}

// ---------------------------------------------------------------- wallet → salary

export async function moveWalletToSalary(userId: string, walletId: string, amountMinor: bigint, clientKey: string) {
  if (amountMinor <= 0n) throw new HttpError(422, "Amount must be greater than zero");
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const wallet = await tx.wallet.findFirst({ where: { id: walletId, userId, archivedAt: null } });
    if (!wallet) throw new HttpError(404, "Wallet not found");
    const reference = `w2s:${userId}:${clientKey}`;
    const done = await tx.ledgerTransaction.findUnique({ where: { reference } });
    if (done) return done;
    const bal = await balanceOf(tx, wallet.ledgerAccountId);
    if (amountMinor > bal) throw new HttpError(422, `Amount exceeds wallet balance of ${formatMinor(bal)}`);
    const salary = await salaryAccount(tx, userId);
    const r = await post(tx, { reference, type: "WALLET_TO_SALARY", userId, description: `Moved from ${wallet.name} to salary account`, metadata: { walletId }, entries: move(wallet.ledgerAccountId, salary.id, amountMinor) });
    return tx.ledgerTransaction.findUniqueOrThrow({ where: { id: r.id } });
  }, TX_OPTS);
}

// ---------------------------------------------------------------- reconciliation (cron)

export async function reconcile() {
  const report = { transfersChecked: 0, transfersUpdated: 0, missedSplits: 0, ledgerImbalance: "0", inFlightMismatch: null as null | { ledger: string; pending: string } };
  const stale = await prisma.transfer.findMany({ where: { status: { in: ["PENDING", "RETRYING"] }, updatedAt: { lt: new Date(Date.now() - 60_000) } }, take: 50 });
  for (const t of stale) {
    report.transfersChecked++;
    const before = t.status;
    await dispatchTransfer(t.id).catch((e) => log.error("reconcile_transfer_failed", { transferId: t.id, err: (e as Error).message }));
    const after = await prisma.transfer.findUnique({ where: { id: t.id }, select: { status: true } });
    if (after?.status !== before) report.transfersUpdated++;
  }

  // Missed runs: confirmed pay-ins for verified users with no automatic execution.
  const missed = await prisma.payin.findMany({ where: { status: "CONFIRMED", executions: { none: { trigger: "AUTO" } }, user: { kycStatus: "APPROVED" } }, take: 20 });
  for (const p of missed) {
    try {
      await runAutoSplitForPayin(p.id);
      report.missedSplits++;
    } catch (e) {
      log.warn("missed_split_not_run", { payinId: p.id, err: (e as Error).message });
    }
  }

  // Ledger integrity: all entries must net to zero; in-flight balance must equal open transfers.
  const total = await prisma.ledgerEntry.aggregate({ _sum: { amountMinor: true } });
  report.ledgerImbalance = (total._sum.amountMinor ?? 0n).toString();
  const inFlight = await systemAccount(prisma, "TRANSFERS_IN_FLIGHT");
  const ledgerInFlight = await balanceOf(prisma, inFlight.id);
  const open = await prisma.transfer.aggregate({ where: { status: { in: ["PENDING", "RETRYING"] } }, _sum: { amountMinor: true } });
  const pending = open._sum.amountMinor ?? 0n;
  if (ledgerInFlight !== pending) {
    report.inFlightMismatch = { ledger: ledgerInFlight.toString(), pending: pending.toString() };
    log.error("reconciliation_mismatch", report.inFlightMismatch);
  }
  await audit(null, "reconcile.run", undefined, report as unknown as Prisma.JsonObject);
  return report;
}

export { isUniqueViolation };
