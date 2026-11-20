import { z } from "zod";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { route, body, json, HttpError } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { audit, notify } from "@/server/notify";
import { verificationProviderFor } from "@/server/providers";
import { ProviderUncertainError } from "@/server/providers/types";
import { idFingerprint, provisionCollectionAccount } from "@/server/onboarding";

const Schema = z.object({
  verificationId: z.string(),
  idNumber: z.string().regex(/^\d{11}$/),
  selfie: z.string().startsWith("data:image/").max(3_000_000, "Image too large"),
});

export const POST = route(async (req) => {
  const user = await requireVerifiedUser();
  await rateLimit("kyc-liveness", user.id, 6, 3600);
  const b = await body(req, Schema);
  const v = await prisma.kycVerification.findFirst({ where: { id: b.verificationId, userId: user.id } });
  if (!v || v.identityStatus !== "APPROVED") throw new HttpError(409, "Complete the identity step first");
  if (v.providerRef !== idFingerprint(b.idNumber)) throw new HttpError(422, "ID number doesn't match the one you verified");
  let r;
  try {
    r = await verificationProviderFor(user.country).verifyLiveness({ idType: v.idType as "BVN" | "NIN", idNumber: b.idNumber, selfieBase64: b.selfie });
  } catch (e) {
    if (e instanceof ProviderUncertainError) throw new HttpError(503, "The verification service is temporarily unavailable. Your progress is saved — please try again shortly.");
    throw e;
  }
  const approved = r.state === "APPROVED";
  const status = approved ? "APPROVED" : r.state === "REJECTED" ? "ACTION_REQUIRED" : r.state; // allow retake
  await prisma.kycVerification.update({ where: { id: v.id }, data: { livenessStatus: r.state, status, failureReason: r.reason ?? null } });
  const updated = await prisma.user.update({ where: { id: user.id }, data: { kycStatus: status } });
  await audit(user.id, "kyc.liveness", { type: "KycVerification", id: v.id }, { result: r.state });
  await notify(user.id, {
    type: "kyc",
    title: approved ? "Identity verified" : "Liveness check needs a retake",
    body: approved ? "You're verified. Your salary account is being set up." : r.reason || "Please retake your selfie.",
    dedupeKey: `kyc-live:${v.id}:${r.state}`,
    email: approved ? { subject: "You're verified on PaySplit", html: "<p>Your identity has been verified. Transfers and automatic splits are now unlocked.</p>" } : undefined,
  });
  let account = null;
  if (approved) account = await provisionCollectionAccount(updated, v.idType === "BVN" ? b.idNumber : undefined);
  return json({ ok: approved, status, reason: r.reason, account: account && { status: account.status, accountNumber: account.accountNumber, bankName: account.bankName } });
});
