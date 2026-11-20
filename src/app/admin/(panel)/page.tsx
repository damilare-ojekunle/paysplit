import Link from "next/link";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { naira, fmtDate } from "@/lib/format";
import { Badge, Card, Input, PageHeader, Button } from "@/components/ui";

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const q = (await searchParams).q?.trim();
  const [total, verified, salary, users, recon] = await Promise.all([
    prisma.user.count({ where: { role: "USER" } }),
    prisma.user.count({ where: { role: "USER", kycStatus: "APPROVED" } }),
    prisma.payin.aggregate({ where: { status: "CONFIRMED" }, _sum: { amountMinor: true } }),
    prisma.user.findMany({ where: { role: "USER", ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } : {}) }, include: { collectionAccount: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.auditLog.findFirst({ where: { action: "reconcile.run" }, orderBy: { createdAt: "desc" } }),
  ]);
  const r = recon?.metadata as { ledgerImbalance?: string; inFlightMismatch?: unknown } | undefined;
  return (
    <>
      <PageHeader title="Overview" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[["Registered users", total], ["Verified", verified], ["Unverified", total - verified], ["Total salary paid in", naira(salary._sum.amountMinor ?? 0n)]].map(([k, v]) => <Card key={k as string} className="p-5"><p className="text-sm text-muted">{k as string}</p><p className="tabular mt-1 text-2xl font-semibold">{v as string}</p></Card>)}
        <Card className="p-5"><p className="text-sm text-muted">Last reconciliation</p><p className="mt-1 text-sm">{recon ? <>{fmtDate(recon.createdAt)} · <Badge status={r?.ledgerImbalance === "0" && !r?.inFlightMismatch ? "SUCCESS" : "FAILED"} /></> : "Not run yet"}</p></Card>
      </div>
      <Card className="mt-6">
        <form className="flex gap-2 p-4" role="search"><Input name="q" defaultValue={q} placeholder="Search users by name or email" className="h-10" aria-label="Search users" /><Button size="sm" className="h-10">Search</Button></form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-y border-line bg-canvas text-left text-xs text-muted"><tr><th className="px-6 py-3 font-medium">User</th><th className="px-3 py-3 font-medium">Verification</th><th className="px-3 py-3 font-medium">Salary account</th><th className="px-3 py-3 font-medium">Joined</th><th className="px-6 py-3 font-medium">Pay-in eligibility</th></tr></thead>
            <tbody>
              {users.map((u) => {
                const eligible = u.kycStatus === "APPROVED" && u.collectionAccount?.status === "ACTIVE";
                return (
                  <tr key={u.id} className="border-b border-line last:border-0 hover:bg-canvas">
                    <td className="px-6 py-3"><Link href={`/admin/users/${u.id}`} className="font-medium text-brand hover:underline">{u.firstName} {u.lastName}</Link><p className="text-xs text-muted">{u.email}</p></td>
                    <td className="px-3 py-3"><Badge status={u.kycStatus} /></td>
                    <td className="px-3 py-3">{u.collectionAccount?.status === "ACTIVE" ? `${u.collectionAccount.accountNumber} · ${u.collectionAccount.bankName}` : <span className="text-muted">{u.collectionAccount?.status ?? "None"}</span>}</td>
                    <td className="px-3 py-3 text-muted">{fmtDate(u.createdAt)}</td>
                    <td className="px-6 py-3">{eligible ? <Link href={`/admin/payins?user=${u.id}`} className="text-brand hover:underline">Send test salary</Link> : <span className="text-xs text-muted">{u.kycStatus !== "APPROVED" ? "Not verified" : "No salary account"}</span>}</td>
                  </tr>
                );
              })}
              {!users.length && <tr><td colSpan={5} className="px-6 py-10 text-center text-muted">No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
