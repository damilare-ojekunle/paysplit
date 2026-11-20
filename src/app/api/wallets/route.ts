import { z } from "zod";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { route, body, json } from "@/server/http";
import { audit } from "@/server/notify";
import { walletsWithBalances } from "@/server/queries";
import { WALLET_CATEGORIES, WALLET_COLORS, amountMajor } from "@/server/validation";

export const GET = route(async () => json(await walletsWithBalances((await requireVerifiedUser()).id)));

const Schema = z.object({ name: z.string().trim().min(1).max(60), category: z.enum(WALLET_CATEGORIES), target: amountMajor.optional().or(z.literal("").transform(() => undefined)), description: z.string().trim().max(200).optional(), color: z.enum(WALLET_COLORS).optional() });

export const POST = route(async (req) => {
  const user = await requireVerifiedUser();
  const b = await body(req, Schema);
  const wallet = await prisma.$transaction(async (tx) => {
    const acct = await tx.ledgerAccount.create({ data: { type: "USER_WALLET", userId: user.id, name: `Wallet: ${b.name}` } });
    return tx.wallet.create({ data: { userId: user.id, name: b.name, category: b.category, targetMinor: b.target ?? null, description: b.description, color: b.color ?? null, ledgerAccountId: acct.id } });
  });
  await audit(user.id, "wallet.create", { type: "Wallet", id: wallet.id });
  return json(wallet, { status: 201 });
});
