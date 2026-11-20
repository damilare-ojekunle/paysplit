import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { route, json } from "@/server/http";

export const GET = route(async () => {
  const u = await requireUser();
  // Types the user switched off for in-app (push) notifications; security/kyc can't be muted.
  const muted = Object.entries(((u.notifyPrefs ?? {}) as { inApp?: Record<string, boolean> }).inApp ?? {}).filter(([, on]) => on === false).map(([k]) => k);
  const where = { userId: u.id, ...(muted.length ? { type: { notIn: muted } } : {}) };
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { ...where, readAt: null } }),
  ]);
  return json({ items, unread });
});
