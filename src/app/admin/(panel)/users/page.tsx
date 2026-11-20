import Link from "next/link";
import { ChevronRight, Eye } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { formatBps } from "@/core/money";
import { naira, fmtDateTimeBar } from "@/lib/format";
import { Empty, PageHeader, Pagination, Panel, SearchBox, Segmented, Table, TablePanel, td, th } from "@/components/ui";
import { PaySalaryButton } from "@/components/admin-bits";

const ord = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
const PAGE = 10;

export default async function ManageUsers({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const f = sp.f === "verified" || sp.f === "unverified" ? sp.f : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();
  const where: Prisma.UserWhereInput = {
    role: "USER",
    ...(f === "verified" ? { kycStatus: "APPROVED" } : f === "unverified" ? { kycStatus: { not: "APPROVED" } } : {}),
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1) - 3600_000);
  const [total, verified, pending, count, users] = await Promise.all([
    prisma.user.count({ where: { role: "USER" } }),
    prisma.user.count({ where: { role: "USER", kycStatus: "APPROVED" } }),
    prisma.user.count({ where: { role: "USER", kycStatus: { in: ["IN_PROGRESS", "PENDING_REVIEW", "ACTION_REQUIRED"] } } }),
    prisma.user.count({ where }),
    prisma.user.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE,
      include: { collectionAccount: true, kyc: { orderBy: { createdAt: "desc" }, take: 1 }, rules: { where: { status: "ACTIVE" }, include: { wallet: true, beneficiary: true }, orderBy: { priority: "asc" } } },
    }),
  ]);
  const ids = users.map((u) => u.id);
  const [paidTotals, paidThisMonth] = await Promise.all([
    prisma.payin.groupBy({ by: ["userId"], where: { userId: { in: ids }, status: "CONFIRMED" }, _sum: { amountMinor: true } }),
    prisma.payin.groupBy({ by: ["userId"], where: { userId: { in: ids }, status: "CONFIRMED", receivedAt: { gte: monthStart } } }),
  ]);
  const totals = new Map(paidTotals.map((p) => [p.userId, p._sum.amountMinor ?? 0n]));
  const paidNow = new Set(paidThisMonth.map((p) => p.userId));
  const href = (o: Record<string, string | undefined>) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries({ f: f !== "all" ? f : undefined, q, ...o })) if (v) p.set(k, v); const s = p.toString(); return `/admin/users${s ? `?${s}` : ""}`; };
  const pages = Math.max(1, Math.ceil(count / PAGE));

  return (
    <>
      <PageHeader title="Users" crumbs={[{ href: "/admin", label: "Dashboard" }, { label: "Manage Users" }]} />
      <div className="grid gap-5 md:grid-cols-3">
        <Kpi href="/admin/users" title="Total Users" value={total} sub="Enrolled Employees" />
        <Kpi href="/admin/users?f=verified" title="Verified Users" value={verified} sub={`${total ? Math.round((verified * 100) / total) : 0}% verification rate`} />
        <Kpi href="/admin/users?f=unverified" title="Pending Verification" value={pending} sub="Pending compliance ID review" />
      </div>
      <Panel className="mt-5 sm:-mx-4">
        <TablePanel
          title="All Employee"
          tools={<><SearchBox defaultValue={q} hidden={{ f: f !== "all" ? f : undefined }} /><Segmented label="Verification" active={f} items={[{ key: "all", label: "All", href: href({ f: undefined }) }, { key: "verified", label: "Verified", href: href({ f: "verified" }) }, { key: "unverified", label: "Unverified", href: href({ f: "unverified" }) }]} /></>}
          footer={<><span>Showing {users.length} of {count} users</span><Pagination page={page} pages={pages} href={(p) => href({ page: p > 1 ? String(p) : undefined })} /></>}
        >
          {users.length ? (
            <Table className="min-w-[1180px]" head={<><th className={th}>Employee</th><th className={th}>Country</th><th className={th}>Date Joined</th><th className={th}>KYC Verification</th><th className={th}>Salary Account</th><th className={th}>Total Amount paid</th><th className={th}>Pay date</th><th className={th}>Salary Amount</th><th className={th + " text-right"}>Action</th></>}>
              {users.map((u) => {
                const ok = u.kycStatus === "APPROVED";
                const acct = u.collectionAccount?.status === "ACTIVE" ? u.collectionAccount : null;
                return (
                  <tr key={u.id} className="hover:bg-panel-2">
                    <td className={td + " py-3"}><span className="block">{u.firstName} {u.lastName}</span><span className="block max-w-[150px] truncate text-xs text-muted">{u.email}</span></td>
                    <td className={td}>{u.country === "NG" ? "Nigeria" : u.country ?? "—"}</td>
                    <td className={td + " whitespace-nowrap"}>{fmtDateTimeBar(u.createdAt)}</td>
                    <td className={td + " py-3"}><span className={`block ${ok ? "text-success" : u.kycStatus === "REJECTED" ? "text-danger" : "text-warn"}`}>{ok ? "Verified" : u.kycStatus === "NOT_STARTED" ? "Not started" : u.kycStatus === "REJECTED" ? "Rejected" : "Pending"}</span><span className="text-xs text-muted">{u.kyc[0] ? `${u.kyc[0].idType} + Biometrics ID` : "No ID submitted"}</span></td>
                    <td className={td + " py-3"}>{acct ? <><span className="block">{acct.bankName} / PaySplit</span><span className="text-xs text-muted">******{acct.accountNumber?.slice(-4)} NGN</span></> : <span className="text-muted">None</span>}</td>
                    <td className={td + " tabular font-semibold"}>{naira(totals.get(u.id) ?? 0n)}</td>
                    <td className={td}>{u.salaryDay ? ord(u.salaryDay) : "—"}</td>
                    <td className={td + " tabular font-semibold"}>{u.monthlySalaryMinor ? naira(u.monthlySalaryMinor) : "—"}</td>
                    <td className={td}>
                      <span className="flex items-center justify-end gap-2">
                        {paidNow.has(u.id) ? <span className="px-1 text-success">Paid</span>
                          : ok && acct ? <PaySalaryButton user={{ id: u.id, name: `${u.firstName} ${u.lastName}`, account: `${acct.accountNumber} · ${acct.bankName}` }} defaultAmount={u.monthlySalaryMinor && u.monthlySalaryMinor <= 5_000_000n ? String(Number(u.monthlySalaryMinor) / 100) : "50000"} rules={u.rules.map((r) => `${r.name} → ${r.wallet?.name ?? r.beneficiary?.name} (${r.method === "FIXED" ? naira(r.amountMinor!) : formatBps(r.percentBps!)})`)} />
                          : <span className="px-1 text-xs text-muted">{ok ? "No account" : "Not verified"}</span>}
                        <Link href={`/admin/users/${u.id}`} aria-label={`View ${u.firstName}`} className="grid size-8 place-items-center rounded-lg hover:bg-panel"><Eye size={18} strokeWidth={1.7} /></Link>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </Table>
          ) : <Empty title="No users found" body="Try a different search or filter." />}
        </TablePanel>
      </Panel>
    </>
  );
}

function Kpi({ href, title, value, sub }: { href: string; title: string; value: number; sub: string }) {
  return (
    <Link href={href} className="kpi-card flex min-h-[164px] flex-col rounded-2xl p-5 hover:ring-1 hover:ring-brand/30">
      <p className="flex items-center justify-between text-[17px]">{title}<ChevronRight size={18} /></p>
      <p className="tabular mt-auto text-[32px] font-medium leading-tight">{value}</p>
      <p className="mt-1.5 text-[15px] text-muted">{sub}</p>
    </Link>
  );
}
