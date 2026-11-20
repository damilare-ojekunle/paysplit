import Link from "next/link";
import { Plus } from "lucide-react";
import clsx from "clsx";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { salaryBalance } from "@/server/queries";
import { formatBps, percentOf } from "@/core/money";
import { naira, fmtDateTime, fmtDate } from "@/lib/format";
import { Alert, Badge, Card, Empty, LinkButton, PageHeader } from "@/components/ui";
import { RunNowButton } from "@/components/client-bits";
import { RuleActions } from "@/components/rule-form";

const COLORS = ["#1e9bf0", "#2ee6e6", "#0b1424", "#0f4c75", "#1d3fa8", "#5bb8f5", "#7c3aed", "#f59e0b", "#10b981", "#ef4444"];

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireVerifiedUser();
  const filter = (await searchParams).filter?.toUpperCase();
  const [rules, lastPayin, executions, salary] = await Promise.all([
    prisma.splitRule.findMany({ where: { userId: user.id }, include: { wallet: true, beneficiary: true, items: { orderBy: { execution: { createdAt: "desc" } }, take: 1 } }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] }),
    prisma.payin.findFirst({ where: { userId: user.id, status: "CONFIRMED" }, orderBy: { receivedAt: "desc" } }),
    prisma.splitExecution.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10, include: { items: true } }),
    salaryBalance(user.id),
  ]);
  const baseline = lastPayin?.amountMinor ?? 0n;
  const active = rules.filter((r) => r.status === "ACTIVE");
  const seg = active.map((r, i) => ({ r, amt: r.method === "FIXED" ? r.amountMinor! : percentOf(baseline, r.percentBps!), color: COLORS[i % COLORS.length] }));
  const total = seg.reduce((s, x) => s + x.amt, 0n);
  const over = baseline > 0n && total > baseline;
  const shown = filter ? rules.filter((r) => r.status === filter) : rules;
  const kycOk = user.kycStatus === "APPROVED";
  const runDisabled = !kycOk ? "Verify your identity first" : !active.length ? "Activate a rule first" : salary <= 0n ? "No unallocated salary funds" : undefined;

  return (
    <>
      <PageHeader title="Split Rules" crumbs={[{ href: "/dashboard", label: "Dashboard" }, { label: "Split Rules" }]} action={<div className="flex gap-2"><RunNowButton disabledReason={runDisabled} /><LinkButton href="/rules/new"><Plus size={16} /> Add new rule</LinkButton></div>} />
      {!kycOk && <Alert tone="warn" className="mb-6">Rules stay as drafts until your identity is verified. <Link href="/onboarding" className="underline">Verify now</Link></Alert>}
      <Card className="p-2">
        <div className="rounded-[16px] bg-gradient-to-b from-brand-50 to-white p-6">
          <div className="flex flex-wrap justify-between gap-4">
            <div><p className="text-xs text-muted">Monthly salary baseline {lastPayin ? `(last salary, ${fmtDate(lastPayin.receivedAt)})` : ""}</p><p className="tabular text-3xl font-medium">{baseline ? naira(baseline) : "—"}</p></div>
            <div className="flex gap-8 text-right">
              <div><p className="text-xs text-muted">Total allocated</p><p className="tabular text-lg font-semibold">{naira(total)}</p></div>
              <div><p className="text-xs text-muted">Stays in salary account</p><p className={clsx("tabular text-lg font-semibold", over ? "text-danger" : "text-success")}>{baseline ? naira(baseline > total ? baseline - total : 0n) : "—"}</p></div>
            </div>
          </div>
          {baseline > 0n ? (
            <>
              <p className="mt-6 text-sm">Allocation progress: <b>{Number((total * 100n) / baseline)}% of salary</b></p>
              <div className="mt-2 flex h-6 overflow-hidden rounded-full bg-line/60" role="img" aria-label="Allocation by rule">
                {seg.map(({ r, amt, color }) => <div key={r.id} style={{ width: `${Math.min(100, Number((amt * 10000n) / baseline) / 100)}%`, background: color }} title={`${r.name}: ${naira(amt)}`} />)}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">{seg.map(({ r, color }) => <li key={r.id} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: color }} />{r.wallet?.name ?? r.beneficiary?.name}</li>)}</ul>
              {over && <Alert tone="warn" className="mt-4">Your active rules add up to more than your last salary. Lower-priority rules will be skipped when funds run out.</Alert>}
            </>
          ) : <p className="mt-4 text-sm text-muted">Your allocation preview appears after your first salary arrives.</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-6">
          <h2 className="text-lg font-medium">All salary rules</h2>
          <div role="tablist" className="inline-flex rounded-xl border border-line bg-white p-1 text-sm">
            {["ALL", "ACTIVE", "PAUSED", "DRAFT"].map((f) => <Link key={f} role="tab" aria-selected={(filter ?? "ALL") === f} href={f === "ALL" ? "/rules" : `/rules?filter=${f.toLowerCase()}`} className={clsx("rounded-lg px-3 py-1.5 capitalize", (filter ?? "ALL") === f ? "bg-brand-50 font-medium text-brand-600" : "text-muted")}>{f.toLowerCase()}</Link>)}
          </div>
        </div>
        {shown.length ? (
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-canvas text-left text-xs text-muted"><tr><th className="px-4 py-3 font-medium">#</th><th className="px-4 py-3 font-medium">Rule name</th><th className="px-4 py-3 font-medium">Destination</th><th className="px-4 py-3 font-medium">Method</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Last run</th><th className="px-4 py-3 text-right font-medium">Action</th></tr></thead>
              <tbody>
                {shown.map((r) => {
                  const last = r.items[0];
                  return (
                    <tr key={r.id} className="border-t border-line">
                      <td className="px-4 py-3">{r.priority}</td>
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3">{r.wallet ? `${r.wallet.name} (wallet)` : `${r.beneficiary!.name} (${r.beneficiary!.bankName})`}</td>
                      <td className="tabular px-4 py-3">{r.method === "FIXED" ? naira(r.amountMinor!) : formatBps(r.percentBps!)}</td>
                      <td className="px-4 py-3"><Badge status={r.status} />{r.status === "ACTIVE" && !kycOk && <span className="ml-1 text-xs text-warn">blocked: KYC</span>}</td>
                      <td className="px-4 py-3 text-xs">{last ? <><Badge status={last.status} /> <span className="text-muted">{naira(last.allocatedMinor)}</span></> : <span className="text-muted">Never</span>}</td>
                      <td className="px-4 py-3"><RuleActions id={r.id} status={r.status} kycOk={kycOk} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No split rules created" body="Rules tell PaySplit where your salary goes — a fixed amount or a percentage to each wallet or beneficiary." action={<LinkButton href="/rules/new">Create your first rule</LinkButton>} />}
      </Card>

      <Card className="mt-6">
        <h2 className="p-6 pb-4 text-lg font-medium">Split history</h2>
        {executions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-y border-line bg-canvas text-left text-xs text-muted"><tr><th className="px-6 py-3 font-medium">Date</th><th className="px-3 py-3 font-medium">Trigger</th><th className="px-3 py-3 text-right font-medium">Salary used</th><th className="px-3 py-3 text-right font-medium">To wallets</th><th className="px-3 py-3 text-right font-medium">To beneficiaries</th><th className="px-3 py-3 text-right font-medium">Remaining</th><th className="px-6 py-3 font-medium">Status</th></tr></thead>
              <tbody>
                {executions.map((e) => {
                  const sum = (t: string) => e.items.filter((i) => i.destinationType === t && ["SUCCESS", "PENDING"].includes(i.status)).reduce((s, i) => s + i.allocatedMinor, 0n);
                  return (
                    <tr key={e.id} className="border-b border-line last:border-0 hover:bg-canvas">
                      <td className="px-6 py-3"><Link href={`/rules/history/${e.id}`} className="text-brand hover:underline">{fmtDateTime(e.createdAt)}</Link></td>
                      <td className="px-3 py-3">{e.trigger === "AUTO" ? "Automatic" : "Run now"}</td>
                      <td className="tabular px-3 py-3 text-right">{naira(e.availableMinor)}</td>
                      <td className="tabular px-3 py-3 text-right">{naira(sum("WALLET"))}</td>
                      <td className="tabular px-3 py-3 text-right">{naira(sum("BENEFICIARY"))}</td>
                      <td className="tabular px-3 py-3 text-right">{naira(e.remainingMinor)}</td>
                      <td className="px-6 py-3"><Badge status={e.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No splits yet" body="Each time salary arrives (or you use Run now), the result appears here." />}
      </Card>
    </>
  );
}
