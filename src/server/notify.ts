import { prisma, isUniqueViolation } from "./db";
import { env, appUrl } from "./env";
import { log } from "./log";

/** Transactional email via Brevo. Falls back to logging in local dev when no key is configured. */
export async function sendEmail(to: string, subject: string, html: string) {
  if (!env.BREVO_API_KEY || !env.EMAIL_FROM) {
    log.info("email_skipped_no_provider", { subject });
    if (process.env.NODE_ENV !== "production") console.log(`\n--- EMAIL to ${to}: ${subject}\n${html.replace(/<[^>]+>/g, " ")}\n---\n`);
    return;
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ sender: { email: env.EMAIL_FROM, name: "PaySplit" }, to: [{ email: to }], subject, htmlContent: layout(subject, html) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) log.warn("email_failed", { subject, status: res.status });
  } catch (e) {
    log.warn("email_failed", { subject, err: (e as Error).message });
  }
}

function layout(title: string, inner: string) {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#0f172a">
  <div style="font-weight:700;font-size:18px;color:#1e9bf0;margin-bottom:16px">PaySplit</div>
  <h2 style="font-size:18px;margin:0 0 12px">${title}</h2>${inner}
  <p style="color:#64748b;font-size:12px;margin-top:24px">You are receiving this because you have a PaySplit account. <a href="${appUrl()}/settings">Manage notifications</a></p></div>`;
}

const MANDATORY = new Set(["security", "kyc", "welcome"]);

/**
 * In-app notification + optional email. `dedupeKey` guarantees one notification per event,
 * even when webhooks are retried.
 */
export async function notify(userId: string, opts: { type: string; title: string; body: string; dedupeKey: string; email?: { subject: string; html: string } }) {
  try {
    await prisma.notification.create({ data: { userId, type: opts.type, title: opts.title, body: opts.body, dedupeKey: opts.dedupeKey } });
  } catch (e) {
    if (isUniqueViolation(e)) return; // already sent
    throw e;
  }
  if (!opts.email) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, notifyEmail: true, notifyPrefs: true } });
  if (!user) return;
  if (!MANDATORY.has(opts.type)) {
    if (!user.notifyEmail) return;
    const emailPrefs = ((user.notifyPrefs ?? {}) as { email?: Record<string, boolean> }).email ?? {};
    if (emailPrefs[opts.type] === false) return; // per-category opt-out
  }
  await sendEmail(user.email, opts.email.subject, opts.email.html);
}

export async function audit(actorId: string | null, action: string, target?: { type: string; id: string }, metadata?: Record<string, unknown>, ip?: string) {
  await prisma.auditLog.create({
    data: { actorId, action, targetType: target?.type, targetId: target?.id, metadata: metadata as object | undefined, ip },
  });
}
