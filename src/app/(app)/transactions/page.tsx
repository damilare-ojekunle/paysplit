import Link from "next/link";
import type { LedgerTxnType } from "@prisma/client";
import { ChevronRight, ReceiptText } from "lucide-react";
import { requireVerifiedUser } from "@/server/auth";
import { getTransaction, listTransactions } from "@/server/queries";
import { naira, fmtDateTimeBar, flowKind } from "@/lib/format";
import { amountClass, Badge, CategoryPill, Checkbox, Empty, FlowIcon, PageHeader, Pagination, Panel, SearchBox, Segmented, Table, TablePanel, td, th } from "@/components/ui";
import { ExportButton } from "@/components/dashboard-bits";
import { RouteModal } from "@/components/client-bits";
import { ReceiptBody, ReceiptDownload } from "@/components/receipt";

type SP = { tab?: string; q?: string; page?: string; tx?: string; walletId?: string; beneficiaryId?: string };
const TABS: Record<string, LedgerTxnType | undefined> = { all: undefined, wallet: "WALLET_ALLOCATION", beneficiary: "TRANSFER_OUT" };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireVerifiedUser();
  const sp = await searchParams;
  const tab = sp.tab && sp.tab in TABS ? sp.tab : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const [res, open] = await Promise.all([
    listTransactions(user.id, { type: TABS[tab], q: sp.q || undefined, walletId: sp.walletId || undefined, beneficiaryId: sp.beneficiaryId || undefined, page, pageSize: 10 }),
    sp.tx ? getTransaction(user.id, sp.tx) : Promise.resolve(null),
  ]);
  const pages = Math.max(1, Math.ceil(res.total / res.pageSize));
  const keep = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ tab: tab !== "all" ? tab : undefined, q: sp.q, walletId: sp.walletId, beneficiaryId: sp.beneficiaryId, page: page > 1 ? String(page) : undefined, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return `/transactions${s ? `?${s}` : ""}`;
  };
  const filtered = !!(sp.q || tab !== "all" || sp.walletId || sp.beneficiaryId);

  return (
    <>
      <PageHeader title="Transactions" crumbs={[{ href: "/dashboard", label: "Dashboard" }, { label: "Transactions" }]} action={<ExportButton primary label="Export Statement CSV" />} />
      <Panel className="sm:-mx-4">
        <TablePanel
          title="Transaction & Splits History"
          tools={<><SearchBox defaultValue={sp.q} hidden={{ tab: tab !== "all" ? tab : undefined }} /><Segmented label="Transaction type" active={tab} items={[{ key: "all", label: "All", href: keep({ tab: undefined, page: undefined }) }, { key: "wallet", label: "Wallet", href: keep({ tab: "wallet", page: undefined }) }, { key: "beneficiary", label: "Beneficiary", href: keep({ tab: "beneficiary", page: undefined }) }]} /></>}
          footer={<><span>Showing {res.rows.length} of {res.total.toLocaleString()} activity entries</span><Pagination page={page} pages={pages} href={(p) => keep({ page: p > 1 ? String(p) : undefined })} /></>}
        >
          {res.rows.length ? (
            <Table head={<><th className={th + " w-10"}><Checkbox aria-label="Select all" /></th><th className={th}>Reference</th><th className={th}>Destination</th><th className={th}>Category</th><th className={th}>Date</th><th className={th}>Status</th><th className={th}>Amount</th><th className={th + " w-10"}><span className="sr-only">Receipt</span></th></>}>
              {res.rows.map((t) => {
                const k = flowKind(t);
                const name = t.type === "WALLET_ALLOCATION" ? `${t.destination} Wallet` : t.type === "TRANSFER_OUT" ? `Transfer to ${t.destination.split(" · ")[0]}` : t.type === "SALARY_IN" ? `Salary from ${user.employer || t.source}` : t.description;
                return (
                  <tr key={t.id} className="hover:bg-panel-2">
                    <td className={td}><Checkbox aria-label={`Select ${t.reference}`} /></td>
                    <td className={td + " whitespace-nowrap"}><Link href={keep({ tx: t.id })} scroll={false} className="hover:text-brand">{t.reference.length > 22 ? t.reference.slice(0, 22) + "…" : t.reference}</Link></td>
                    <td className={td}><span className="flex items-center gap-3"><FlowIcon kind={k} /><span className="truncate">{name}</span></span></td>
                    <td className={td}><CategoryPill>{t.category}</CategoryPill></td>
                    <td className={td + " whitespace-nowrap"}>{fmtDateTimeBar(t.createdAt)}</td>
                    <td className={td}><Badge status={t.status} /></td>
                    <td className={`${td} tabular whitespace-nowrap ${amountClass(k)}`}>{k === "in" ? "" : "-"}{naira(t.amountMinor)}</td>
                    <td className={td}><Link href={keep({ tx: t.id })} scroll={false} aria-label={`Open receipt for ${t.reference}`} className="grid size-8 place-items-center rounded-full hover:bg-panel"><ChevronRight size={18} /></Link></td>
                  </tr>
                );
              })}
            </Table>
          ) : <Empty title={filtered ? "No matching transactions" : "No transactions available"} body={filtered ? "Try a different search or filter." : "Salary, splits and transfers will appear here."} />}
        </TablePanel>
      </Panel>

      {open && (
        <RouteModal closeHref={keep({ tx: undefined })} title="Transaction Receipt" description={open.label} icon={<ReceiptText size={20} />} footer={<><Link href={`/transactions/${open.id}`} className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm hover:bg-panel-2">Open full page</Link><ReceiptDownload t={open} /></>}>
          <ReceiptBody t={open} />
        </RouteModal>
      )}
    </>
  );
}
