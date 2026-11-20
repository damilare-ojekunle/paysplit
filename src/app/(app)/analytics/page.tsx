import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { cashFlow, salaryBalance, walletsWithBalances } from "@/server/queries";
import { naira } from "@/lib/format";
import { PageHeader, Panel, Segmented } from "@/components/ui";
import { CashFlowChart, ExportButton } from "@/components/dashboard-bits";

const PERIODS: Record<string, number> = { "3m": 3, "6m": 6, "12m": 12 };

function monthRange(offset: number) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
  return { gte: new Date(Date.UTC(now.getFullYear(), now.getMonth() - offset, 1) - 3600_000), lt: new Date(Date.UTC(now.getFullYear(), now.getMonth() - offset + 1, 1) - 3600_000) };
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const user = await requireVerifiedUser();
  const p = (await searchParams).p;
  const period = p && p in PERIODS ? p : "6m";
  const months = PERIODS[period];
  const sumLedger = async (type: "WALLET_ALLOCATION" | "TRANSFER_SETTLED" | "SALARY_IN", offset: number) => {
    const r = await prisma.ledgerEntry.aggregate({ where: { amountMinor: { gt: 0 }, transaction: { userId: user.id, type, createdAt: monthRange(offset) } }, _sum: { amountMinor: true } });
    return r._sum.amountMinor ?? 0n;
  };
  const [flow, salaryNow, salaryPrev, savedNow, savedPrev, sentNow, sentPrev, wallets, salary, splits] = await Promise.all([
    cashFlow(user.id, months),
    sumLedger("SALARY_IN", 0), sumLedger("SALARY_IN", 1),
    sumLedger("WALLET_ALLOCATION", 0), sumLedger("WALLET_ALLOCATION", 1),
    sumLedger("TRANSFER_SETTLED", 0), sumLedger("TRANSFER_SETTLED", 1),
    walletsWithBalances(user.id),
    salaryBalance(user.id),
    prisma.splitExecution.count({ where: { userId: user.id, createdAt: monthRange(0) } }),
  ]);
  const walletTotal = wallets.reduce((s, w) => s + w.balanceMinor, 0n);
  const pct = (a: bigint, b: bigint) => (b > 0n ? Math.round(Number(((a - b) * 1000n) / b)) / 10 : null);
  const rate = salaryNow > 0n ? Number(((savedNow + sentNow) * 100n) / salaryNow) : 0;
  const totalFlowW = flow.reduce((s, m) => s + m.wallets, 0n), totalFlowB = flow.reduce((s, m) => s + m.beneficiaries, 0n);
  const held = salary + walletTotal;
  const savedShare = held > 0n ? Number((walletTotal * 100n) / held) : 0;

  return (
    <>
      <PageHeader title="Analytics" crumbs={[{ href: "/dashboard", label: "Dashboard" }, { label: "Analytics" }]} action={<><Segmented label="Period" active={period} items={Object.keys(PERIODS).map((k) => ({ key: k, label: k.replace("m", " months"), href: `/analytics?p=${k}` }))} /><ExportButton dark={false} /></>} />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Salary Received" value={naira(salaryNow)} growth={pct(salaryNow, salaryPrev)} label="This month vs last month" />
        <Metric title="Saved to Wallets" value={naira(savedNow)} growth={pct(savedNow, savedPrev)} label="Allocated this month" />
        <Metric title="Sent to Beneficiaries" value={naira(sentNow)} growth={pct(sentNow, sentPrev)} label="Settled transfers this month" />
        <Metric title="Allocation Rate" value={`${rate}%`} growth={null} label={`${splits} split${splits === 1 ? "" : "s"} ran this month`} />
      </div>

      <Panel className="mt-5 grid gap-4 sm:-mx-4 lg:grid-cols-[1fr_420px]">
        <div className="min-w-0 px-2 pt-3 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px]">Monthly Cash Flow</h2>
              <p className="mt-3 flex items-baseline gap-2"><span className="tabular text-[30px] font-medium leading-none">{naira(totalFlowW + totalFlowB)}</span><span className="text-xs text-muted">moved in the last {months} months</span></p>
            </div>
            <div className="flex items-center gap-5 text-sm">
              <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-brand" /> Wallets {naira(totalFlowW)}</span>
              <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-ink" /> Beneficiaries {naira(totalFlowB)}</span>
            </div>
          </div>
          <div className="mt-4"><CashFlowChart data={flow.map((m) => ({ month: m.month, label: m.label, wallets: m.wallets.toString(), beneficiaries: m.beneficiaries.toString() }))} /></div>
        </div>

        <section className="rounded-[20px] border border-line-2 bg-panel-2 p-2">
          <div className="flex items-center justify-between px-4 py-3"><h2 className="text-lg">Available Balance</h2><Link href="/destinations" className="flex items-center gap-1 text-[15px] text-brand hover:underline">Wallets <ChevronRight size={16} /></Link></div>
          <div className="rounded-2xl border border-line bg-white p-5">
            <Gauge pct={savedShare} center={naira(held)} sub="Salary + wallets" />
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="border-l-[3px] border-ink pl-3"><span className="tabular block text-lg">{naira(salary)}</span><span className="text-[13px] text-muted">In salary account</span></div>
              <div className="border-l-[3px] border-brand pl-3"><span className="tabular block text-lg">{naira(walletTotal)}</span><span className="text-[13px] text-muted">Saved in wallets</span></div>
            </div>
          </div>
        </section>
      </Panel>
    </>
  );
}

function Metric({ title, value, growth, label }: { title: string; value: string; growth: number | null; label: string }) {
  return (
    <div className="kpi-card flex min-h-[168px] flex-col rounded-2xl p-5">
      <p className="text-[15px]">{title}</p>
      <p className="tabular mt-auto text-[30px] font-medium leading-tight">{value}</p>
      <p className="mt-3 flex items-center justify-between gap-2 text-sm text-muted"><span>{label}</span>{growth !== null && <span className={growth >= 0 ? "text-success" : "text-danger"}>{growth >= 0 ? "↑" : "↓"} {Math.abs(growth)}%</span>}</p>
    </div>
  );
}

function Gauge({ pct, center, sub }: { pct: number; center: string; sub: string }) {
  const r = 84, C = Math.PI * r, len = (Math.min(100, pct) / 100) * C;
  return (
    <div className="relative mx-auto h-[130px] w-[220px]">
      <svg viewBox="0 0 220 120" className="w-full" role="img" aria-label={`${pct}% of your money is in wallets`}>
        <path d="M 26 110 A 84 84 0 0 1 194 110" fill="none" stroke="#171918" strokeWidth="14" strokeLinecap="round" />
        <path d="M 26 110 A 84 84 0 0 1 194 110" fill="none" stroke="#33a7f5" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${len} ${C}`} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center"><p className="tabular text-[22px] font-semibold">{center}</p><p className="text-[11px] text-muted">{sub} · {pct}% saved</p></div>
    </div>
  );
}
