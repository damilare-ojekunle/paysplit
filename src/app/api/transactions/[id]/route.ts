import { requireVerifiedUser } from "@/server/auth";
import { route, json, HttpError } from "@/server/http";
import { getTransaction } from "@/server/queries";

type Ctx = { params: Promise<{ id: string }> };
export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireVerifiedUser();
  const t = await getTransaction(user.id, (await params).id);
  if (!t) throw new HttpError(404, "Transaction not found");
  return json(t);
});
