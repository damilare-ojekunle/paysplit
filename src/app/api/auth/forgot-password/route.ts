import { z } from "zod";
import { prisma } from "@/server/db";
import { clientMeta } from "@/server/auth";
import { route, body, json } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { sendEmail } from "@/server/notify";
import { appUrl } from "@/server/env";
import { issueToken } from "../_tokens";

export const POST = route(async (req) => {
  const { ip } = await clientMeta();
  await rateLimit("forgot-ip", ip, 10, 3600);
  const { email } = await body(req, z.object({ email: z.string().trim().toLowerCase().email() }));
  await rateLimit("forgot-email", email, 3, 3600);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = await issueToken(user.id, "RESET_PASSWORD", 30);
    const link = `${appUrl()}/reset-password?token=${token}`;
    await sendEmail(user.email, "Reset your PaySplit password", `<p>Use the link below to reset your password. It expires in 30 minutes.</p><p><a href="${link}">Reset password</a></p><p>If you didn't request this, you can ignore this email.</p>`);
  }
  return json({ ok: true }); // same response either way — no account enumeration
});
