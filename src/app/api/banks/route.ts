import { requireVerifiedUser } from "@/server/auth";
import { route, json } from "@/server/http";
import { paymentProvider } from "@/server/providers";

let cache: { at: number; banks: { code: string; name: string }[] } | null = null;

export const GET = route(async () => {
  await requireVerifiedUser();
  if (!cache || Date.now() - cache.at > 6 * 3600_000) cache = { at: Date.now(), banks: await paymentProvider().listBanks() };
  return json(cache.banks);
});
