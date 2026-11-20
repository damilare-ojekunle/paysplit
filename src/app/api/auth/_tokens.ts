import type { EmailTokenType } from "@prisma/client";
import { prisma } from "@/server/db";
import { randomToken, sha256 } from "@/server/auth";
import { sendEmail } from "@/server/notify";
import { appUrl } from "@/server/env";

export async function issueToken(userId: string, type: EmailTokenType, ttlMinutes: number) {
  await prisma.emailToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } }); // invalidate older tokens
  const token = randomToken();
  await prisma.emailToken.create({ data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) } });
  return token;
}

export async function consumeToken(token: string, type: EmailTokenType) {
  const t = await prisma.emailToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!t || t.type !== type || t.usedAt || t.expiresAt < new Date()) return null;
  const res = await prisma.emailToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
  return res.count ? t : null;
}

export async function sendVerification(user: { id: string; email: string; firstName: string }) {
  const token = await issueToken(user.id, "VERIFY_EMAIL", 60 * 24);
  const link = `${appUrl()}/verify-email?token=${token}`;
  await sendEmail(user.email, "Welcome to PaySplit — verify your email", `<p>Hi ${user.firstName},</p><p>Welcome to PaySplit. Confirm your email to get started:</p><p><a href="${link}" style="background:#1e9bf0;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Verify email</a></p><p>This link expires in 24 hours.</p>`);
}
