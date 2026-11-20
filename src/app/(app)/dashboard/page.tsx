import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Download, Plus, Wallet as WalletIcon } from "lucide-react";
import { requireVerifiedUser } from "@/server/auth";
import { dashboard } from "@/server/queries";
import { naira, fmtDate, fmtDateTime } from "@/lib/format";
import { Alert, Badge, Card, Empty, LinkButton } from "@/components/ui";
import { CopyButton, RetryProvision, RunNowButton } from "@/components/client-bits";

export default async function DashboardPage() {
  const user = await requireVerifiedUser();
  const d = await dashboard(user.id);
  const kycOk = d.user.kycStatus === "APPROVED";
  const activeRules = d.rules.filter((r) => r.status === "ACTIVE");
  const hour = Number(new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", hour12: false }));
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const lastAlloc = d.lastExec?.allocatedMinor ?? 0n;
  const walletAlloc = d.lastExec?.items.filter((i) => i.destinationType === "WALLET" && i.status === "SUCCESS").reduce((s, i) => s + i.allocatedMinor, 0n) ?? 0n;
  const benAlloc = d.lastExec?.items.filter((i) => i.destinationType === "BENEFICIARY" && ["SUCCESS", "PENDING"].includes(i.status)).reduce((s, i) => s + i.allocatedMinor, 0n) ?? 0n;
  const base = d.lastExec?.availableMinor ?? 0n;
  const pct = base > 0n ? Number((lastAlloc * 100n) / base) : 0;

  const steps = [
    { done: !!d.user.emailVerifiedAt, label: "Verify your email", href: "/settings" },
    { done: !!d.user.country && !!d.user.phone, label: "Set up your profile", href: "/onboarding" },
    { done: kycOk, label: "Verify your identity (BVN/NIN + selfie)", href: "/onboarding" },
    { done: d.account?.status === "ACTIVE", label: "Get your salary account", href: "/onboarding" },
    { done: !!d.user.salaryDay, label: "Set your expected salary date", href: "/settings" },
    { done: d.wallets.length > 0, label: "Create a wallet", href: "/destinations/wallets/new" },
    { done: d.rules.length > 0, label: "Create a split rule", href: "/rules/new" },
  ];
  const setupDone = steps.every((s) => s.done);
  const runDisabled = !kycOk ? "Verify your identity first" : !activeRules.length ? "Activate a rule first" : d.salary <= 0n ? "No unallocated salary funds" : undefined;

  return (
    <div className="space-y-6 pt-6">
      <section className="relative overflow-hidden rounded-[var(--radius-card)] bg-navy px-6 py-8 text-white sm:px-9 sm:py-10">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-brand/25 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-medium sm:text-4xl">{greet}, {d.user.firstName}!</h1>
            <p className="mt-2 text-white/70">{new Date().toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            {d.notifications[0] && <p className="mt-4 max-w-xl rounded-2xl bg-white/10 px-4 py-3 text-sm"><span className="font-medium">{d.notifications[0].title}:</span> {d.notifications[0].body}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/api/statements?format=pdf" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/30 px-4 text-sm hover:bg-white/10"><Download size={16} /> Export statement</a>
            <LinkButton href="/destinations/wallets/new"><Plus size={16} /> Create wallet</LinkButton>
          </div>
        </div>
      </section>

      {!kycOk && (
        <Alert tone="warn">
          <b>Money movement is locked.</b> You can set up wallets, beneficiaries and draft rules now — transfers and automatic splits unlock once your identity is verified. <Link href="/onboarding" className="font-medium underline">Complete verification</Link>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="p-6">
          <p className="text-sm text-muted">Salary account balance</p>
          <p className="tabular mt-2 text-3xl font-semibold">{naira(d.salary)}</p>
          {d.account?.status === "ACTIVE" ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-muted">
              <span>{d.account.accountNumber} · {d.account.bankName}</span>
              <CopyButton text={`${d.account.accountNumber} — ${d.account.bankName} — ${d.account.accountName}`} label="Copy details" />
            </div>
          ) : d.account?.status === "FAILED" || d.account?.status === "PENDING" ? (
            <div className="mt-2 space-y-2 text-sm text-warn"><p>Salary account setup {d.account.status === "PENDING" ? "is pending" : "failed"}.</p><RetryProvision /></div>
          ) : <p className="mt-2 text-sm text-muted">Available after identity verification.</p>}
        </Card>
        <Kpi href="/rules" title="Last split allocation" value={naira(lastAlloc)} left={`${activeRules.length} active rule${activeRules.length === 1 ? "" : "s"}`} right={d.lastExec ? `${pct}% of salary` : "No splits yet"} />
        <Kpi href="/destinations" title="Total in wallets" value={naira(d.walletTotal)} left={`${d.wallets.length} wallet${d.wallets.length === 1 ? "" : "s"}`} right={`${d.wallets.filter((w) => w.targetMinor).length} with targets`} />
        <Kpi href="/settings" title="Expected next salary" value={d.nextSalary ? fmtDate(d.nextSalary) : "Not set"} left="Split runs when salary arrives" right={<Badge status={d.salary > 0n && activeRules.length ? "ACTIVE" : "PENDING"} className="whitespace-nowrap" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {!setupDone && (
            <Card className="p-6">
              <h2 className="text-lg font-medium">Finish setting up</h2>
              <p className="text-sm text-muted">{steps.filter((s) => s.done).length} of {steps.length} done</p>
              <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                {steps.map((s) => (
                  <li key={s.label}>
                    <Link href={s.href} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm hover:bg-canvas">
                      {s.done ? <CheckCircle2 size={18} className="text-success" aria-label="Done" /> : <Circle size={18} className="text-muted" aria-label="To do" />}
                      <span className={s.done ? "text-muted line-through" : ""}>{s.label}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-4">
              <h2 className="text-lg font-medium">Recent activity & splits</h2>
              <div className="flex items-center gap-2"><RunNowButton disabledReason={runDisabled} /></div>
            </div>
            {d.recent.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-y border-line bg-canvas text-left text-xs text-muted"><tr><th className="px-6 py-3 font-medium">Description</th><th className="px-3 py-3 font-medium">Category</th><th className="px-3 py-3 font-medium">Date</th><th className="px-3 py-3 font-medium">Status</th><th className="px-6 py-3 text-right font-medium">Amount</th></tr></thead>
                  <tbody>
                    {d.recent.map((t) => (
                      <tr key={t.id} className="border-b border-line last:border-0 hover:bg-canvas">
                        <td className="px-6 py-3"><Link href={`/transactions/${t.id}`} className="hover:underline">{t.description}</Link></td>
                        <td className="px-3 py-3"><span className="rounded-lg border border-line px-2 py-0.5 text-xs">{t.category}</span></td>
                        <td className="px-3 py-3 text-muted">{fmtDateTime(t.createdAt)}</td>
                        <td className="px-3 py-3"><Badge status={t.status} /></td>
                        <td className={`tabular px-6 py-3 text-right font-medium ${t.direction === "in" ? "text-success" : t.direction === "out" ? "text-ink" : "text-brand"}`}>{t.direction === "in" ? "+" : t.direction === "out" ? "−" : ""}{naira(t.amountMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end p-4"><Link href="/transactions" className="inline-flex items-center gap-1 text-sm text-brand hover:underline">View full ledger <ArrowRight size={14} /></Link></div>
              </div>
            ) : <Empty title="No salary received yet" body={d.account?.status === "ACTIVE" ? "Share your salary account details with your employer. Your split will run automatically when salary arrives." : "Once your salary account is ready, incoming salary and splits will appear here."} />}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between"><h2 className="text-lg font-medium">Salary partition</h2><Link href="/rules" className="text-sm text-brand hover:underline">See rules</Link></div>
            {d.lastExec ? (
              <>
                <Donut parts={[{ v: walletAlloc, c: "#1e9bf0" }, { v: benAlloc, c: "#0b1424" }, { v: d.lastExec.remainingMinor, c: "#e6ebf2" }]} center={naira(d.lastExec.remainingMinor)} sub={`${base > 0n ? Number((d.lastExec.remainingMinor * 100n) / base) : 0}% left`} />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="border-l-2 border-brand pl-3"><p className="tabular font-semibold">{naira(walletAlloc)}</p><p className="text-muted">Wallets</p></div>
                  <div className="border-l-2 border-navy pl-3"><p className="tabular font-semibold">{naira(benAlloc)}</p><p className="text-muted">Beneficiaries</p></div>
                </div>
                <Link href={`/rules/history/${d.lastExec.id}`} className="mt-4 inline-flex items-center gap-1 text-sm text-brand hover:underline">Last split · {fmtDate(d.lastExec.createdAt)} <Badge status={d.lastExec.status} /></Link>
              </>
            ) : <Empty title="No splits yet" body="Your first split runs when salary arrives in your salary account." />}
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between"><h2 className="text-lg font-medium">Wallets</h2><Link href="/destinations" className="text-sm text-brand hover:underline">All</Link></div>
            {d.wallets.length ? (
              <ul className="mt-4 space-y-2">
                {d.wallets.slice(0, 5).map((w, i) => (
                  <li key={w.id}>
                    <Link href={`/destinations/wallets/${w.id}`} className={`flex items-center gap-3 rounded-2xl p-3 ${["bg-success-50", "bg-danger-50", "bg-brand-50", "bg-warn-50"][i % 4]}`}>
                      <span className="grid size-10 place-items-center rounded-xl bg-white text-brand"><WalletIcon size={18} /></span>
                      <span className="flex-1"><span className="block font-medium">{w.name}</span><span className="text-xs text-muted">{w.category}</span></span>
                      <span className="tabular font-semibold">{naira(w.balanceMinor)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <Empty title="No wallets yet" body="Create a wallet for savings, rent or emergencies." action={<LinkButton href="/destinations/wallets/new" size="sm">Create wallet</LinkButton>} />}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({ href, title, value, left, right }: { href: string; title: string; value: string; left: string; right: React.ReactNode }) {
  return (
    <Link href={href} className="block rounded-[var(--radius-card)] border border-line bg-gradient-to-b from-brand-50 to-white p-6 hover:border-brand/40">
      <p className="flex items-center justify-between text-sm">{title}<ArrowRight size={16} className="text-muted" /></p>
      <p className="tabular mt-3 text-2xl font-semibold">{value}</p>
      <p className="mt-2 flex items-center justify-between gap-2 text-xs text-muted"><span>{left}</span><span>{right}</span></p>
    </Link>
  );
}

function Donut({ parts, center, sub }: { parts: { v: bigint; c: string }[]; center: string; sub: string }) {
  const total = parts.reduce((s, p) => s + p.v, 0n) || 1n;
  const r = 70, C = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="relative mx-auto my-6 size-48">
      <svg viewBox="0 0 180 180" className="-rotate-90" role="img" aria-label={`Salary remaining ${center}`}>
        <circle cx="90" cy="90" r={r} fill="none" stroke="#f1f5f9" strokeWidth="16" />
        {parts.map((p, i) => { const len = (Number(p.v) / Number(total)) * C; const el = <circle key={i} cx="90" cy="90" r={r} fill="none" stroke={p.c} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} />; off += len; return el; })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><span className="text-xs text-muted">Salary remaining</span><span className="tabular text-xl font-semibold">{center}</span><span className="text-xs text-success">{sub}</span></div>
    </div>
  );
}
