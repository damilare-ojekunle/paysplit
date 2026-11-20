import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { naira, fmtDateTime } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/components/ui";

export default async function AdminRun({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const e = await prisma.splitExecution.findUnique({ where: { id: (await params).id }, include: { user: true, payin: true, items: { include: { transfer: true }, orderBy: { priority: "asc" } } } });
  if (!e) notFound();
  const initiator = e.payin?.initiatedBy ? await prisma.user.findUnique({ where: { id: e.payin.initiatedBy }, select: { email: true } }) : null;
  return (
    <>
      <PageHeader title={`Run · ${e.user.firstName} ${e.user.lastName}`} crumbs={[{ href: "/admin/payins", label: "Pay-ins" }, { label: fmtDateTime(e.createdAt) }]} action={<Badge status={e.status} />} />
      <div className="grid gap-4 sm:grid-cols-4">
        {[["Submitted & confirmed", e.payin?.amountMinor ?? e.availableMinor], ["Allocated", e.allocatedMinor], ["Remaining", e.remainingMinor]].map(([k, v]) => <Card key={k as string} className="p-5"><p className="text-sm text-muted">{k as string}</p><p className="tabular mt-1 text-xl font-semibold">{naira(v as bigint)}</p></Card>)}
        <Card className="p-5 text-sm"><p className="text-muted">Provider ref</p><p className="font-mono">{e.payin?.providerRef ?? "—"}</p><p className="mt-1 text-xs text-muted">by {initiator?.email ?? "webhook"}</p></Card>
      </div>
      <Card className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="border-b border-line bg-panel-2 text-left text-xs text-muted"><tr><th className="px-6 py-3">#</th><th className="px-3 py-3">Destination</th><th className="px-3 py-3 text-right">Requested</th><th className="px-3 py-3 text-right">Allocated</th><th className="px-3 py-3">Status</th><th className="px-6 py-3">Reason / reference</th></tr></thead>
          <tbody>{e.items.map((i) => <tr key={i.id} className="border-b border-line"><td className="px-6 py-3">{i.priority}</td><td className="px-3 py-3">{i.destinationName} <span className="text-xs text-muted">({i.ruleValue})</span></td><td className="tabular px-3 py-3 text-right">{naira(i.requestedMinor)}</td><td className="tabular px-3 py-3 text-right">{naira(["SKIPPED", "FAILED"].includes(i.status) ? 0n : i.allocatedMinor)}</td><td className="px-3 py-3"><Badge status={i.status} /></td><td className="px-6 py-3 text-xs text-muted">{i.skipReason ?? i.transfer?.reference ?? ""}</td></tr>)}</tbody>
        </table>
      </Card>
    </>
  );
}
