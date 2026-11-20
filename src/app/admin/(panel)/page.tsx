import Link from "next/link";
import { ChevronRight, Eye, ReceiptText } from "lucide-react";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { naira, fmtDate } from "@/lib/format";
import { Alert, Badge, Checkbox, Empty, FlowIcon, Panel, SearchBox, Table, TablePanel, td, th } from "@/components/ui";

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ q?: string; pq?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const q = sp.q?.trim(), pq = sp.pq?.trim();
  const userQ = (s?: string) => (s ? { OR: [{ email: { contains: s, mode: "insensitive" as const } }, { firstName: { contains: s, mode: "insensitive" as const } }, { lastName: { contains: s, mode: "insensitive" as const } }] } : {});
  const [total, verified, pending, salary, payers, users, payins, recon] = await Promise.all([
    prisma.user.count({ where: { role: "USER" } }),
    prisma.user.count({ where: { role: "USER", kycStatus: "APPROVED" } }),
    prisma.user.count({ where: { role: "USER", kycStatus: { in: ["IN_PROGRESS", "PENDING_REVIEW", "ACTION_REQUIRED"] } } }),
    prisma.payin.aggregate({ where: { status: "CONFIRMED" }, _sum: { amountMinor: true } }),
    prisma.payin.groupBy({ by: ["userId"], where: { status: "CONFIRMED" } }),
    prisma.user.findMany({ where: { role: "USER", ...userQ(q) }, orderBy: { createdAt: "desc" }, take: 7 }),
    prisma.payin.findMany({ where: { status: "CONFIRMED", ...(pq ? { user: userQ(pq) } : {}) }, include: { user: true }, orderBy: { receivedAt: "desc" }, take: 7 }),
    prisma.auditLog.findFirst({ where: { action: "reconcile.run" }, orderBy: { createdAt: "desc" } }),
  ]);
  const r = recon?.metadata as { ledgerImbalance?: string; inFlightMismatch?: unknown } | undefined;
  const healthy = r?.ledgerImbalance === "0" && !r?.inFlightMismatch;
  const hour = Number(new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", hour12: false }));
  const greet = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const now = new Date();
  const day = Number(now.toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", day: "numeric" }));
  const ord = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";

  return (
    <>
      <div className="pb-6 pt-7">
        <h1 className="text-[30px] leading-tight">{greet}, {admin.firstName}!</h1>
        <p className="mt-2 text-[15px] text-muted"><b className="font-semibold text-ink">{now.toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", weekday: "long" })},</b> {now.toLocaleDateString("en-US", { timeZone: "Africa/Lagos", month: "long" })} {day}{ord}, {now.getFullYear()}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi href="/admin/users" title="Total Users" value={String(total)} left="Enrolled Employees" right={<span className="text-brand">Browse/view all</span>} />
        <Kpi href="/admin/users?f=verified" title="Verified Users" value={String(verified)} left={`${total ? Math.round((verified * 100) / total) : 0}% verification rate`} />
        <Kpi href="/admin/users?f=unverified" title="Pending Verification" value={String(pending)} left="Pending compliance ID review" />
        <Kpi href="/admin/payins" title="Total Salary Paid" value={naira(salary._sum.amountMinor ?? 0n)} left={`disbursed to ${payers.length} employee${payers.length === 1 ? "" : "s"}`} />
      </div>

      {recon && <Alert tone={healthy ? "success" : "danger"} className="mt-5">Last reconciliation {fmtDate(recon.createdAt)}: {healthy ? "ledger balanced, transfers in flight match the provider." : "a mismatch was found. Check the reconciliation log."}</Alert>}

      <Panel className="mt-5 grid gap-4 sm:-mx-4 xl:grid-cols-2">
        <TablePanel title="Recent Users" tools={<SearchBox defaultValue={q} hidden={{ pq }} />} footer={<><span>Showing {users.length} of {total} users</span><Link href="/admin/users" className="flex items-center gap-1 text-brand hover:underline">View Full List <ChevronRight size={16} /></Link></>}>
          {users.length ? (
            <Table head={<><th className={th + " w-10"}><Checkbox aria-label="Select all users" /></th><th className={th}>Employee</th><th className={th}>Joined</th><th className={th}>Verification</th><th className={th}>Status</th><th className={th + " w-14"}>Action</th></>}>
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-panel-2">
                  <td className={td}><Checkbox aria-label={`Select ${u.firstName}`} /></td>
                  <td className={td + " py-2"}><span className="block">{u.firstName} {u.lastName}</span><span className="block max-w-[180px] truncate text-xs text-muted">{u.email}</span></td>
                  <td className={td + " whitespace-nowrap"}>{fmtDate(u.createdAt)}</td>
                  <td className={td}>{u.kycStatus === "APPROVED" ? "Verified" : "Unverified"}</td>
                  <td className={td}><Badge status={u.emailVerifiedAt ? "ACTIVE" : "PENDING"} label={u.emailVerifiedAt ? "Active" : "Invited"} /></td>
                  <td className={td}><Link href={`/admin/users/${u.id}`} aria-label={`View ${u.firstName}`} className="grid size-8 place-items-center rounded-lg hover:bg-panel"><Eye size={18} strokeWidth={1.7} /></Link></td>
                </tr>
              ))}
            </Table>
          ) : <Empty title="No users found" body="Try a different search." />}
        </TablePanel>

        <TablePanel title="Recent Salary payment" tools={<SearchBox name="pq" defaultValue={pq} hidden={{ q }} />} footer={<><span>Showing {payins.length} salary payments</span><Link href="/admin/payins" className="flex items-center gap-1 text-brand hover:underline">View Full Ledger <ChevronRight size={16} /></Link></>}>
          {payins.length ? (
            <Table head={<><th className={th}>Employee</th><th className={th}>Pay ID</th><th className={th}>Status</th><th className={th}>Amount</th><th className={th + " w-14"}>Action</th></>}>
              {payins.map((p) => (
                <tr key={p.id} className="hover:bg-panel-2">
                  <td className={td + " py-2"}><span className="flex items-center gap-2.5"><FlowIcon kind="wallet" /><span><span className="block">{p.user.firstName} {p.user.lastName}</span><span className="block max-w-[160px] truncate text-xs text-muted">{p.user.email}</span></span></span></td>
                  <td className={td + " whitespace-nowrap"}>pay-sal-{p.providerRef.slice(-4)}</td>
                  <td className={td}><Badge status="COMPLETED" label="Completed" /></td>
                  <td className={td + " tabular text-brand"}>{naira(p.amountMinor)}</td>
                  <td className={td}><Link href={`/admin/users/${p.userId}`} aria-label="View pay-in" title="View" className="grid size-8 place-items-center rounded-lg hover:bg-panel"><ReceiptText size={17} strokeWidth={1.7} /></Link></td>
                </tr>
              ))}
            </Table>
          ) : <Empty title="No salary payments yet" body="Use Manage Users → Pay salary to send a sandbox salary." />}
        </TablePanel>
      </Panel>
    </>
  );
}

function Kpi({ href, title, value, left, right }: { href: string; title: string; value: string; left: string; right?: React.ReactNode }) {
  return (
    <Link href={href} className="kpi-card flex min-h-[148px] flex-col rounded-2xl p-5 hover:ring-1 hover:ring-brand/30">
      <p className="flex items-center justify-between text-[15px]">{title}<ChevronRight size={18} /></p>
      <p className="tabular mt-auto text-[30px] font-medium leading-tight">{value}</p>
      <p className="mt-2 flex items-center justify-between gap-2 text-sm text-muted"><span>{left}</span>{right}</p>
    </Link>
  );
}
