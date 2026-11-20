import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { route, HttpError } from "@/server/http";
import { listTransactions, type TxRow } from "@/server/queries";
import { statementCsv, statementPdf, type Statement } from "@/server/documents";
import { audit } from "@/server/notify";

/** Effect of a transaction on the user's total holdings (salary + wallets). Internal moves net to zero. */
const effect = (r: TxRow) => {
  if (r.type === "SALARY_IN" || r.type === "TRANSFER_REVERSAL") return r.amountMinor;
  if (r.type === "TRANSFER_OUT") return -r.amountMinor;
  return 0n;
};

export const GET = route(async (req) => {
  const user = await requireVerifiedUser();
  const q = new URL(req.url).searchParams;
  const to = q.get("to") ? new Date(q.get("to")! + "T23:59:59.999Z") : new Date();
  const from = q.get("from") ? new Date(q.get("from")! + "T00:00:00Z") : new Date(to.getTime() - 30 * 864e5);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) throw new HttpError(422, "Invalid date range");
  const format = q.get("format") === "pdf" ? "pdf" : "csv";

  // Opening balance straight from the ledger: user-owned accounts are credit-normal liabilities.
  const before = await prisma.ledgerEntry.aggregate({ where: { account: { userId: user.id }, createdAt: { lt: from } }, _sum: { amountMinor: true } });
  const opening = -(before._sum.amountMinor ?? 0n);
  const { rows } = await listTransactions(user.id, { from, to, pageSize: 100000 });
  rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  let running = opening, totalIn = 0n, totalOut = 0n;
  const withRunning = rows.map((r) => {
    const e = effect(r);
    if (e > 0n) totalIn += e; else totalOut -= e;
    running += e;
    return { ...r, effect: e, running };
  });
  // Reconciliation check: statement closing must equal the ledger-derived balance at `to`.
  const atEnd = await prisma.ledgerEntry.aggregate({ where: { account: { userId: user.id }, createdAt: { lte: to } }, _sum: { amountMinor: true } });
  const ledgerClosing = -(atEnd._sum.amountMinor ?? 0n);
  if (ledgerClosing !== running) throw new HttpError(500, "Statement failed reconciliation — please contact support");

  const s: Statement = { owner: { name: `${user.firstName} ${user.lastName}`, email: user.email }, from, to, opening, closing: running, totalIn, totalOut, rows: withRunning };
  await audit(user.id, "statement.download", undefined, { format, from, to });
  const name = `paysplit-statement-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}`;
  if (format === "csv") return new Response(statementCsv(s), { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${name}.csv"` } });
  return new Response(Buffer.from(await statementPdf(s)), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` } });
});
