import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { naira, fmtDateTime } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/components/ui";

export default async function ExecutionDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireVerifiedUser();
  const e = await prisma.splitExecution.findFirst({ where: { id: (await params).id, userId: user.id }, include: { items: { include: { transfer: true }, orderBy: { priority: "asc" } }, payin: true } });
  if (!e) notFound();
  const ledger = await prisma.ledgerTransaction.findMany({ where: { userId: user.id, metadata: { path: ["executionId"], equals: e.id } }, select: { id: true, metadata: true } });
  const txFor = (itemId: string, transferId: string | null) => ledger.find((l) => { const m = l.metadata as Record<string, string>; return m.itemId === itemId || (transferId && m.transferId === transferId); })?.id;
  return (
    <>
      <PageHeader title={`Split · ${fmtDateTime(e.createdAt)}`} crumbs={[{ href: "/rules", label: "Split Rules" }, { label: "Split detail" }]} action={<Badge status={e.status} className="text-sm" />} />
      <div className="grid gap-4 sm:grid-cols-4">
        {[["Salary used", e.availableMinor], ["Percentage base", e.baseMinor], ["Allocated", e.allocatedMinor], ["Remaining in salary account", e.remainingMinor]].map(([k, v]) => <Card key={k as string} className="p-5"><p className="text-sm text-muted">{k as string}</p><p className="tabular mt-1 text-xl font-semibold">{naira(v as bigint)}</p></Card>)}
      </div>
      <p className="mt-4 text-sm text-muted">{e.trigger === "AUTO" ? `Triggered automatically by salary ${e.payin ? `of ${naira(e.payin.amountMinor)}` : ""}.` : "Triggered manually with Run now."} Reference {e.idempotencyKey.split(":")[0].toUpperCase()}-{e.id.slice(-8).toUpperCase()}</p>
      <Card className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line bg-canvas text-left text-xs text-muted"><tr><th className="px-6 py-3 font-medium">#</th><th className="px-3 py-3 font-medium">Rule</th><th className="px-3 py-3 font-medium">Destination</th><th className="px-3 py-3 text-right font-medium">Requested</th><th className="px-3 py-3 text-right font-medium">Actual</th><th className="px-3 py-3 font-medium">Status</th><th className="px-6 py-3 font-medium">Details</th></tr></thead>
          <tbody>
            {e.items.map((i) => {
              const tx = txFor(i.id, i.transferId);
              return (
                <tr key={i.id} className="border-b border-line last:border-0">
                  <td className="px-6 py-3">{i.priority}</td>
                  <td className="px-3 py-3">{i.ruleName} <span className="text-muted">({i.ruleValue})</span></td>
                  <td className="px-3 py-3">{i.destinationName} <span className="text-xs text-muted">{i.destinationType === "WALLET" ? "wallet" : "beneficiary"}</span></td>
                  <td className="tabular px-3 py-3 text-right">{naira(i.requestedMinor)}</td>
                  <td className="tabular px-3 py-3 text-right">{naira(i.status === "SKIPPED" || i.status === "FAILED" ? 0n : i.allocatedMinor)}</td>
                  <td className="px-3 py-3"><Badge status={i.status} />{i.transfer?.status === "RETRYING" && <span className="ml-1 text-xs text-warn">retrying</span>}</td>
                  <td className="px-6 py-3 text-xs text-muted">{i.skipReason ?? (i.transfer ? `Ref ${i.transfer.reference}` : "")} {tx && <Link href={`/transactions/${tx}`} className="text-brand hover:underline">View</Link>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
