import { z } from "zod";
import { prisma } from "@/server/db";
import { route, body, json, HttpError } from "@/server/http";
import { audit, notify } from "@/server/notify";
import { consumeToken } from "../_tokens";

export const POST = route(async (req) => {
  const { token } = await body(req, z.object({ token: z.string().min(10).max(200) }));
  const t = await consumeToken(token, "VERIFY_EMAIL");
  if (!t) throw new HttpError(400, "This verification link is invalid or has expired. Request a new one.");
  await prisma.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } });
  await audit(t.userId, "auth.email_verified", { type: "User", id: t.userId });
  await notify(t.userId, { type: "welcome", title: "Email verified", body: "Next: set up your profile and verify your identity to unlock transfers.", dedupeKey: `email-verified:${t.userId}` });
  return json({ ok: true });
});
