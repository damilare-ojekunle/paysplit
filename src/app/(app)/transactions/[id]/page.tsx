import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requireVerifiedUser } from "@/server/auth";
import { getTransaction } from "@/server/queries";
import { naira, fmtDateTime } from "@/lib/format";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";

export default async function TxDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireVerifiedUser();
  const t = await getTransaction(user.id, (await params).id);
  if (!t) notFound();
  const rows: [string, React.ReactNode][] = [
    ["Reference", <span key="r" className="font-mono">{t.reference}</span>], ["Type", t.label], ["Status", <Badge key="s" status={t.status} />], ["Date & time", fmtDateTime(t.createdAt)],
    ["From", t.source], ["To", t.destination], ["Category", t.category], ["Description", t.description],
    ["Provider reference", t.providerRef ?? "—"], ["Fees", "₦0"],
    ...(t.executionId ? [["Split", <Link key="e" href={`/rules/history/${t.executionId}`} className="text-brand hover:underline">View split breakdown</Link>] as [string, React.ReactNode]] : []),
  ];
  return (
    <>
      <PageHeader title="Transaction details" crumbs={[{ href: "/transactions", label: "Transactions" }, { label: t.reference }]} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-6 sm:p-8">
          <p className="text-sm text-muted">{t.label}</p>
          <p className={`tabular mt-1 text-4xl font-semibold ${t.direction === "in" ? "text-success" : ""}`}>{t.direction === "in" ? "+" : t.direction === "out" ? "−" : ""}{naira(t.amountMinor)}</p>
          {t.status === "FAILED" && <Alert tone="danger" className="mt-4">This transfer failed{t.failureReason ? `: ${t.failureReason}` : ""}. The money was returned to your salary account.</Alert>}
          {(t.status === "PENDING" || t.status === "RETRYING") && <Alert tone="warn" className="mt-4">Waiting for confirmation from the payment provider. We confirm the outcome before any retry, so you won't be charged twice.</Alert>}
          <dl className="mt-6 divide-y divide-line text-sm">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-3"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>)}</dl>
        </Card>
        <Card className="h-fit p-6">
          <h2 className="font-medium">Receipt</h2>
          {t.status === "SUCCESS" ? (
            <a href={`/api/transactions/${t.id}/receipt`} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-medium text-white hover:bg-brand-600"><Download size={16} /> Download PDF receipt</a>
          ) : <p className="mt-2 text-sm text-muted">Receipts are available once a transaction succeeds.</p>}
        </Card>
      </div>
    </>
  );
}
