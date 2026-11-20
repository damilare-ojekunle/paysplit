import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { route, body, json } from "@/server/http";
import { audit } from "@/server/notify";
import { rateLimit } from "@/server/ratelimit";
import { BeneficiarySchema as Schema, validatedAccount } from "@/server/destinations";

export const GET = route(async () => {
  const user = await requireVerifiedUser();
  return json(await prisma.beneficiary.findMany({ where: { userId: user.id, archivedAt: null }, include: { rule: true }, orderBy: { createdAt: "asc" } }));
});

export const POST = route(async (req) => {
  const user = await requireVerifiedUser();
  await rateLimit("beneficiary-create", user.id, 20, 3600);
  const b = await body(req, Schema);
  const { bankName, accountName } = await validatedAccount(b.bankCode, b.accountNumber);
  const ben = await prisma.beneficiary.create({ data: { userId: user.id, ...b, bankName, accountName } });
  await audit(user.id, "beneficiary.create", { type: "Beneficiary", id: ben.id });
  return json(ben, { status: 201 });
});
