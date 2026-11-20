import { requireUser } from "@/server/auth";
import { route, json } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { sendVerification } from "../_tokens";

export const POST = route(async () => {
  const user = await requireUser();
  await rateLimit("resend-verify", user.id, 3, 900);
  if (!user.emailVerifiedAt) await sendVerification(user);
  return json({ ok: true });
});
