import Link from "next/link";
import clsx from "clsx";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { salaryBalance } from "@/server/queries";
import { destinationOptions, ruleForForm, ruleQualifiers } from "@/server/rule-page-data";
import { formatBps, percentOf } from "@/core/money";
import { naira, fmtDateTimeBar } from "@/lib/format";
import { Alert, Badge, Checkbox, Empty, HeroCard, PageHeader, Panel, SearchBox, Segmented, Table, TablePanel, td, th } from "@/components/ui";
import { RunNowButton } from "@/components/client-bits";
import { RuleActions, RuleModalButton } from "@/components/rule-form";

/* Figma allocation bar: solid and hatched segments in the brand family. */
const SEGMENTS = [
  { c: "#33a7f5", hatch: false }, { c: "#3de8f0", hatch: true }, { c: "#171918", hatch: true },
  { c: "#124b6e", hatch: false }, { c: "#1a3a9c", hatch: true }, { c: "#4db2f6", hatch: true },
  { c: "#0f9523", hatch: false }, { c: "#8a38f5", hatch: true }, { c: "#fc4f24", hatch: false }, { c: "#6a6b69", hatch: true },
];
const segStyle = (i: number) => {
  const s = SEGMENTS[i % SEGMENTS.length];
  return { background: s.hatch ? `repeating-linear-gradient(135deg, ${s.c} 0 6px, color-mix(in srgb, ${s.c} 82%, white) 6px 9px)` : s.c };
};

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string; new?: string }> }) {
  const user = await requireVerifiedUser();
  const sp = await searchParams;
  const filter = sp.filter && ["active", "paused", "draft"].includes(sp.filter) ? sp.filter : "all";
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1) - 3600_000);
  const [rules, lastPayin, executions, salary, monthItems, dests] = await Promise.all([
    prisma.splitRule.findMany({ where: { userId: user.id }, include: { wallet: true, beneficiary: true }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] }),
    prisma.payin.findFirst({ where: { userId: user.id, status: "CONFIRMED" }, orderBy: { receivedAt: "desc" } }),
    prisma.splitExecution.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10, include: { items: true } }),
    salaryBalance(user.id),
    prisma.splitExecutionItem.groupBy({ by: ["ruleId"], where: { execution: { userId: user.id, createdAt: { gte: monthStart } }, status: { in: ["SUCCESS", "PENDING"] } }, _sum: { allocatedMinor: true } }),
    destinationOptions(user.id),
  ]);
  const allocatedThisMonth = new Map(monthItems.map((m) => [m.ruleId, m._sum.allocatedMinor ?? 0n]));
  const baseline = user.monthlySalaryMinor ?? lastPayin?.amountMinor ?? 0n;
  const active = rules.filter((r) => r.status === "ACTIVE");
  const seg = active.map((r, i) => ({ r, i, amt: r.method === "FIXED" ? r.amountMinor! : percentOf(baseline, r.percentBps!) }));
  const total = seg.reduce((s, x) => s + x.amt, 0n);
  const over = baseline > 0n && total > baseline;
  const remainder = baseline > total ? baseline - total : 0n;
  const pct = baseline > 0n ? Number((total * 100n) / baseline) : 0;
  const q = sp.q?.toLowerCase();
  const shown = rules
    .filter((r) => filter === "all" || r.status === filter.toUpperCase())
    .filter((r) => !q || [r.name, r.wallet?.name, r.beneficiary?.name].some((s) => s?.toLowerCase().includes(q)));
  const kycOk = user.kycStatus === "APPROVED";
  const runDisabled = !kycOk ? "Verify your identity first" : !active.length ? "Activate a rule first" : salary <= 0n ? "No unallocated salary funds" : undefined;
  const fHref = (f: string) => `/rules?${new URLSearchParams({ ...(f !== "all" ? { filter: f } : {}), ...(sp.q ? { q: sp.q } : {}) })}`;

  return (
    <>
      <PageHeader title="Split Rules" crumbs={[{ href: "/dashboard", label: "Dashboard" }, { label: "Split Rules" }]} action={<>{kycOk && active.length > 0 && <RunNowButton size="xl" variant="outline" disabledReason={runDisabled} />}<RuleModalButton trigger="add" destinations={dests} kycOk={kycOk} autoOpen={!!sp.new} preset={sp.new ? { type: sp.new.split(":")[0], dest: sp.new.split(":")[1] } : undefined} /></>} />
      {!kycOk && <Alert tone="warn" className="mb-5">Rules stay as drafts until your identity is verified. <Link href="/onboarding" className="underline">Verify now</Link></Alert>}

      <Panel className="space-y-4 sm:-mx-4">
        <HeroCard>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[13px] text-muted">Monthly Salary Baseline</p>
              <p className="tabular mt-1 text-[28px] leading-tight">{baseline ? naira(baseline) : "Not set"}</p>
              {!user.monthlySalaryMinor && <p className="mt-1 text-xs text-muted">{lastPayin ? "From your last salary. " : ""}<Link href="/settings" className="text-brand underline">Set your monthly salary</Link></p>}
            </div>
            <div className="flex gap-7 text-right">
              <div><p className="text-[13px] text-muted">Total Allocated</p><p className="tabular mt-1 text-lg">{naira(total)}</p></div>
              <div><p className="text-[13px] text-muted">Spend Account Remainder</p><p className={clsx("tabular mt-1 text-lg", over ? "text-danger" : "text-success")}>{naira(remainder)}</p></div>
            </div>
          </div>
          {baseline > 0n ? (
            <>
              <p className="mt-9 flex justify-between text-sm"><span>Allocation Progress: <b className="font-medium">{pct}% of Salary</b></span><span className="text-muted">{naira(remainder)} unallocated</span></p>
              <div className="mt-3 flex h-[26px] overflow-hidden rounded-md bg-panel" role="img" aria-label={`Allocation: ${seg.map(({ r, amt }) => `${r.name} ${naira(amt)}`).join(", ")}`}>
                {seg.map(({ r, amt, i }) => <div key={r.id} style={{ width: `${Math.min(100, Number((amt * 10000n) / baseline) / 100)}%`, ...segStyle(i) }} title={`${r.name}: ${naira(amt)}`} />)}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                {seg.map(({ r, i }) => <li key={r.id} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: SEGMENTS[i % SEGMENTS.length].c }} />{r.wallet?.name ?? r.beneficiary?.name}</li>)}
                <li className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-line" />Spend Balance</li>
              </ul>
              {over && <Alert tone="warn" className="mt-4">Your active rules add up to more than your salary baseline. Lower-priority rules are skipped when funds run out.</Alert>}
            </>
          ) : <p className="mt-6 text-sm text-muted">Set your monthly salary in settings, or wait for your first salary, to see the allocation preview.</p>}
        </HeroCard>

        <TablePanel
          title="All Salary Rules"
          tools={<><SearchBox defaultValue={sp.q} hidden={{ filter: filter !== "all" ? filter : undefined }} /><Segmented label="Rule status" active={filter} items={[{ key: "all", label: "All", href: fHref("all") }, { key: "active", label: "Active", href: fHref("active") }, { key: "paused", label: "Paused", href: fHref("paused") }, ...(rules.some((r) => r.status === "DRAFT") ? [{ key: "draft", label: "Draft", href: fHref("draft") }] : [])]} /></>}
          footer={<span>Showing {shown.length} of {rules.length} rules</span>}
        >
          {shown.length ? (
            <Table head={<><th className={th + " w-10"}><Checkbox aria-label="Select all rules" /></th><th className={th}>Rule Name</th><th className={th}>Destination</th><th className={th}>Method</th><th className={th}>Date Created</th><th className={th}>Allocated This Month</th><th className={th + " w-32"}>Action</th></>}>
              {shown.map((r) => (
                <tr key={r.id} className="hover:bg-panel-2">
                  <td className={td}><Checkbox aria-label={`Select ${r.name}`} /></td>
                  <td className={td}><span className="flex items-center gap-2">{r.name}{r.status !== "ACTIVE" && <Badge status={r.status} />}</span></td>
                  <td className={td}>{r.wallet ? `${r.wallet.name} (wallet)` : `${r.beneficiary!.name} (${r.beneficiary!.bankName})`}</td>
                  <td className={td + " tabular"}>{r.method === "FIXED" ? naira(r.amountMinor!) : formatBps(r.percentBps!)}{ruleQualifiers(r) && <span className="block text-xs text-muted">{ruleQualifiers(r)}</span>}</td>
                  <td className={td + " whitespace-nowrap"}>{fmtDateTimeBar(r.createdAt)}</td>
                  <td className={td + " tabular font-semibold"}>{naira(allocatedThisMonth.get(r.id) ?? 0n)}</td>
                  <td className={td}><RuleActions id={r.id} status={r.status} kycOk={kycOk} edit={<RuleModalButton trigger="edit" destinations={dests} kycOk={kycOk} existing={ruleForForm(r)} />} /></td>
                </tr>
              ))}
            </Table>
          ) : rules.length
            ? <Empty title="No matching rules" body="Try a different search or filter." />
            : <Empty title="No split rules created" body="Rules tell PaySplit where your salary goes: a fixed amount or a percentage to each wallet or beneficiary." action={<RuleModalButton trigger="add-empty" destinations={dests} kycOk={kycOk} />} />}
        </TablePanel>

        <TablePanel title="Split History" footer={<span>Each salary (or Run split now) creates one split. Click a date for the full breakdown.</span>}>
          {executions.length ? (
            <Table head={<><th className={th}>Date</th><th className={th}>Trigger</th><th className={th}>Salary Used</th><th className={th}>To Wallets</th><th className={th}>To Beneficiaries</th><th className={th}>Remaining</th><th className={th}>Status</th></>}>
              {executions.map((e) => {
                const sum = (t: string) => e.items.filter((i) => i.destinationType === t && ["SUCCESS", "PENDING"].includes(i.status)).reduce((s, i) => s + i.allocatedMinor, 0n);
                return (
                  <tr key={e.id} className="hover:bg-panel-2">
                    <td className={td + " whitespace-nowrap"}><Link href={`/rules/history/${e.id}`} className="text-brand hover:underline">{fmtDateTimeBar(e.createdAt)}</Link></td>
                    <td className={td}>{e.trigger === "AUTO" ? "Automatic" : "Run now"}</td>
                    <td className={td + " tabular"}>{naira(e.availableMinor)}</td>
                    <td className={td + " tabular text-brand"}>{naira(sum("WALLET"))}</td>
                    <td className={td + " tabular"}>{naira(sum("BENEFICIARY"))}</td>
                    <td className={td + " tabular"}>{naira(e.remainingMinor)}</td>
                    <td className={td}><Badge status={e.status} /></td>
                  </tr>
                );
              })}
            </Table>
          ) : <Empty title="No splits yet" body="Each time salary arrives (or you use Run split now), the result appears here." />}
        </TablePanel>
      </Panel>
    </>
  );
}
