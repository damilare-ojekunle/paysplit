import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { clientMeta, hashPassword, passwordOk, PASSWORD_RULES, requireUser, sha256, verifyPassword } from "@/server/auth";
import { route, body, json, HttpError } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { audit, notify } from "@/server/notify";

/** Change password while signed in. Requires the current password; signs out every other session. */
export const POST = route(async (req) => {
  const user = await requireUser();
  await rateLimit("change-password", user.id, 5, 900);
  const b = await body(req, z.object({ currentPassword: z.string().min(1), password: z.string(), confirmPassword: z.string() }));
  if (!(await verifyPassword(b.currentPassword, user.passwordHash))) throw new HttpError(422, "Your current password is incorrect");
  if (!passwordOk(b.password)) throw new HttpError(422, PASSWORD_RULES);
  if (b.password !== b.confirmPassword) throw new HttpError(422, "Passwords do not match");
  if (b.password === b.currentPassword) throw new HttpError(422, "Choose a password you haven't used here before");
  const current = (await cookies()).get("ps_session")?.value;
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(b.password), passwordChangedAt: now } }),
    prisma.session.updateMany({ where: { userId: user.id, revokedAt: null, ...(current ? { tokenHash: { not: sha256(current) } } : {}) }, data: { revokedAt: now } }),
  ]);
  await audit(user.id, "auth.password_changed", { type: "User", id: user.id }, undefined, (await clientMeta()).ip);
  await notify(user.id, { type: "security", title: "Password changed", body: "Your password was changed and your other sessions were signed out.", dedupeKey: `pwchange:${user.id}:${now.getTime()}`, email: { subject: "Your PaySplit password was changed", html: "<p>Your password was just changed. If this wasn't you, reset it immediately and contact support.</p>" } });
  return json({ ok: true });
});
