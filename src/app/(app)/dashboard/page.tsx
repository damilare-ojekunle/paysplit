import Link from "next/link";
import type { LedgerTxnType } from "@prisma/client";
import { ArrowUp, CheckCircle2, ChevronDown, ChevronRight, Circle, Plus, ShieldCheck } from "lucide-react";
import { requireVerifiedUser } from "@/server/auth";
import { cashFlow, dashboard, listTransactions, salaryForMonth } from "@/server/queries";
import { naira, fmtDate, maskAcct, flowKind } from "@/lib/format";
import { Alert, amountClass, Badge, CategoryPill, Checkbox, Empty, FlowIcon, LinkButton, Panel, SearchBox, Segmented, Table, TablePanel, td, th } from "@/components/ui";
import { RetryProvision, RunNowButton } from "@/components/client-bits";
import { AccountDetails, Balance, CashFlowChart, ExportButton, NotificationCarousel } from "@/components/dashboard-bits";
import { GettingStarted, SetupWizard } from "@/components/setup-wizard";
import { WalletIcon, walletTone } from "@/components/wallet-icon";
const ACT: Record<string, LedgerTxnType | undefined> = { all: undefined, wallets: "WALLET_ALLOCATION", beneficiaries: "TRANSFER_OUT" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ act?: string; q?: string }> }) {
  const user = await requireVerifiedUser();
  const sp = await searchParams;
  const act = sp.act && sp.act in ACT ? sp.act : "all";
  const [d, flow, thisMonth, lastMonth, activity] = await Promise.all([
    dashboard(user.id),
    cashFlow(user.id, 9),
    salaryForMonth(user.id, 0),
    salaryForMonth(user.id, 1),
    listTransactions(user.id, { type: ACT[act], q: sp.q || undefined, pageSize: 5 }),
  ]);
  const kycOk = d.user.kycStatus === "APPROVED";
  const activeRules = d.rules.filter((r) => r.status === "ACTIVE");
  const tz = d.user.timezone || "Africa/Lagos";
  const hour = Number(new Date().toLocaleString("en-NG", { timeZone: tz, hour: "numeric", hour12: false }));
  const greet = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const now = new Date();
  const weekday = now.toLocaleDateString("en-NG", { timeZone: tz, weekday: "long" });
  const day = Number(now.toLocaleDateString("en-NG", { timeZone: tz, day: "numeric" }));
  const ord = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  const dateLine = `${now.toLocaleDateString("en-NG", { timeZone: tz, month: "long" })} ${day}${ord}, ${now.toLocaleDateString("en-NG", { timeZone: tz, year: "numeric" })}`;

  const lastAlloc = d.lastExec?.allocatedMinor ?? 0n;
  const base = d.lastExec?.baseMinor ?? 0n;
  const pct = base > 0n ? Number((lastAlloc * 100n) / base) : 0;
  const walletAlloc = d.lastExec?.items.filter((i) => i.destinationType === "WALLET" && i.status === "SUCCESS").reduce((s, i) => s + i.allocatedMinor, 0n) ?? 0n;
  const benAlloc = d.lastExec?.items.filter((i) => i.destinationType === "BENEFICIARY" && ["SUCCESS", "PENDING"].includes(i.status)).reduce((s, i) => s + i.allocatedMinor, 0n) ?? 0n;
  const remaining = d.lastExec?.remainingMinor ?? 0n;
  const avail = d.lastExec?.availableMinor ?? 0n;
  const leftPct = avail > 0n ? Number((remaining * 100n) / avail) : 0;
  const growth = lastMonth > 0n ? Math.round(Number(((thisMonth - lastMonth) * 1000n) / lastMonth)) / 10 : null;
  const fundsAvailable = d.salary > 0n;
  const runDisabled = !kycOk ? "Verify your identity first" : !activeRules.length ? "Activate a rule first" : d.salary <= 0n ? "No unallocated salary funds" : undefined;
  const setupSteps = { income: !!d.user.salaryDay, wallets: d.wallets.length > 0, recipients: (await countBeneficiaries(user.id)) > 0, rules: d.rules.length > 0 };
  const setupDone = Object.values(setupSteps).every(Boolean);
  const actHref = (k: string) => `/dashboard?${new URLSearchParams({ ...(k !== "all" ? { act: k } : {}), ...(sp.q ? { q: sp.q } : {}) })}#activity`;

  return (
    <>
      {/* ------------------------------------------------ hero (full bleed) */}
      <section className="hero-dark relative left-1/2 -ml-[50vw] w-screen overflow-hidden text-white">
        <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(40%_60%_at_80%_20%,rgba(255,255,255,0.06),transparent_70%)]" aria-hidden />
        <div className="relative mx-auto flex min-h-[300px] max-w-[1440px] flex-wrap items-end justify-between gap-6 px-4 pb-[30px] pt-10 sm:min-h-[340px] sm:px-9 lg:pt-[98px]">
          <div className="min-w-0 lg:w-[480px]">
            <h1 className="text-[32px] leading-tight sm:text-[38px]">{greet}, {d.user.firstName}!</h1>
            <p className="mt-2 text-[17px] text-white/80"><span className="font-semibold text-white">{weekday},</span> {dateLine}</p>
          </div>
          <div className="absolute left-[38.7%] top-[98px] hidden lg:block">
            <NotificationCarousel items={d.notifications.slice(0, 3).map((n) => ({ id: n.id, title: n.title, body: n.body }))} />
          </div>
          <div className="flex flex-wrap gap-3">
            <ExportButton />
            <LinkButton href="/destinations/wallets/new" size="xl" className="px-6"><Plus size={18} /> Create Wallet</LinkButton>
          </div>
        </div>
      </section>

      {!kycOk && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand/20 bg-brand-50 px-5 py-4" role="status">
          <div className="flex items-center gap-3"><ShieldCheck size={22} className="shrink-0 text-brand" aria-hidden /><div><p className="font-medium">Complete Onboarding</p><p className="text-sm text-muted">Verify your account to upgrade to a Tier 2. Unlock splitting and get a dedicated account number.</p></div></div>
          <LinkButton href="/onboarding" size="sm" className="h-10 px-4">Complete Onboarding</LinkButton>
        </div>
      )}

      {/* ------------------------------------------------ balance + KPIs */}
      <div className="mt-[22px] grid gap-5 lg:grid-cols-[1fr_293px_293px_293px]">
        <div className="flex flex-col justify-center py-2">
          <p className="text-[15px] text-ink">Salary Account Balance</p>
          <div className="mt-3"><Balance minor={d.salary.toString()} /></div>
          {d.account?.status === "ACTIVE" ? (
            <div className="mt-3 flex flex-wrap gap-x-3 text-[13px] text-muted">
              <span>{maskAcct(d.account.accountNumber!).replace("••••", "*****")} {d.user.firstName} {d.user.lastName}</span>
              <AccountDetails account={{ accountNumber: d.account.accountNumber!, bankName: d.account.bankName ?? "", accountName: d.account.accountName ?? "" }} />
            </div>
          ) : d.account ? (
            <div className="mt-3 space-y-2 text-[13px] text-warn"><p>Salary account setup {d.account.status === "PENDING" ? "is pending" : "failed"}.</p><RetryProvision /></div>
          ) : <p className="mt-3 text-[13px] text-muted">Your salary account is created after identity verification. <Link href="/onboarding" className="text-brand underline">Verify now</Link></p>}
        </div>
        <Kpi href="/rules" title="Split Allocation" value={naira(lastAlloc)} left={`${activeRules.length} Split${activeRules.length === 1 ? "" : "s"} running`} right={d.lastExec ? <span className="flex items-center gap-1 text-success"><ArrowUp size={15} /> {pct}% of Salary</span> : <span className="text-muted">No splits yet</span>} />
        <Kpi href="/destinations" title="Total in Wallets" value={naira(d.walletTotal)} left="Active wallets" right={<span className="text-ink">{d.wallets.filter((w) => w.targetMinor).length} Target wallets</span>} />
        <Kpi href="/settings" title="Expected Next Split Run" value={d.nextSalary ? d.nextSalary.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Not set"} left="Fund Status:" right={<Badge status={fundsAvailable ? "SUCCESS" : "UNAVAILABLE"} label={fundsAvailable ? "Available" : "Unavailable"} />} />
      </div>

      {/* ------------------------------------------------ main panel */}
      <Panel className="mt-3 sm:-mx-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <div className="min-w-0 space-y-4">
            <div className="px-2 pt-3 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-[15px]">Salary Allocation &amp; Split Cash Flow <Link href="/analytics" className="ml-2 text-xs text-brand hover:underline">View analytics</Link></h2>
                  <p className="mt-3 flex flex-wrap items-baseline gap-2">
                    <span className="tabular text-[30px] font-medium leading-none">{naira(thisMonth)}</span>
                    {growth !== null && <span className={`text-xs ${growth >= 0 ? "text-success" : "text-danger"}`}>{growth >= 0 ? "+" : ""}{growth}%</span>}
                    <span className="text-xs text-muted">{growth !== null ? "from last month" : "salary this month"}</span>
                  </p>
                </div>
                <div className="flex items-center gap-5 text-sm">
                  <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-brand" /> Wallets</span>
                  <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-ink" /> Beneficiaries</span>
                  <span className="flex h-10 items-center gap-3 rounded-xl border border-line bg-panel-2 px-4 text-sm">{flow[0].label} – {flow[flow.length - 1].label} <ChevronDown size={16} /></span>
                </div>
              </div>
              <div className="mt-4"><CashFlowChart data={flow.map((m) => ({ month: m.month, label: m.label, wallets: m.wallets.toString(), beneficiaries: m.beneficiaries.toString() }))} /></div>
            </div>

            <div id="activity">
              <TablePanel
                title="Recent Activity & Splits"
                tools={<><SearchBox defaultValue={sp.q} hidden={{ act: act !== "all" ? act : undefined }} /><Segmented label="Activity filter" active={act} items={[{ key: "all", label: "All Transactions", href: actHref("all") }, { key: "wallets", label: "Wallets", href: actHref("wallets") }, { key: "beneficiaries", label: "Beneficiaries", href: actHref("beneficiaries") }]} /></>}
                footer={<><span>Showing {activity.rows.length} of {activity.total} activity entries</span><span className="flex items-center gap-4">{kycOk && <RunNowButton disabledReason={runDisabled} />}<Link href="/transactions" className="flex items-center gap-1 text-brand hover:underline">View Full Ledger <ChevronRight size={16} /></Link></span></>}
              >
                {activity.rows.length ? (
                  <Table head={<><th className={th + " w-10"}><Checkbox aria-label="Select all" /></th><th className={th}>Destination / Rule</th><th className={th}>Category</th><th className={th}>Date</th><th className={th}>Status</th><th className={th}>Amount</th><th className={th + " w-10"}><span className="sr-only">Open</span></th></>}>
                    {activity.rows.map((t) => {
                      const k = flowKind(t);
                      return (
                        <tr key={t.id} className="hover:bg-panel-2">
                          <td className={td}><Checkbox aria-label={`Select ${t.description}`} /></td>
                          <td className={td}><span className="flex items-center gap-3"><FlowIcon kind={k} /><span className="truncate">{t.direction === "out" || t.type === "TRANSFER_REVERSAL" ? t.description : t.type === "SALARY_IN" ? t.description : `${t.destination} Wallet`}</span></span></td>
                          <td className={td}><CategoryPill>{t.category}</CategoryPill></td>
                          <td className={td + " whitespace-nowrap"}>{fmtDate(t.createdAt)}</td>
                          <td className={td}><Badge status={t.status} /></td>
                          <td className={`${td} tabular whitespace-nowrap ${amountClass(k)}`}>{k === "in" ? "+" : "-"}{naira(t.amountMinor)}</td>
                          <td className={td}><Link href={`/transactions/${t.id}`} aria-label={`Open ${t.description}`} className="grid size-8 place-items-center rounded-full hover:bg-panel"><ChevronRight size={18} /></Link></td>
                        </tr>
                      );
                    })}
                  </Table>
                ) : <Empty title={sp.q || act !== "all" ? "No matching activity" : "No activity yet"} body={sp.q || act !== "all" ? "Try a different search or filter." : "Activities will be displayed here."} />}
              </TablePanel>
            </div>
          </div>

          <div className="space-y-4">
            {!kycOk || !setupDone ? <OnboardingProgress kyc={kycOk} kycStarted={d.user.kycStatus !== "NOT_STARTED"} setup={setupDone} /> : (
            <section className="rounded-[20px] border border-line-2 bg-panel-2 p-2">
              <div className="flex items-center justify-between px-4 py-3"><h2 className="text-lg">Salary Partition</h2><Link href="/rules" className="flex items-center gap-1 text-lg text-brand hover:underline">See rules <ChevronRight size={18} /></Link></div>
              <div className="rounded-2xl border border-line bg-white p-5">
                {d.lastExec ? (
                  <>
                    <Donut parts={[{ v: walletAlloc, c: "#33a7f5" }, { v: benAlloc, c: "#171918" }, { v: remaining, c: "#e4e4e4" }]} center={naira(remaining)} sub={`${leftPct}% Left`} />
                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <Link href="/destinations" className="flex items-center justify-between border-l-[3px] border-brand pl-3 hover:opacity-80"><span><span className="tabular block text-lg">{naira(walletAlloc)}</span><span className="text-[13px] text-muted">Wallets</span></span><ChevronRight size={18} /></Link>
                      <Link href="/destinations?tab=beneficiaries" className="flex items-center justify-between border-l-[3px] border-ink pl-3 hover:opacity-80"><span><span className="tabular block text-lg">{naira(benAlloc)}</span><span className="text-[13px] text-muted">Beneficiaries</span></span><ChevronRight size={18} /></Link>
                    </div>
                    <Link href={`/rules/history/${d.lastExec.id}`} className="mt-4 flex items-center gap-2 text-[13px] text-brand hover:underline">Last split · {fmtDate(d.lastExec.createdAt)} <Badge status={d.lastExec.status} /></Link>
                  </>
                ) : <Empty title="No splits yet" body="Your first split runs when salary arrives in your salary account." />}
              </div>
            </section>

            )}

            <section className="rounded-[20px] border border-line-2 bg-panel-2 p-2">
              <Link href="/destinations" className="flex items-center justify-between px-4 py-3 hover:text-brand"><h2 className="text-lg">Wallets</h2><ChevronRight size={20} /></Link>
              {d.wallets.length ? (
                <ul className="space-y-1">
                  {d.wallets.slice(0, 4).map((w, i) => (
                    <li key={w.id}>
                      <Link href={`/destinations/wallets/${w.id}`} className={`flex items-center gap-3 rounded-2xl bg-gradient-to-b ${walletTone(i).soft} px-3.5 py-3.5 hover:brightness-[0.98]`}>
                        <WalletIcon category={w.category} index={i} />
                        <span className="min-w-0 flex-1"><span className="block truncate text-[15px]">{w.name}</span><span className="text-[13px] text-muted">{w.category}</span></span>
                        <span className="tabular text-lg">{naira(w.balanceMinor)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <div className="rounded-2xl border border-line bg-white"><Empty title="No wallet yet" body="You have no wallet to display yet." action={<Link href="/destinations/wallets/new" className="text-sm font-medium text-brand hover:underline">Create a wallet</Link>} /></div>}
            </section>
          </div>
        </div>
      </Panel>

      {!kycOk && d.user.kycStatus === "NOT_STARTED" ? <GettingStarted /> : !setupDone && <SetupWizard steps={setupSteps} salaryDay={d.user.salaryDay} />}
    </>
  );
}

async function countBeneficiaries(userId: string) {
  const { prisma } = await import("@/server/db");
  return prisma.beneficiary.count({ where: { userId, archivedAt: null } });
}

function Kpi({ href, title, value, left, right }: { href: string; title: string; value: string; left: string; right: React.ReactNode }) {
  return (
    <Link href={href} className="kpi-card flex min-h-[160px] flex-col rounded-2xl p-5 hover:ring-1 hover:ring-brand/30">
      <p className="flex items-center justify-between text-[15px]">{title}<ChevronRight size={18} /></p>
      <p className="tabular mt-auto text-[30px] font-medium leading-tight">{value}</p>
      <p className="mt-3 flex items-center justify-between gap-2 text-sm text-muted"><span>{left}</span>{right}</p>
    </Link>
  );
}

function Donut({ parts, center, sub }: { parts: { v: bigint; c: string }[]; center: string; sub: string }) {
  const total = parts.reduce((s, p) => s + p.v, 0n) || 1n;
  const r = 84, C = 2 * Math.PI * r, gap = 6;
  let off = 0;
  return (
    <div className="relative mx-auto mt-2 size-[200px]">
      <svg viewBox="0 0 200 200" className="-rotate-90" role="img" aria-label={`Salary remaining ${center}, ${sub}`}>
        <circle cx="100" cy="100" r="66" fill="none" stroke="#d6d6d6" strokeDasharray="3 3" />
        {parts.filter((p) => p.v > 0n).map((p, i) => { const len = Math.max(0, (Number(p.v) / Number(total)) * C - gap); const el = <circle key={i} cx="100" cy="100" r={r} fill="none" stroke={p.c} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} />; off += len + gap; return el; })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><span className="text-[11px] text-ink">Salary Remaining</span><span className="tabular mt-1 text-[22px] font-semibold">{center}</span><span className="mt-1.5 text-[11px] text-success">{sub}</span></div>
    </div>
  );
}

function OnboardingProgress({ kyc, kycStarted, setup }: { kyc: boolean; kycStarted: boolean; setup: boolean }) {
  const items = [
    { t: "Signup Account", d: "Create your Paysplit account", done: true, href: "/settings" },
    { t: "Complete KYC", d: "Verify using a government-issued ID", done: kyc, href: "/onboarding", state: kycStarted ? "In progress" : "To do" },
    { t: "Setup Checklist", d: "Add salary source and set your first rule.", done: setup, href: "/rules", state: "To do" },
  ];
  const pct = Math.round((items.filter((i) => i.done).length / items.length) * 100);
  const r = 50, C = 2 * Math.PI * r;
  return (
    <section className="rounded-[20px] border border-line-2 bg-panel-2 p-2">
      <div className="flex items-center justify-between px-4 py-3"><h2 className="text-lg">Account Setup</h2><Link href="/onboarding" className="flex items-center gap-1 text-[15px] text-brand hover:underline">Continue <ChevronRight size={16} /></Link></div>
      <div className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-center gap-5">
          <div className="relative size-[118px] shrink-0">
            <svg viewBox="0 0 118 118" className="-rotate-90" role="img" aria-label={`Setup ${pct}% complete`}><circle cx="59" cy="59" r={r} fill="none" stroke="#efefef" strokeWidth="14" /><circle cx="59" cy="59" r={r} fill="none" stroke="#33a7f5" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(pct / 100) * C} ${C}`} /></svg>
            <span className="absolute inset-0 grid place-items-center text-[17px] font-semibold">{pct}%</span>
          </div>
          <div><p className="tabular text-[30px] font-medium leading-tight">{items.filter((i) => i.done).length}/3</p><p className="text-sm text-muted">steps complete</p></div>
        </div>
        <ol className="mt-5 space-y-4">
          {items.map((it) => (
            <li key={it.t}><Link href={it.href} className="flex items-start gap-3 hover:opacity-80">
              {it.done ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-success" aria-hidden /> : <Circle size={20} className="mt-0.5 shrink-0 text-subtle" aria-hidden />}
              <span className="min-w-0 flex-1"><span className="block text-[15px]">{it.t}</span><span className="text-sm text-muted">{it.d}</span></span>
              <span className={`text-sm ${it.done ? "text-success" : "text-muted"}`}>{it.done ? "Done" : it.state}</span>
            </Link></li>
          ))}
        </ol>
      </div>
    </section>
  );
}
