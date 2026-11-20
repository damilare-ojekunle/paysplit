import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireAdmin, clientMeta } from "@/server/auth";
import { route, body, json, HttpError } from "@/server/http";
import { audit } from "@/server/notify";
import { paymentProvider } from "@/server/providers";
import { appUrl } from "@/server/env";
import { amountMajor } from "@/server/validation";

export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const b = await body(req, z.object({ userId: z.string(), amount: amountMajor }));
  const user = await prisma.user.findUnique({ where: { id: b.userId }, include: { collectionAccount: true } });
  if (!user) throw new HttpError(404, "User not found");
  if (user.kycStatus !== "APPROVED") throw new HttpError(409, "User is not verified");
  if (user.collectionAccount?.status !== "ACTIVE") throw new HttpError(409, "User has no active salary account");
  const txRef = `salary-${user.id}-${crypto.randomBytes(4).toString("hex")}`;
  const { url } = await paymentProvider().createTestPayinLink({ txRef, amountMinor: b.amount, email: user.email, name: `${user.firstName} ${user.lastName}`, redirectUrl: `${appUrl()}/api/payins/callback` });
  await audit(admin.id, "admin.payin_initiated", { type: "User", id: user.id }, { amount: b.amount.toString(), txRef }, (await clientMeta()).ip);
  return json({ url, txRef });
});
