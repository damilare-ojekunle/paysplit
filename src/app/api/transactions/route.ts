import type { LedgerTxnType } from "@prisma/client";
import { requireVerifiedUser } from "@/server/auth";
import { route, json } from "@/server/http";
import { listTransactions } from "@/server/queries";

export const GET = route(async (req) => {
  const user = await requireVerifiedUser();
  const q = new URL(req.url).searchParams;
  const date = (k: string) => (q.get(k) ? new Date(q.get(k)!) : undefined);
  return json(await listTransactions(user.id, {
    type: (q.get("type") as LedgerTxnType) || undefined, status: q.get("status") || undefined, q: q.get("q") || undefined,
    from: date("from"), to: date("to"), walletId: q.get("walletId") || undefined, beneficiaryId: q.get("beneficiaryId") || undefined,
    page: Number(q.get("page") || 1), pageSize: Number(q.get("pageSize") || 20),
  }));
});
