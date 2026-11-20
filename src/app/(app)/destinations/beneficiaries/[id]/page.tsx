import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { listTransactions } from "@/server/queries";
import { naira, fmtDate, maskAcct } from "@/lib/format";
import { formatBps } from "@/core/money";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { TxTable } from "@/components/tx-table";
import { DeleteButton } from "@/components/destination-forms";

export default async function BeneficiaryDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireVerifiedUser();
  const b = await prisma.beneficiary.findFirst({ where: { id: (await params).id, userId: user.id, archivedAt: null }, include: { rule: true } });
  if (!b) notFound();
  const tx = await listTransactions(user.id, { beneficiaryId: b.id, pageSize: 10 });
  const rows: [string, string][] = [["Category", b.category], ["Bank", b.bankName], ["Account number", maskAcct(b.accountNumber)], ["Account name", b.accountName ?? "—"], ["Narration", b.narration ?? "—"], ["Date added", fmtDate(b.createdAt)]];
  return (
    <>
      <PageHeader title={b.name} crumbs={[{ href: "/destinations?tab=beneficiaries", label: "Destinations" }, { label: b.name }]} action={<DeleteButton url={`/api/beneficiaries/${b.id}`} label="Remove beneficiary" confirmText="The beneficiary and its split rule will be removed. Past transfers stay in your history." after="/destinations?tab=beneficiaries" />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="p-6"><h2 className="mb-4 text-lg font-medium">Payment details</h2><dl className="space-y-3 text-sm">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>)}</dl></Card>
        <Card className="p-6">
          <h2 className="text-lg font-medium">Split rule</h2>
          {b.rule ? (<div className="mt-3 space-y-3"><p>{b.rule.name} · {b.rule.method === "FIXED" ? naira(b.rule.amountMinor!) : formatBps(b.rule.percentBps!)} · Priority {b.rule.priority} <Badge status={b.rule.status} /></p><LinkButton href={`/rules/${b.rule.id}/edit`} variant="secondary" size="sm">Reconfigure rule</LinkButton></div>)
            : <div className="mt-3 space-y-3"><p className="text-sm text-muted">No rule yet — this beneficiary won't be paid automatically.</p><LinkButton href={`/rules/new?type=BENEFICIARY&dest=${b.id}`} size="sm">Create split rule</LinkButton></div>}
        </Card>
      </div>
      <Card className="mt-6"><h2 className="p-6 pb-4 text-lg font-medium">Transfers</h2><TxTable rows={tx.rows} emptyBody="Transfers to this beneficiary will appear here." /></Card>
    </>
  );
}
