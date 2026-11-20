import { requireKycUser } from "@/server/auth";
import { route, json } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { provisionCollectionAccount } from "@/server/onboarding";

/** Retry provisioning when it previously failed or is pending. */
export const POST = route(async () => {
  const user = await requireKycUser();
  await rateLimit("provision", user.id, 5, 3600);
  const a = await provisionCollectionAccount(user);
  return json({ status: a.status, accountNumber: a.accountNumber, bankName: a.bankName, accountName: a.accountName, failureReason: a.failureReason });
});
