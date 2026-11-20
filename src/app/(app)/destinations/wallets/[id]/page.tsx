import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { balanceOf } from "@/server/ledger";
import { listTransactions } from "@/server/queries";
import { destinationOptions, ruleForForm, ruleQualifiers } from "@/server/rule-page-data";
import { naira, fmtDate } from "@/lib/format";
import { formatBps } from "@/core/money";
import { Badge, Empty, PageHeader, Pagination, Panel, SearchBox, Segmented, TablePanel } from "@/components/ui";
import { DeleteButton, MoveToSalary, WalletModalButton } from "@/components/destination-forms";
import { GoalBar, WalletTxRows } from "@/components/destination-view";
import { RuleModalButton } from "@/components/rule-form";

const TABS = { all: undefined, allocated: "WALLET_ALLOCATION", moved: "WALLET_TO_SALARY" } as const;

export default async function WalletDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ f?: string; q?: string; page?: string }> }) {
  const user = await requireVerifiedUser();
  const sp = await searchParams;
  const w = await prisma.wallet.findFirst({ where: { id: (await params).id, userId: user.id, archivedAt: null }, include: { rule: true } });
  if (!w) notFound();
  const f = (sp.f && sp.f in TABS ? sp.f : "all") as keyof typeof TABS;
  const page = Math.max(1, Number(sp.page) || 1);
  const [balance, allocated, moved, tx, dests] = await Promise.all([
    balanceOf(prisma, w.ledgerAccountId),
    prisma.ledgerEntry.aggregate({ where: { accountId: w.ledgerAccountId, transaction: { type: "WALLET_ALLOCATION" } }, _sum: { amountMinor: true } }),
    prisma.ledgerEntry.aggregate({ where: { accountId: w.ledgerAccountId, transaction: { type: "WALLET_TO_SALARY" } }, _sum: { amountMinor: true } }),
    listTransactions(user.id, { walletId: w.id, type: TABS[f], q: sp.q || undefined, page, pageSize: 10 }),
    destinationOptions(user.id),
  ]);
  const pct = w.targetMinor ? Math.min(100, Number((balance * 100n) / w.targetMinor)) : null;
  const kycOk = user.kycStatus === "APPROVED";
  const base = `/destinations/wallets/${w.id}`;
  const href = (o: Record<string, string | undefined>) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries({ f: f !== "all" ? f : undefined, q: sp.q, ...o })) if (v) p.set(k, v); const s = p.toString(); return s ? `${base}?${s}` : base; };
  const pages = Math.max(1, Math.ceil(tx.total / tx.pageSize));
  const ruleValue = w.rule ? (w.rule.method === "FIXED" ? naira(w.rule.amountMinor!) : formatBps(w.rule.percentBps!)) : null;

  return (
    <>
      <PageHeader title="Destinations" crumbs={[{ href: "/dashboard", label: "Dashboard" }, { href: "/destinations", label: "Destinations" }, { label: w.name }]} />
      <Panel className="space-y-4 sm:-mx-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-1">
          <h1 className="flex items-center gap-3 text-lg"><Link href="/destinations" aria-label="Back to destinations" className="grid size-8 place-items-center rounded-lg hover:bg-panel"><ArrowLeft size={20} /></Link>{w.name}</h1>
          <div className="flex items-center gap-4">
            <WalletModalButton trigger="edit" existing={{ id: w.id, name: w.name, category: w.category, target: w.targetMinor?.toString() ?? null, color: w.color }} />
            <DeleteButton icon url={`/api/wallets/${w.id}`} label="Remove wallet" confirmText="The wallet will be archived and its split rule deleted. Its history stays in your transactions. Wallets with a balance can't be removed." after="/destinations" />
            <MoveToSalary walletId={w.id} balance={balance.toString()} disabledReason={!kycOk ? "Verify your identity first" : undefined} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat title="Available Balance" value={naira(balance)} sub="Available in wallet" />
          <Stat title="Total Allocated" value={naira(-(allocated._sum.amountMinor ?? 0n))} sub="Cumulative salary split" href={href({ f: "allocated" })} />
          <Stat title="Total Moved back" value={naira(moved._sum.amountMinor ?? 0n)} sub="Transferred to main salary" href={href({ f: "moved" })} />
          <div className="kpi-card rounded-2xl p-5">
            <p className="text-[15px]">Goal Progress Target</p>
            {pct !== null ? (
              <div className="mt-11"><p className="flex justify-between text-xs"><span className="text-muted">Target: <span className="text-ink">{naira(w.targetMinor!)}</span></span><b className="font-semibold">{pct}%</b></p><GoalBar pct={pct} /></div>
            ) : <p className="mt-11 text-sm text-muted">No target set. Use Edit Wallet to add one. Targets don't lock funds.</p>}
          </div>
        </div>

        <h2 className="px-2 pt-2 text-lg">Linked Rule</h2>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white p-5">
          {w.rule ? (
            <>
              <div><p className="text-[13px] text-muted">Allocation Method/Value</p><p className="mt-1.5 text-lg font-medium">{ruleValue} <Badge status={w.rule.status} className="ml-1 align-middle" /></p><p className="mt-1 text-xs text-muted">{w.rule.name} · priority {w.rule.priority}{ruleQualifiers(w.rule) ? ` · ${ruleQualifiers(w.rule)}` : ""}</p></div>
              <div className="flex items-center gap-4"><span className="text-[13px] text-muted">Last Modified: {fmtDate(w.rule.updatedAt)}</span><RuleModalButton trigger="reconfigure" destinations={dests} kycOk={kycOk} existing={ruleForForm(w.rule)} /></div>
            </>
          ) : (
            <>
              <div><p className="text-[13px] text-muted">Allocation Method/Value</p><p className="mt-1.5 text-sm text-muted">No rule yet. This wallet won't receive splits.</p></div>
              <RuleModalButton trigger="create-for" destinations={dests} kycOk={kycOk} preset={{ type: "WALLET", dest: w.id }} />
            </>
          )}
        </div>

        <TablePanel
          title="Wallet Transaction History"
          tools={<><SearchBox action={base} defaultValue={sp.q} hidden={{ f: f !== "all" ? f : undefined }} /><Segmented label="Wallet activity" active={f} items={[{ key: "all", label: "All", href: href({ f: undefined }) }, { key: "allocated", label: "Allocated", href: href({ f: "allocated" }) }, { key: "moved", label: "Moved", href: href({ f: "moved" }) }]} /></>}
          footer={<><span>Showing {tx.rows.length} of {tx.total.toLocaleString()} activity entries</span><Pagination page={page} pages={pages} href={(p) => href({ page: p > 1 ? String(p) : undefined })} /></>}
        >
          {tx.rows.length ? <WalletTxRows rows={tx.rows} /> : <Empty title="No activity yet" body="Allocations into this wallet and moves back to salary appear here." />}
        </TablePanel>
      </Panel>
    </>
  );
}

function Stat({ title, value, sub, href }: { title: string; value: string; sub: string; href?: string }) {
  const inner = (
    <>
      <p className="flex items-center justify-between text-[15px]">{title}{href && <ChevronRight size={18} />}</p>
      <p className="tabular mt-9 text-[28px] font-medium leading-tight">{value}</p>
      <p className="mt-1.5 text-[13px] text-muted">{sub}</p>
    </>
  );
  return href ? <Link href={href} className="kpi-card block rounded-2xl p-5 hover:ring-1 hover:ring-brand/30">{inner}</Link> : <div className="kpi-card rounded-2xl p-5">{inner}</div>;
}
