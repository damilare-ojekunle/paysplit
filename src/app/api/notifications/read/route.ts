import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { route, json } from "@/server/http";

export const POST = route(async () => {
  const u = await requireUser();
  await prisma.notification.updateMany({ where: { userId: u.id, readAt: null }, data: { readAt: new Date() } });
  return json({ ok: true });
});
