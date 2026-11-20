import { z } from "zod";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { route, body, json } from "@/server/http";
import { audit } from "@/server/notify";

export const PATCH = route(async (req) => {
  const a = await requireAdmin();
  const b = await body(req, z.object({ firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().min(1).max(60), phone: z.string().trim().max(20).regex(/^[+\d\s-]*$/, "Invalid phone") }));
  await prisma.user.update({ where: { id: a.id }, data: { ...b, phone: b.phone || null } });
  await audit(a.id, "admin.profile_update", { type: "User", id: a.id }, { fields: Object.keys(b) });
  return json({ ok: true });
});
