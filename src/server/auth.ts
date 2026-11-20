import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import type { User } from "@prisma/client";
import { prisma } from "./db";
import { HttpError } from "./http";

const COOKIE = "ps_session";
const SESSION_DAYS = 7;

export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const randomToken = () => crypto.randomBytes(32).toString("base64url");

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function clientMeta() {
  const h = await headers();
  return { ip: (h.get("x-forwarded-for") || "").split(",")[0].trim() || "local", userAgent: h.get("user-agent") || "" };
}

/** `remember` = 7-day persistent cookie; otherwise a browser-session cookie backed by a 12-hour server session. */
export async function createSession(userId: string, remember = true) {
  const token = randomToken();
  const { ip, userAgent } = await clientMeta();
  const expiresAt = new Date(Date.now() + (remember ? SESSION_DAYS * 864e5 : 12 * 3600e3));
  await prisma.session.create({ data: { userId, tokenHash: sha256(token), expiresAt, ip, userAgent } });
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", ...(remember ? { expires: expiresAt } : {}) });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.session.updateMany({ where: { tokenHash: sha256(token) }, data: { revokedAt: new Date() } });
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!s || s.revokedAt || s.expiresAt < new Date()) return null;
  return s.user;
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Please sign in");
  return u;
}

/** Email verified — allows configuration and viewing. */
export async function requireVerifiedUser(): Promise<User> {
  const u = await requireUser();
  if (!u.emailVerifiedAt) throw new HttpError(403, "Verify your email to continue", "EMAIL_UNVERIFIED");
  return u;
}

/** KYC approved — required for any money movement (enforced server-side, not just in the UI). */
export async function requireKycUser(): Promise<User> {
  const u = await requireVerifiedUser();
  if (u.kycStatus !== "APPROVED") throw new HttpError(403, "Complete identity verification to move money", "KYC_REQUIRED");
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "ADMIN") throw new HttpError(403, "Admins only");
  return u;
}

export const PASSWORD_RULES = "At least 8 characters, with an uppercase letter, a lowercase letter and a number.";
export function passwordOk(p: string) {
  return p.length >= 8 && p.length <= 128 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);
}
