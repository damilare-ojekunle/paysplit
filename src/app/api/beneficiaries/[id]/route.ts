import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { route, body, json, HttpError } from "@/server/http";
import { audit } from "@/server/notify";
import { BeneficiarySchema as Schema, validatedAccount } from "@/server/destinations";

type Ctx = { params: Promise<{ id: string }> };
async function own(userId: string, id: string) {
  const b = await prisma.beneficiary.findFirst({ where: { id, userId, archivedAt: null } });
  if (!b) throw new HttpError(404, "Beneficiary not found");
  return b;
}

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireVerifiedUser();
  const ben = await own(user.id, (await params).id);
  const b = await body(req, Schema.partial());
  let extra = {};
  const bankChanged = (b.bankCode && b.bankCode !== ben.bankCode) || (b.accountNumber && b.accountNumber !== ben.accountNumber);
  if (bankChanged) extra = await validatedAccount(b.bankCode ?? ben.bankCode, b.accountNumber ?? ben.accountNumber); // critical change: re-validate
  const updated = await prisma.beneficiary.update({ where: { id: ben.id }, data: { ...b, ...extra } });
  await audit(user.id, "beneficiary.update", { type: "Beneficiary", id: ben.id }, { fields: Object.keys(b), bankChanged });
  return json(updated);
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireVerifiedUser();
  const ben = await own(user.id, (await params).id);
  const open = await prisma.transfer.count({ where: { beneficiaryId: ben.id, status: { in: ["PENDING", "RETRYING"] } } });
  if (open) throw new HttpError(409, "This beneficiary has a transfer in progress. Try again once it completes.");
  await prisma.$transaction([prisma.splitRule.deleteMany({ where: { beneficiaryId: ben.id } }), prisma.beneficiary.update({ where: { id: ben.id }, data: { archivedAt: new Date() } })]);
  await audit(user.id, "beneficiary.archive", { type: "Beneficiary", id: ben.id });
  return json({ ok: true });
});
