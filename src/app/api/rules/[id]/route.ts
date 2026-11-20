import { z } from "zod";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { route, body, json, HttpError } from "@/server/http";
import { audit } from "@/server/notify";
import { parseValue, assertPercentBudget } from "@/server/destinations";

type Ctx = { params: Promise<{ id: string }> };

const Patch = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  method: z.enum(["FIXED", "PERCENT"]).optional(),
  value: z.string().trim().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).optional(),
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireVerifiedUser();
  const rule = await prisma.splitRule.findFirst({ where: { id: (await params).id, userId: user.id } });
  if (!rule) throw new HttpError(404, "Rule not found");
  const b = await body(req, Patch);
  if (b.status === "ACTIVE" && user.kycStatus !== "APPROVED") throw new HttpError(403, "Verify your identity to activate rules", "KYC_REQUIRED");
  const method = b.method ?? rule.method;
  if (b.method && b.method !== rule.method && b.value === undefined) throw new HttpError(422, "Enter a value for the new allocation method");
  const v = b.value !== undefined ? parseValue(method, b.value) : null;
  const finalStatus = b.status ?? rule.status;
  const finalBps = v ? v.percentBps : rule.percentBps;
  if (finalStatus === "ACTIVE" && method === "PERCENT" && finalBps) await assertPercentBudget(user.id, finalBps, rule.id);
  const updated = await prisma.splitRule.update({ where: { id: rule.id }, data: { name: b.name, priority: b.priority, status: b.status, method: b.method, ...(v ?? {}) } });
  await audit(user.id, "rule.update", { type: "SplitRule", id: rule.id }, { changes: Object.keys(b), from: { status: rule.status, priority: rule.priority } });
  return json(updated);
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireVerifiedUser();
  const rule = await prisma.splitRule.findFirst({ where: { id: (await params).id, userId: user.id } });
  if (!rule) throw new HttpError(404, "Rule not found");
  await prisma.splitRule.delete({ where: { id: rule.id } }); // execution items keep a snapshot; ruleId set null
  await audit(user.id, "rule.delete", { type: "SplitRule", id: rule.id }, { name: rule.name });
  return json({ ok: true });
});
