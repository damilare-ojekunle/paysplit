import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { route, json } from "@/server/http";

export const GET = route(async () => {
  const u = await requireUser();
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { userId: u.id, readAt: null } }),
  ]);
  return json({ items, unread });
});
