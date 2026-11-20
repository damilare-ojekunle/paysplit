import { z } from "zod";
import { prisma } from "@/server/db";
import bcrypt from "bcryptjs";
import { verifyPassword, createSession, clientMeta } from "@/server/auth";
import { route, body, json, HttpError } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { audit, notify } from "@/server/notify";

const Schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1), admin: z.boolean().optional(), remember: z.boolean().optional() });
const DUMMY = bcrypt.hashSync("timing-equaliser", 12);

export const POST = route(async (req) => {
  const { ip, userAgent } = await clientMeta();
  await rateLimit("login-ip", ip, 20, 900);
  const b = await body(req, Schema);
  await rateLimit("login-email", b.email, 8, 900);
  const user = await prisma.user.findUnique({ where: { email: b.email } });
  const ok = await verifyPassword(b.password, user?.passwordHash ?? DUMMY); // same cost whether or not the user exists
  if (!user || !ok) {
    await audit(user?.id ?? null, "auth.login_failed", undefined, { email: b.email }, ip);
    throw new HttpError(401, "Incorrect email or password");
  }
  if (b.admin && user.role !== "ADMIN") throw new HttpError(403, "This account does not have admin access");
  await createSession(user.id, b.remember ?? true);
  await audit(user.id, "auth.login", { type: "User", id: user.id }, { userAgent }, ip);
  await notify(user.id, {
    type: "security",
    title: "New sign-in",
    body: `New sign-in to your account${userAgent ? ` from ${userAgent.slice(0, 60)}` : ""}.`,
    dedupeKey: `login:${user.id}:${Date.now()}`,
    email: { subject: "New sign-in to PaySplit", html: `<p>We noticed a new sign-in to your account at ${new Date().toUTCString()}.</p><p>If this wasn't you, reset your password immediately.</p>` },
  });
  return json({ ok: true, role: user.role, emailVerified: !!user.emailVerifiedAt });
});
