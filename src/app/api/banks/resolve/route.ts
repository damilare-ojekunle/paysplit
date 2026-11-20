import { z } from "zod";
import { requireVerifiedUser } from "@/server/auth";
import { route, body, json, HttpError } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { paymentProvider } from "@/server/providers";

export const POST = route(async (req) => {
  const user = await requireVerifiedUser();
  await rateLimit("resolve", user.id, 30, 600);
  const b = await body(req, z.object({ bankCode: z.string().min(2).max(10), accountNumber: z.string().regex(/^\d{10}$/, "Account number must be 10 digits") }));
  try {
    return json(await paymentProvider().resolveAccount(b.bankCode, b.accountNumber));
  } catch {
    throw new HttpError(422, "We couldn't find that account. Check the bank and account number.");
  }
});
