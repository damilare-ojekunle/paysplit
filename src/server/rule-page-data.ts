import { prisma } from "./db";
export async function destinationOptions(userId: string) {
  const [w, b] = await Promise.all([
    prisma.wallet.findMany({ where: { userId, archivedAt: null }, include: { rule: true } }),
    prisma.beneficiary.findMany({ where: { userId, archivedAt: null }, include: { rule: true } }),
  ]);
  return [
    ...w.map((x) => ({ id: x.id, name: x.name, category: x.category, type: "WALLET" as const, hasRule: !!x.rule, ruleId: x.rule?.id })),
    ...b.map((x) => ({ id: x.id, name: x.name, category: x.category, type: "BENEFICIARY" as const, hasRule: !!x.rule, ruleId: x.rule?.id })),
  ];
}

type RuleLike = { id: string; name: string; destinationType: "WALLET" | "BENEFICIARY"; walletId: string | null; beneficiaryId: string | null; method: "FIXED" | "PERCENT"; amountMinor: bigint | null; percentBps: number | null; priority: number; status: string; conditionType: "ANY" | "MIN_AMOUNT" | "SENDER"; conditionMinMinor: bigint | null; conditionSender: string | null; executionMode: "EACH_INFLOW" | "MONTHLY_TARGET"; monthlyTargetMinor: bigint | null };
const major = (m: bigint | null) => (m == null ? "" : String(Number(m) / 100));

/** Shape a stored rule for the edit form (client components can't take bigint). */
export function ruleForForm(r: RuleLike) {
  return {
    id: r.id, name: r.name, destinationType: r.destinationType, destinationId: (r.walletId || r.beneficiaryId)!, method: r.method,
    value: r.method === "FIXED" ? major(r.amountMinor) : String(r.percentBps! / 100), priority: r.priority, status: r.status,
    conditionType: r.conditionType, conditionMin: major(r.conditionMinMinor), conditionSender: r.conditionSender ?? "",
    executionMode: r.executionMode, monthlyTarget: major(r.monthlyTargetMinor),
  };
}

/** One-line description of a rule's condition and mode, or null when it runs on every inflow. */
export function ruleQualifiers(r: Pick<RuleLike, "conditionType" | "conditionMinMinor" | "conditionSender" | "executionMode" | "monthlyTargetMinor">) {
  const fmt = (m: bigint) => "₦" + (Number(m) / 100).toLocaleString("en-NG");
  const parts: string[] = [];
  if (r.conditionType === "MIN_AMOUNT" && r.conditionMinMinor) parts.push(`inflows ≥ ${fmt(r.conditionMinMinor)}`);
  if (r.conditionType === "SENDER" && r.conditionSender) parts.push(`from ${r.conditionSender}`);
  if (r.executionMode === "MONTHLY_TARGET" && r.monthlyTargetMinor) parts.push(`up to ${fmt(r.monthlyTargetMinor)}/month`);
  return parts.length ? parts.join(" · ") : null;
}
