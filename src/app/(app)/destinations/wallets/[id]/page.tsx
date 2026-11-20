import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { balanceOf } from "@/server/ledger";
import { listTransactions } from "@/server/queries";
import { naira, fmtDate } from "@/lib/format";
import { formatBps } from "@/core/money";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { TxTable } from "@/components/tx-table";
import { DeleteButton, EditTarget, MoveToSalary } from "@/components/destination-forms";

export default async function WalletDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireVerifiedUser();
  const w = await prisma.wallet.findFirst({ where: { id: (await params).id, userId: user.id, archivedAt: null }, include: { rule: true } });
  if (!w) notFound();
  const [balance, allocated, moved, tx] = await Promise.all([
    balanceOf(prisma, w.ledgerAccountId),
    prisma.ledgerEntry.aggregate({ where: { accountId: w.ledgerAccountId, transaction: { type: "WALLET_ALLOCATION" } }, _sum: { amountMinor: true } }),
    prisma.ledgerEntry.aggregate({ where: { accountId: w.ledgerAccountId, transaction: { type: "WALLET_TO_SALARY" } }, _sum: { amountMinor: true } }),
    listTransactions(user.id, { walletId: w.id, pageSize: 10 }),
  ]);
  const pct = w.targetMinor ? Math.min(100, Number((balance * 100n) / w.targetMinor)) : null;
  return (
    <>
      <PageHeader title={w.name} crumbs={[{ href: "/destinations", label: "Destinations" }, { label: w.name }]} action={<div className="flex gap-2"><MoveToSalary walletId={w.id} balance={balance.toString()} disabledReason={user.kycStatus !== "APPROVED" ? "Verify your identity first" : undefined} /><DeleteButton url={`/api/wallets/${w.id}`} label="Remove wallet" confirmText="The wallet will be archived and its split rule deleted. Its history stays in your transactions. Wallets with a balance can't be removed." after="/destinations" /></div>} />
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="p-6 lg:col-span-2">
          <p className="text-sm text-muted">{w.category} · created {fmtDate(w.createdAt)}</p>
          <p className="tabular mt-2 text-4xl font-semibold">{naira(balance)}</p>
          <p className="text-sm text-muted">Available balance</p>
          <div className="mt-5">
            {pct !== null ? (<><div className="h-2.5 rounded-full bg-canvas"><div className="h-2.5 rounded-full bg-brand" style={{ width: `${pct}%` }} /></div><p className="mt-2 flex justify-between text-sm"><span>{pct}% of {naira(w.targetMinor!)} target</span><EditTarget walletId={w.id} current={w.targetMinor?.toString() ?? null} /></p><p className="mt-1 text-xs text-muted">Targets are informational — they don't lock funds.</p></>) : <EditTarget walletId={w.id} current={null} />}
          </div>
        </Card>
        <Card className="p-6"><p className="text-sm text-muted">Total allocated</p><p className="tabular mt-2 text-2xl font-semibold">{naira(-(allocated._sum.amountMinor ?? 0n))}</p></Card>
        <Card className="p-6"><p className="text-sm text-muted">Moved back to salary</p><p className="tabular mt-2 text-2xl font-semibold">{naira(moved._sum.amountMinor ?? 0n)}</p></Card>
      </div>
      <Card className="mt-6 p-6">
        <h2 className="text-lg font-medium">Split rule</h2>
        {w.rule ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p>{w.rule.name} · {w.rule.method === "FIXED" ? naira(w.rule.amountMinor!) : formatBps(w.rule.percentBps!)} · Priority {w.rule.priority} <Badge status={w.rule.status} /></p>
            <LinkButton href={`/rules/${w.rule.id}/edit`} variant="secondary" size="sm">Reconfigure rule</LinkButton>
          </div>
        ) : <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted">No rule yet — this wallet won't receive splits.</p><LinkButton href={`/rules/new?type=WALLET&dest=${w.id}`} size="sm">Create split rule</LinkButton></div>}
      </Card>
      <Card className="mt-6">
        <div className="flex items-center justify-between p-6 pb-4"><h2 className="text-lg font-medium">Activity</h2><Link href={`/transactions?walletId=${w.id}`} className="text-sm text-brand hover:underline">Full history</Link></div>
        <TxTable rows={tx.rows} emptyBody="Allocations into this wallet will appear here." />
      </Card>
    </>
  );
}
