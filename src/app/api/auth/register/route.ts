import { z } from "zod";
import { prisma, isUniqueViolation } from "@/server/db";
import { hashPassword, passwordOk, PASSWORD_RULES, createSession, clientMeta } from "@/server/auth";
import { route, body, json, HttpError } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { audit } from "@/server/notify";
import { sendVerification } from "../_tokens";

const Schema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string(),
  confirmPassword: z.string(),
});

export const POST = route(async (req) => {
  const { ip } = await clientMeta();
  await rateLimit("register", ip, 10, 3600);
  const b = await body(req, Schema);
  if (!passwordOk(b.password)) throw new HttpError(422, PASSWORD_RULES);
  if (b.password !== b.confirmPassword) throw new HttpError(422, "Passwords do not match");
  let user;
  try {
    user = await prisma.user.create({ data: { firstName: b.firstName, lastName: b.lastName, email: b.email, passwordHash: await hashPassword(b.password) } });
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, "An account with this email already exists. Try signing in.");
    throw e;
  }
  await sendVerification(user);
  await createSession(user.id);
  await audit(user.id, "auth.register", { type: "User", id: user.id }, undefined, ip);
  return json({ ok: true }, { status: 201 });
});
