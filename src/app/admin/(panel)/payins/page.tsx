import Link from "next/link";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { formatBps } from "@/core/money";
import { naira, fmtDateTime } from "@/lib/format";
import { Alert, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { PayinForm } from "./payin-form";

const RESULTS: Record<string, [string, "success" | "danger" | "warn"]> = {
  ok: ["Pay-in confirmed with Flutterwave and the split has run.", "success"], cancelled: ["Checkout was cancelled — nothing was paid in.", "warn"],
  unverified: ["Flutterwave did not confirm this payment, so no salary was credited.", "danger"], nouser: ["Payment confirmed but couldn't be matched to a user.", "danger"], error: ["Payment confirmed but processing failed. Reconciliation will retry.", "danger"],
};

export default async function AdminPayins({ searchParams }: { searchParams: Promise<{ user?: string; result?: string; payin?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const eligible = await prisma.user.findMany({ where: { role: "USER", kycStatus: "APPROVED", collectionAccount: { status: "ACTIVE" } }, include: { collectionAccount: true, rules: { where: { status: "ACTIVE" }, include: { wallet: true, beneficiary: true }, orderBy: { priority: "asc" } } } });
  const runs = await prisma.payin.findMany({ where: { source: "ADMIN_TEST" }, include: { user: true, executions: true }, orderBy: { receivedAt: "desc" }, take: 25 });
  const res = sp.result ? RESULTS[sp.result] : null;
  const justRun = sp.payin ? runs.find((r) => r.id === sp.payin) : null;
  return (
    <>
      <PageHeader title="Salary payments" crumbs={[{ href: "/admin", label: "Dashboard" }, { label: "Salary payments" }]} />
      {res && <Alert tone={res[1]} className="mb-6">{res[0]} {justRun?.executions[0] && <Link className="underline" href={`/admin/payins/${justRun.executions[0].id}`}>View split result</Link>}</Alert>}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="p-6 sm:p-8">
          <h2 className="text-lg font-medium">New test pay-in</h2>
          <p className="mb-5 mt-1 text-sm text-muted">Opens a Flutterwave sandbox checkout. Pay with test card <b>5531 8866 5214 2950</b>, CVV 564, expiry 09/32, PIN 3310, OTP 12345. The webhook / redirect is verified with Flutterwave before salary is credited and the user's rules run.</p>
          {eligible.length ? <PayinForm users={eligible.map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName} · ${u.email}`, account: `${u.collectionAccount!.accountNumber} · ${u.collectionAccount!.bankName}`, rules: u.rules.map((r) => `${r.priority}. ${r.name} → ${r.wallet?.name ?? r.beneficiary?.name} (${r.method === "FIXED" ? naira(r.amountMinor!) : formatBps(r.percentBps!)})`) }))} preselect={sp.user} />
            : <Empty title="No eligible users" body="Only verified users with an active salary account can receive a test pay-in." />}
        </Card>
        <Card>
          <h2 className="p-6 pb-3 text-lg font-medium">Test runs</h2>
          {runs.length ? (
            <ul className="divide-y divide-line text-sm">
              {runs.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <span><span className="block font-medium">{r.user.firstName} {r.user.lastName}</span><span className="text-xs text-muted">{fmtDateTime(r.receivedAt)} · ref {r.providerRef}</span></span>
                  <span className="text-right"><span className="tabular block font-semibold">{naira(r.amountMinor)}</span>{r.executions[0] ? <Link href={`/admin/payins/${r.executions[0].id}`}><Badge status={r.executions[0].status} /></Link> : <Badge status="PENDING" />}</span>
                </li>
              ))}
            </ul>
          ) : <Empty title="No admin test runs yet" body="Test pay-ins you send will be listed here with their split results." />}
        </Card>
      </div>
    </>
  );
}
