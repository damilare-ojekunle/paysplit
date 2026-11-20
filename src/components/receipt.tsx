import Link from "next/link";
import { Download } from "lucide-react";
import type { TxRow } from "@/server/queries";
import { naira, fmtDateTimeBar, flowKind } from "@/lib/format";
import { Alert, amountClass, Badge, CategoryPill, FlowIcon } from "./ui";

/** Receipt content shared by the transactions pop-up and the standalone receipt page. */
export function ReceiptBody({ t }: { t: TxRow }) {
  const k = flowKind(t);
  const rows: [string, React.ReactNode][] = [
    ["Reference", <span key="r" className="font-mono text-[13px]">{t.reference}</span>],
    ["Type", t.label],
    ["Date", fmtDateTimeBar(t.createdAt)],
    ["From", t.source],
    ["To", t.destination],
    ["Category", <CategoryPill key="c">{t.category}</CategoryPill>],
    ["Narration", t.description],
    ["Provider reference", t.providerRef ?? "—"],
    ["Fees", "₦0"],
  ];
  return (
    <div>
      <div className="flex flex-col items-center rounded-2xl bg-panel-2 px-5 py-6 text-center">
        <span className="scale-[1.9]"><FlowIcon kind={k} /></span>
        <p className={`tabular mt-5 text-[32px] font-semibold leading-none ${amountClass(k)}`}>{k === "in" ? "+" : "-"}{naira(t.amountMinor)}</p>
        <p className="mt-2 text-sm text-muted">{t.description}</p>
        <div className="mt-3"><Badge status={t.status} /></div>
      </div>
      {t.status === "FAILED" && <Alert tone="danger" className="mt-4">This transfer failed{t.failureReason ? `: ${t.failureReason}` : ""}. The money was returned to your salary account.</Alert>}
      {(t.status === "PENDING" || t.status === "RETRYING") && <Alert tone="warn" className="mt-4">Waiting for the payment provider to confirm. We check the outcome before any retry, so the beneficiary is never paid twice.</Alert>}
      <dl className="mt-4 divide-y divide-dashed divide-line text-sm">
        {rows.map(([key, v]) => <div key={key} className="flex items-center justify-between gap-4 py-3"><dt className="text-muted">{key}</dt><dd className="max-w-[60%] text-right">{v}</dd></div>)}
      </dl>
      {t.executionId && <Link href={`/rules/history/${t.executionId}`} className="mt-1 inline-block text-sm text-brand hover:underline">View split breakdown</Link>}
    </div>
  );
}

export function ReceiptDownload({ t, full }: { t: TxRow; full?: boolean }) {
  if (t.status !== "SUCCESS") return <p className="text-sm text-muted">Receipts are available once a transaction succeeds.</p>;
  return <a href={`/api/transactions/${t.id}/receipt`} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-medium text-white hover:bg-brand-600 ${full ? "w-full" : ""}`}><Download size={16} /> Download Receipt</a>;
}
