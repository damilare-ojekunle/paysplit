import { prisma, isUniqueViolation } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { route, body, json, HttpError } from "@/server/http";
import { audit } from "@/server/notify";
import { RuleSchema, parseConditions, parseValue, assertPercentBudget } from "@/server/destinations";

export const GET = route(async () => {
  const user = await requireVerifiedUser();
  return json(await prisma.splitRule.findMany({ where: { userId: user.id }, include: { wallet: true, beneficiary: true }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] }));
});

export const POST = route(async (req) => {
  const user = await requireVerifiedUser();
  const b = await body(req, RuleSchema);
  if (b.activate && user.kycStatus !== "APPROVED") throw new HttpError(403, "Verify your identity to activate rules. You can save it as a draft for now.", "KYC_REQUIRED");
  const dest =
    b.destinationType === "WALLET"
      ? await prisma.wallet.findFirst({ where: { id: b.destinationId, userId: user.id, archivedAt: null }, include: { rule: true } })
      : await prisma.beneficiary.findFirst({ where: { id: b.destinationId, userId: user.id, archivedAt: null }, include: { rule: true } });
  if (!dest) throw new HttpError(404, "Destination not found");
  if (dest.rule) throw new HttpError(409, "This destination already has a rule — edit that rule instead", `RULE_EXISTS:${dest.rule.id}`);
  const v = parseValue(b.method, b.value);
  if (b.activate && v.percentBps) await assertPercentBudget(user.id, v.percentBps);
  try {
    const rule = await prisma.splitRule.create({
      data: { userId: user.id, name: b.name, destinationType: b.destinationType, walletId: b.destinationType === "WALLET" ? dest.id : null, beneficiaryId: b.destinationType === "BENEFICIARY" ? dest.id : null, method: b.method, ...v, ...parseConditions(b), priority: b.priority, status: b.activate ? "ACTIVE" : "DRAFT" },
    });
    await audit(user.id, "rule.create", { type: "SplitRule", id: rule.id }, { method: b.method, status: rule.status });
    return json(rule, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, "This destination already has a rule — edit that rule instead");
    throw e;
  }
});
