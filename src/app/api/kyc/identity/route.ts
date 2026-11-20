import { z } from "zod";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { route, body, json, HttpError } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { audit, notify } from "@/server/notify";
import { verificationProviderFor } from "@/server/providers";
import { ProviderUncertainError } from "@/server/providers/types";
import { idFingerprint, maskId } from "@/server/onboarding";

const Schema = z.object({ idType: z.enum(["BVN", "NIN"]), idNumber: z.string().regex(/^\d{11}$/, "Must be 11 digits") });

export const POST = route(async (req) => {
  const user = await requireVerifiedUser();
  if (user.kycStatus === "APPROVED") throw new HttpError(409, "You're already verified");
  if (!user.country || !user.phone) throw new HttpError(409, "Complete your profile (country and phone) first");
  await rateLimit("kyc-identity", user.id, 5, 3600);
  const b = await body(req, Schema);
  const provider = verificationProviderFor(user.country);
  let r;
  try {
    r = await provider.verifyIdentity({ idType: b.idType, idNumber: b.idNumber, firstName: user.firstName, lastName: user.lastName });
  } catch (e) {
    if (e instanceof ProviderUncertainError) throw new HttpError(503, "The verification service is temporarily unavailable. Please try again shortly.");
    throw e;
  }
  const passed = r.state === "IN_PROGRESS";
  const status = passed ? "IN_PROGRESS" : r.state;
  const v = await prisma.kycVerification.create({
    data: { userId: user.id, provider: provider.name, idType: b.idType, idNumberMasked: maskId(b.idNumber), providerRef: idFingerprint(b.idNumber), identityStatus: passed ? "APPROVED" : r.state, livenessStatus: "NOT_STARTED", status, failureReason: r.reason },
  });
  await prisma.user.update({ where: { id: user.id }, data: { kycStatus: status } });
  await audit(user.id, "kyc.identity", { type: "KycVerification", id: v.id }, { idType: b.idType, result: r.state });
  if (!passed) await notify(user.id, { type: "kyc", title: "Identity check needs attention", body: r.reason || "We couldn't verify your identity.", dedupeKey: `kyc-id:${v.id}`, email: { subject: "Your PaySplit identity check", html: `<p>We couldn't complete your identity check: ${r.reason || "please try again"}.</p>` } });
  return json({ ok: passed, status, reason: r.reason, verificationId: v.id });
});
