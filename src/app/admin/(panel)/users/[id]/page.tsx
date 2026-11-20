import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { balancesFor } from "@/server/ledger";
import { audit } from "@/server/notify";
import { formatBps } from "@/core/money";
import { naira, fmtDate, fmtDateTimeBar } from "@/lib/format";
import { Badge, CategoryPill, Empty, PageHeader, Panel, Table, TablePanel, td, th } from "@/components/ui";
import { Avatar } from "@/components/top-nav";
import { PaySalaryButton } from "@/components/admin-bits";
import { WalletIcon, walletTone } from "@/components/wallet-icon";
import { ruleQualifiers } from "@/server/rule-page-data";

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const u = await prisma.user.findUnique({
    where: { id: (await params).id },
    include: { collectionAccount: true, wallets: { where: { archivedAt: null }, orderBy: { createdAt: "asc" } }, beneficiaries: { where: { archivedAt: null } }, rules: { include: { wallet: true, beneficiary: true }, orderBy: { priority: "asc" } }, payins: { orderBy: { receivedAt: "desc" }, take: 20 }, executions: { orderBy: { createdAt: "desc" }, take: 10, include: { items: true } }, kyc: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!u) notFound();
  await audit(admin.id, "admin.view_user", { type: "User", id: u.id });
  const bal = await balancesFor(u.wallets.map((w) => w.ledgerAccountId));
  const paid = u.payins.reduce((s, p) => s + p.amountMinor, 0n);
  const acct = u.collectionAccount?.status === "ACTIVE" ? u.collectionAccount : null;
  const eligible = u.kycStatus === "APPROVED" && !!acct;
  const name = `${u.firstName} ${u.lastName}`;
  const active = u.rules.filter((r) => r.status === "ACTIVE");

  return (
    <>
      <PageHeader title="Users" crumbs={[{ href: "/admin", label: "Dashboard" }, { href: "/admin/users", label: "Manage Users" }, { label: name }]} />
      <Panel className="space-y-4 sm:-mx-4">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-line-2 bg-panel-2 p-4">
          <div className="flex items-center gap-4">
            <Link href="/admin/users" aria-label="Back to users" className="grid size-8 place-items-center rounded-lg hover:bg-panel"><ArrowLeft size={20} /></Link>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="size-14 rounded-full object-cover" /> : <Avatar name={name} size={56} />}
            <div><p className="text-xl">{name}</p><p className="text-sm text-muted">{u.email} · {u.phone ?? "no phone"} · joined {fmtDate(u.createdAt)}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <Badge status={u.kycStatus} />
            {eligible && <PaySalaryButton user={{ id: u.id, name, account: `${acct!.accountNumber} · ${acct!.bankName}` }} defaultAmount="50000" rules={active.map((r) => `${r.name} → ${r.wallet?.name ?? r.beneficiary?.name} (${r.method === "FIXED" ? naira(r.amountMinor!) : formatBps(r.percentBps!)})`)} />}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Total Amount Paid", naira(paid), `${u.payins.length} salary payment${u.payins.length === 1 ? "" : "s"}`],
            ["Salary Account", acct ? acct.accountNumber! : "None", acct ? `${acct.bankName} / PaySplit` : "Created after verification"],
            ["Identity", u.kyc[0] ? `${u.kyc[0].idType} ${u.kyc[0].idNumberMasked}` : "Not submitted", u.kyc[0] ? `${u.kyc[0].provider} · ${u.kyc[0].status.toLowerCase().replace("_", " ")}` : "No verification yet"],
            ["Expected Salary", u.monthlySalaryMinor ? naira(u.monthlySalaryMinor) : "Not set", u.salaryDay ? `Pay day: ${u.salaryDay}` : "Pay day not set"],
          ].map(([t, v, sub]) => <div key={t} className="kpi-card rounded-2xl p-5"><p className="text-[15px]">{t}</p><p className="tabular mt-6 truncate text-[24px] font-medium">{v}</p><p className="mt-1 text-[13px] text-muted">{sub}</p></div>)}
        </div>

        {u.wallets.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {u.wallets.map((w, i) => (
              <div key={w.id} className={`rounded-[20px] bg-gradient-to-b ${walletTone(i, w.color).soft} p-5`}>
                <div className="flex items-center gap-3"><WalletIcon category={w.category} index={i} color={w.color} size={44} /><div className="flex-1"><p className="font-medium">{w.name}</p><p className="text-xs text-muted">{w.category}</p></div><p className="tabular text-xl">{naira(bal.get(w.ledgerAccountId) ?? 0n)}</p></div>
                <p className="mt-6 text-xs text-muted">Created: <span className="text-ink">{fmtDate(w.createdAt)}</span></p>
              </div>
            ))}
          </div>
        )}

        <TablePanel title="Split Rules">
          {u.rules.length ? (
            <Table head={<><th className={th}>#</th><th className={th}>Rule</th><th className={th}>Destination</th><th className={th}>Value</th><th className={th}>Status</th></>}>
              {u.rules.map((r) => <tr key={r.id}><td className={td}>{r.priority}</td><td className={td}>{r.name}{ruleQualifiers(r) && <span className="block text-xs text-muted">{ruleQualifiers(r)}</span>}</td><td className={td}>{r.wallet ? `${r.wallet.name} (wallet)` : `${r.beneficiary?.name} (${r.beneficiary?.bankName})`}</td><td className={td + " tabular"}>{r.method === "FIXED" ? naira(r.amountMinor!) : formatBps(r.percentBps!)}</td><td className={td}><Badge status={r.status} /></td></tr>)}
            </Table>
          ) : <Empty title="No rules yet" body="This user hasn't created any split rules." />}
        </TablePanel>

        <div className="grid gap-4 xl:grid-cols-2">
          <TablePanel title="Salary Transactions">
            {u.payins.length ? (
              <Table head={<><th className={th}>Date</th><th className={th}>Source</th><th className={th}>Pay ID</th><th className={th}>Amount</th></>}>
                {u.payins.map((p) => <tr key={p.id}><td className={td + " whitespace-nowrap"}>{fmtDateTimeBar(p.receivedAt)}</td><td className={td}><CategoryPill>{p.source === "ADMIN_TEST" ? "Test pay-in" : "Bank transfer"}</CategoryPill></td><td className={td}>{p.providerRef}</td><td className={td + " tabular text-success"}>{naira(p.amountMinor)}</td></tr>)}
              </Table>
            ) : <Empty title="No salary received" body="Use Pay salary to send a sandbox salary." />}
          </TablePanel>
          <TablePanel title="Split Executions">
            {u.executions.length ? (
              <Table head={<><th className={th}>Date</th><th className={th}>Trigger</th><th className={th}>Allocated</th><th className={th}>Status</th></>}>
                {u.executions.map((e) => <tr key={e.id}><td className={td + " whitespace-nowrap"}><Link href={`/admin/payins/${e.id}`} className="text-brand hover:underline">{fmtDateTimeBar(e.createdAt)}</Link></td><td className={td}>{e.trigger === "AUTO" ? "Automatic" : "Run now"}</td><td className={td + " tabular"}>{naira(e.allocatedMinor)}</td><td className={td}><Badge status={e.status} /></td></tr>)}
              </Table>
            ) : <Empty title="No splits yet" body="Splits appear when salary arrives." />}
          </TablePanel>
        </div>
      </Panel>
    </>
  );
}
