import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { audit } from "@/server/notify";
import { formatBps } from "@/core/money";
import { naira, fmtDateTime, maskAcct } from "@/lib/format";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const u = await prisma.user.findUnique({
    where: { id: (await params).id },
    include: { collectionAccount: true, wallets: { where: { archivedAt: null } }, beneficiaries: { where: { archivedAt: null } }, rules: { include: { wallet: true, beneficiary: true }, orderBy: { priority: "asc" } }, payins: { orderBy: { receivedAt: "desc" }, take: 20 }, executions: { orderBy: { createdAt: "desc" }, take: 10, include: { items: true } }, kyc: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!u) notFound();
  await audit(admin.id, "admin.view_user", { type: "User", id: u.id });
  const eligible = u.kycStatus === "APPROVED" && u.collectionAccount?.status === "ACTIVE";
  return (
    <>
      <PageHeader title={`${u.firstName} ${u.lastName}`} crumbs={[{ href: "/admin", label: "Overview" }, { label: u.email }]} action={eligible ? <LinkButton href={`/admin/payins?user=${u.id}`}>Send test salary</LinkButton> : undefined} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 text-sm"><h2 className="mb-3 font-medium">Profile</h2><p>{u.email}</p><p className="text-muted">{u.phone ?? "No phone"} · {u.country ?? "—"}</p><p className="mt-2"><Badge status={u.kycStatus} /> {u.kyc[0] && <span className="text-muted">{u.kyc[0].idType} {u.kyc[0].idNumberMasked}</span>}</p></Card>
        <Card className="p-6 text-sm"><h2 className="mb-3 font-medium">Salary account</h2>{u.collectionAccount?.status === "ACTIVE" ? <><p className="tabular text-lg font-semibold">{u.collectionAccount.accountNumber}</p><p>{u.collectionAccount.bankName}</p></> : <p className="text-muted">{u.collectionAccount?.status ?? "Not provisioned"}</p>}</Card>
        <Card className="p-6 text-sm"><h2 className="mb-3 font-medium">Destinations</h2><p>{u.wallets.length} wallets · {u.beneficiaries.length} beneficiaries</p><ul className="mt-2 space-y-1 text-muted">{u.beneficiaries.map((b) => <li key={b.id}>{b.name} · {b.bankName} {maskAcct(b.accountNumber)}</li>)}</ul></Card>
      </div>
      <Card className="mt-6 overflow-x-auto"><h2 className="p-6 pb-3 font-medium">Split rules</h2>
        <table className="w-full min-w-[640px] text-sm"><thead className="border-y border-line bg-canvas text-left text-xs text-muted"><tr><th className="px-6 py-2">#</th><th className="px-3 py-2">Rule</th><th className="px-3 py-2">Destination</th><th className="px-3 py-2">Value</th><th className="px-6 py-2">Status</th></tr></thead>
          <tbody>{u.rules.map((r) => <tr key={r.id} className="border-b border-line"><td className="px-6 py-2">{r.priority}</td><td className="px-3 py-2">{r.name}</td><td className="px-3 py-2">{r.wallet?.name ?? r.beneficiary?.name}</td><td className="px-3 py-2">{r.method === "FIXED" ? naira(r.amountMinor!) : formatBps(r.percentBps!)}</td><td className="px-6 py-2"><Badge status={r.status} /></td></tr>)}</tbody></table>
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-6"><h2 className="mb-3 font-medium">Salary transactions</h2><ul className="divide-y divide-line text-sm">{u.payins.map((p) => <li key={p.id} className="flex justify-between py-2"><span>{fmtDateTime(p.receivedAt)} <span className="text-xs text-muted">{p.source === "ADMIN_TEST" ? "test" : "webhook"} · {p.providerRef}</span></span><span className="tabular font-medium">{naira(p.amountMinor)}</span></li>)}{!u.payins.length && <li className="py-4 text-muted">No salary received.</li>}</ul></Card>
        <Card className="p-6"><h2 className="mb-3 font-medium">Split executions</h2><ul className="divide-y divide-line text-sm">{u.executions.map((e) => <li key={e.id} className="flex justify-between py-2"><Link href={`/admin/payins/${e.id}`} className="text-brand hover:underline">{fmtDateTime(e.createdAt)} · {e.trigger.toLowerCase()}</Link><span className="flex items-center gap-2">{naira(e.allocatedMinor)} <Badge status={e.status} /></span></li>)}{!u.executions.length && <li className="py-4 text-muted">No splits yet.</li>}</ul></Card>
      </div>
    </>
  );
}
