import Link from "next/link";
import type { TxRow } from "@/server/queries";
import { naira, fmtDateTime } from "@/lib/format";
import { Badge, Empty } from "./ui";

export function TxTable({ rows, emptyTitle = "No transactions available", emptyBody = "Transactions will appear here once money moves." }: { rows: TxRow[]; emptyTitle?: string; emptyBody?: string }) {
  if (!rows.length) return <Empty title={emptyTitle} body={emptyBody} />;
  return (
    <>
      <table className="hidden w-full text-sm md:table">
        <thead className="border-y border-line bg-canvas text-left text-xs text-muted">
          <tr><th className="px-6 py-3 font-medium">Reference</th><th className="px-3 py-3 font-medium">Description</th><th className="px-3 py-3 font-medium">Type</th><th className="px-3 py-3 font-medium">From → To</th><th className="px-3 py-3 font-medium">Date</th><th className="px-3 py-3 font-medium">Status</th><th className="px-6 py-3 text-right font-medium">Amount</th></tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-b border-line last:border-0 hover:bg-canvas">
              <td className="px-6 py-3 font-mono text-xs"><Link href={`/transactions/${t.id}`} className="text-brand hover:underline">{t.reference}</Link></td>
              <td className="px-3 py-3">{t.description}</td>
              <td className="px-3 py-3 text-muted">{t.label}</td>
              <td className="px-3 py-3 text-muted">{t.source} → {t.destination}</td>
              <td className="px-3 py-3 text-muted">{fmtDateTime(t.createdAt)}</td>
              <td className="px-3 py-3"><Badge status={t.status} /></td>
              <td className={`tabular px-6 py-3 text-right font-medium ${t.direction === "in" ? "text-success" : ""}`}>{t.direction === "in" ? "+" : t.direction === "out" ? "−" : ""}{naira(t.amountMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-line md:hidden">
        {rows.map((t) => (
          <li key={t.id}><Link href={`/transactions/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
            <span><span className="block text-sm font-medium">{t.description}</span><span className="text-xs text-muted">{fmtDateTime(t.createdAt)}</span></span>
            <span className="text-right"><span className={`tabular block text-sm font-semibold ${t.direction === "in" ? "text-success" : ""}`}>{t.direction === "in" ? "+" : t.direction === "out" ? "−" : ""}{naira(t.amountMinor)}</span><Badge status={t.status} /></span>
          </Link></li>
        ))}
      </ul>
    </>
  );
}
