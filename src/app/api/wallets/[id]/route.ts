import { z } from "zod";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { route, body, json, HttpError } from "@/server/http";
import { audit } from "@/server/notify";
import { balanceOf } from "@/server/ledger";
import { WALLET_CATEGORIES, amountMajor } from "@/server/validation";

type Ctx = { params: Promise<{ id: string }> };
async function own(userId: string, id: string) {
  const w = await prisma.wallet.findFirst({ where: { id, userId, archivedAt: null } });
  if (!w) throw new HttpError(404, "Wallet not found");
  return w;
}

const Patch = z.object({ name: z.string().trim().min(1).max(60).optional(), category: z.enum(WALLET_CATEGORIES).optional(), target: amountMajor.nullable().optional().or(z.literal("").transform(() => null)), description: z.string().trim().max(200).optional() });

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireVerifiedUser();
  const w = await own(user.id, (await params).id);
  const b = await body(req, Patch);
  const updated = await prisma.wallet.update({ where: { id: w.id }, data: { name: b.name, category: b.category, description: b.description, targetMinor: b.target === undefined ? undefined : b.target } });
  await audit(user.id, "wallet.update", { type: "Wallet", id: w.id }, { fields: Object.keys(b) });
  return json(updated);
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireVerifiedUser();
  const w = await own(user.id, (await params).id);
  const bal = await balanceOf(prisma, w.ledgerAccountId);
  if (bal !== 0n) throw new HttpError(409, "Move this wallet's balance to your salary account before removing it");
  await prisma.$transaction([prisma.splitRule.deleteMany({ where: { walletId: w.id } }), prisma.wallet.update({ where: { id: w.id }, data: { archivedAt: new Date() } })]);
  await audit(user.id, "wallet.archive", { type: "Wallet", id: w.id });
  return json({ ok: true });
});
