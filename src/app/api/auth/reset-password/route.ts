import { z } from "zod";
import { prisma } from "@/server/db";
import { hashPassword, passwordOk, PASSWORD_RULES } from "@/server/auth";
import { route, body, json, HttpError } from "@/server/http";
import { audit, notify } from "@/server/notify";
import { consumeToken } from "../_tokens";

export const POST = route(async (req) => {
  const b = await body(req, z.object({ token: z.string().min(10).max(200), password: z.string(), confirmPassword: z.string() }));
  if (!passwordOk(b.password)) throw new HttpError(422, PASSWORD_RULES);
  if (b.password !== b.confirmPassword) throw new HttpError(422, "Passwords do not match");
  const t = await consumeToken(b.token, "RESET_PASSWORD");
  if (!t) throw new HttpError(400, "This reset link is invalid or has expired.");
  await prisma.$transaction([
    prisma.user.update({ where: { id: t.userId }, data: { passwordHash: await hashPassword(b.password), passwordChangedAt: new Date() } }),
    prisma.session.updateMany({ where: { userId: t.userId, revokedAt: null }, data: { revokedAt: new Date() } }), // sign out everywhere
  ]);
  await audit(t.userId, "auth.password_reset", { type: "User", id: t.userId });
  await notify(t.userId, { type: "security", title: "Password changed", body: "Your password was reset and all sessions were signed out.", dedupeKey: `pwreset:${t.id}`, email: { subject: "Your PaySplit password was changed", html: "<p>Your password was just reset. If this wasn't you, contact support immediately.</p>" } });
  return json({ ok: true });
});
