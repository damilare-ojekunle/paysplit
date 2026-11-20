import { requireVerifiedUser } from "@/server/auth";
import { route, HttpError } from "@/server/http";
import { getTransaction } from "@/server/queries";
import { receiptPdf } from "@/server/documents";

type Ctx = { params: Promise<{ id: string }> };
export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireVerifiedUser();
  const t = await getTransaction(user.id, (await params).id);
  if (!t) throw new HttpError(404, "Transaction not found");
  if (t.status !== "SUCCESS") throw new HttpError(409, "Receipts are available once a transaction succeeds");
  const bytes = await receiptPdf(t, { name: `${user.firstName} ${user.lastName}`, email: user.email });
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="receipt-${t.reference}.pdf"` } });
});
