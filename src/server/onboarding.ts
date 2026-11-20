import crypto from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";
import { paymentProvider } from "./providers";
import { notify, audit } from "./notify";
import { log } from "./log";

/** Keyed hash of an identifier so we can confirm a re-submitted BVN/NIN without storing it. */
export function idFingerprint(idNumber: string) {
  return crypto.createHmac("sha256", env.SESSION_SECRET || env.DATABASE_URL).update(idNumber).digest("hex");
}
export const maskId = (id: string) => "•".repeat(Math.max(0, id.length - 4)) + id.slice(-4);

/** Provision (or retry) the user's dedicated salary collection account. Idempotent. */
export async function provisionCollectionAccount(user: User, bvn?: string) {
  const existing = await prisma.collectionAccount.findUnique({ where: { userId: user.id } });
  if (existing?.status === "ACTIVE") return existing;
  const provider = paymentProvider();
  const res = await provider.createCollectionAccount({ userId: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone, bvn });
  const data = { provider: provider.name, providerRef: res.providerRef, accountNumber: res.accountNumber, accountName: res.accountName, bankName: res.bankName, status: res.status, failureReason: res.failureReason ?? null };
  const acct = await prisma.collectionAccount.upsert({ where: { userId: user.id }, update: data, create: { userId: user.id, ...data } });
  await audit(user.id, "collection_account.provision", { type: "CollectionAccount", id: acct.id }, { status: acct.status });
  if (acct.status === "ACTIVE") {
    await notify(user.id, { type: "account", title: "Salary account ready", body: `Your PaySplit salary account is ${acct.accountNumber} (${acct.bankName}). Share it with your employer.`, dedupeKey: `acct-ready:${acct.id}`, email: { subject: "Your PaySplit salary account is ready", html: `<p>Account number: <b>${acct.accountNumber}</b><br/>Bank: ${acct.bankName}<br/>Account name: ${acct.accountName}</p><p>Share these details with your employer or payroll team.</p>` } });
  } else log.warn("collection_account_not_active", { userId: user.id, status: acct.status });
  return acct;
}
