import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { TxRow } from "@/server/queries";
import { naira, fmtDateTimeBar, flowKind } from "@/lib/format";
import { amountClass, Badge, CategoryPill, Checkbox, FlowIcon, Table, td, th } from "./ui";

/** Figma goal bar: dark hatched fill with a round knob on a light track. */
export function GoalBar({ pct }: { pct: number }) {
  return (
    <div className="relative mt-2.5 h-[22px] rounded-md bg-black/[0.06]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to target">
      <div className="h-full rounded-md" style={{ width: `${pct}%`, background: "repeating-linear-gradient(135deg, #171918 0 5px, #3a3c3b 5px 8px)" }} />
      <span className="absolute top-1/2 size-[30px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/10 bg-gradient-to-b from-white to-[#d9d9d9] shadow-[0_2px_6px_rgba(0,0,0,0.25)]" style={{ left: `${Math.max(pct, 2)}%` }} aria-hidden />
    </div>
  );
}

export function WalletTxRows({ rows }: { rows: TxRow[] }) {
  return (
    <Table head={<><th className={th + " w-10"}><Checkbox aria-label="Select all" /></th><th className={th}>Reference</th><th className={th}>Destination</th><th className={th}>Category</th><th className={th}>Date</th><th className={th}>Status</th><th className={th}>Amount</th><th className={th + " w-10"}><span className="sr-only">Open</span></th></>}>
      {rows.map((t) => {
        const k = t.type === "WALLET_TO_SALARY" ? "in" : flowKind(t);
        const name = t.type === "WALLET_ALLOCATION" ? `${t.destination} Wallet` : t.type === "WALLET_TO_SALARY" ? `Moved to Salary from ${t.source}` : t.description;
        return (
          <tr key={t.id} className="hover:bg-panel-2">
            <td className={td}><Checkbox aria-label={`Select ${t.reference}`} /></td>
            <td className={td + " whitespace-nowrap"}>{t.reference}</td>
            <td className={td}><span className="flex items-center gap-3"><FlowIcon kind={k} /><span className="truncate">{name}</span></span></td>
            <td className={td}><CategoryPill>{t.category}</CategoryPill></td>
            <td className={td + " whitespace-nowrap"}>{fmtDateTimeBar(t.createdAt)}</td>
            <td className={td}><Badge status={t.status} /></td>
            <td className={`${td} tabular whitespace-nowrap ${amountClass(t.type === "WALLET_TO_SALARY" ? "in" : "wallet")}`}>{t.type === "WALLET_TO_SALARY" ? "" : "-"}{naira(t.amountMinor)}</td>
            <td className={td}><Link href={`/transactions?tx=${t.id}`} aria-label={`Open ${t.reference}`} className="grid size-8 place-items-center rounded-full hover:bg-panel"><ChevronRight size={18} /></Link></td>
          </tr>
        );
      })}
    </Table>
  );
}
