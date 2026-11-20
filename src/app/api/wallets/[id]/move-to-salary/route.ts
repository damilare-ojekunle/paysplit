import { z } from "zod";
import { requireKycUser } from "@/server/auth";
import { route, body, json } from "@/server/http";
import { audit } from "@/server/notify";
import { moveWalletToSalary } from "@/server/money-service";
import { amountMajor } from "@/server/validation";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireKycUser();
  const { id } = await params;
  const b = await body(req, z.object({ amount: amountMajor, idempotencyKey: z.string().min(8).max(64) }));
  const txn = await moveWalletToSalary(user.id, id, b.amount, b.idempotencyKey);
  await audit(user.id, "wallet.move_to_salary", { type: "Wallet", id }, { amount: b.amount.toString() });
  return json({ ok: true, transactionId: txn.id });
});
