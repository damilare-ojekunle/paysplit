import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Download } from "lucide-react";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { listTransactions } from "@/server/queries";
import { destinationOptions, ruleForForm } from "@/server/rule-page-data";
import { naira, fmtDate, fmtDateTimeBar, flowKind } from "@/lib/format";
import { formatBps } from "@/core/money";
import { amountClass, Badge, CategoryPill, Checkbox, Empty, FlowIcon, PageHeader, Pagination, Panel, Table, TablePanel, td, th } from "@/components/ui";
import { BeneficiaryModalButton, DeleteButton } from "@/components/destination-forms";
import { CopyButton } from "@/components/client-bits";
import { RuleModalButton } from "@/components/rule-form";

export default async function BeneficiaryDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const user = await requireVerifiedUser();
  const b = await prisma.beneficiary.findFirst({ where: { id: (await params).id, userId: user.id, archivedAt: null }, include: { rule: true } });
  if (!b) notFound();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [tx, sent, dests] = await Promise.all([
    listTransactions(user.id, { beneficiaryId: b.id, type: "TRANSFER_OUT", page, pageSize: 10 }),
    prisma.transfer.aggregate({ where: { beneficiaryId: b.id, userId: user.id, status: { in: ["SUCCESS", "PENDING", "RETRYING"] } }, _sum: { amountMinor: true } }),
    destinationOptions(user.id),
  ]);
  const kycOk = user.kycStatus === "APPROVED";
  const pages = Math.max(1, Math.ceil(tx.total / tx.pageSize));
  const ruleValue = b.rule ? (b.rule.method === "FIXED" ? naira(b.rule.amountMinor!) : formatBps(b.rule.percentBps!)) : null;

  return (
    <>
      <PageHeader title="Destinations" crumbs={[{ href: "/dashboard", label: "Dashboard" }, { href: "/destinations?tab=beneficiaries", label: "Destinations" }, { label: b.name }]} />
      <Panel className="space-y-4 sm:-mx-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-1">
          <h1 className="flex items-center gap-3 text-lg"><Link href="/destinations?tab=beneficiaries" aria-label="Back to beneficiaries" className="grid size-8 place-items-center rounded-lg hover:bg-panel"><ArrowLeft size={20} /></Link>{b.name}</h1>
          <div className="flex items-center gap-4">
            <BeneficiaryModalButton trigger="edit" existing={{ id: b.id, name: b.name, category: b.category, bankCode: b.bankCode, accountNumber: b.accountNumber, narration: b.narration }} />
            <DeleteButton icon url={`/api/beneficiaries/${b.id}`} label="Remove beneficiary" confirmText="The beneficiary and its split rule will be removed. Past transfers stay in your history." after="/destinations?tab=beneficiaries" />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <section className="space-y-4 rounded-[20px] border border-line-2 bg-panel-2 p-2">
            <div className="kpi-card rounded-2xl p-5">
              <p className="flex items-center justify-between text-[15px]">Total Allocated<ChevronRight size={18} /></p>
              <p className="tabular mt-9 text-[28px] font-medium leading-tight">{naira(sent._sum.amountMinor ?? 0n)}</p>
              <p className="mt-1.5 text-[13px] text-muted">Cumulative salary split</p>
            </div>
            <h2 className="px-3 text-lg">Linked Rule</h2>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[13px] text-muted">Allocation Method &amp; Value</p>
              {b.rule ? (
                <>
                  <p className="mt-1.5 text-lg font-medium">{ruleValue} <Badge status={b.rule.status} className="ml-1 align-middle" /></p>
                  <div className="mt-3 [&_button]:w-full"><RuleModalButton trigger="reconfigure" destinations={dests} kycOk={kycOk} existing={ruleForForm(b.rule)} /></div>
                  <p className="mt-3 text-[13px] text-muted">Last Modified: {fmtDate(b.rule.updatedAt)}</p>
                </>
              ) : (
                <>
                  <p className="mt-1.5 text-sm text-muted">No rule yet. This beneficiary won't be paid automatically.</p>
                  <div className="mt-3 [&_button]:w-full"><RuleModalButton trigger="create-for" destinations={dests} kycOk={kycOk} preset={{ type: "BENEFICIARY", dest: b.id }} /></div>
                </>
              )}
            </div>
            <dl className="space-y-3.5 rounded-2xl border border-line bg-white p-4 text-[13px]">
              <div className="relative"><dt className="text-muted">Account Number:</dt><dd className="tabular mt-1 text-[32px] leading-tight tracking-wide">{b.accountNumber}</dd><span className="absolute right-0 top-0"><CopyButton text={`${b.accountNumber} — ${b.bankName} — ${b.accountName ?? b.name}`} label="Copy" /></span></div>
              <div><dt className="text-muted">Account Name:</dt><dd className="mt-0.5 text-sm">{b.accountName ?? "—"}</dd></div>
              <div><dt className="text-muted">Bank Name:</dt><dd className="mt-0.5 text-sm">{b.bankName}</dd></div>
              <div><dt className="text-muted">Category</dt><dd className="mt-0.5 text-sm">{b.category}</dd></div>
              <div><dt className="text-muted">Narration:</dt><dd className="mt-0.5 text-sm">{b.narration || "—"}</dd></div>
            </dl>
          </section>

          <TablePanel title="Transfer History" footer={tx.total > tx.pageSize ? <><span>Showing {tx.rows.length} of {tx.total}</span><Pagination page={page} pages={pages} href={(p) => `/destinations/beneficiaries/${b.id}${p > 1 ? `?page=${p}` : ""}`} /></> : undefined}>
            {tx.rows.length ? (
              <Table head={<><th className={th + " w-10"}><Checkbox aria-label="Select all" /></th><th className={th}>Reference</th><th className={th}>Destination</th><th className={th}>Category</th><th className={th}>Date</th><th className={th}>Status</th><th className={th}>Amount</th><th className={th + " w-10"}><span className="sr-only">Receipt</span></th></>}>
                {tx.rows.map((t) => {
                  const k = flowKind(t);
                  return (
                    <tr key={t.id} className="hover:bg-panel-2">
                      <td className={td}><Checkbox aria-label={`Select ${t.reference}`} /></td>
                      <td className={td + " max-w-[150px] truncate"} title={t.reference}>{t.reference}</td>
                      <td className={td + " max-w-[170px]"}><span className="flex items-center gap-2"><FlowIcon kind={k} /><span className="truncate">Transfer to {b.name}</span></span></td>
                      <td className={td}><CategoryPill>{t.category}</CategoryPill></td>
                      <td className={td + " whitespace-nowrap"}>{fmtDateTimeBar(t.createdAt).split(" |")[0]}</td>
                      <td className={td}><Badge status={t.status} /></td>
                      <td className={`${td} tabular whitespace-nowrap ${amountClass(k)}`}>-{naira(t.amountMinor)}</td>
                      <td className={td}>{t.status === "SUCCESS" ? <a href={`/api/transactions/${t.id}/receipt`} aria-label={`Download receipt ${t.reference}`} title="Download receipt" className="grid size-8 place-items-center rounded-full hover:bg-panel"><Download size={17} /></a> : <Link href={`/transactions?tx=${t.id}`} aria-label={`Open ${t.reference}`} className="grid size-8 place-items-center rounded-full hover:bg-panel"><ChevronRight size={17} /></Link>}</td>
                    </tr>
                  );
                })}
              </Table>
            ) : <Empty title="No transfers yet" body="Transfers your split rules send to this beneficiary appear here." />}
          </TablePanel>
        </div>
      </Panel>
    </>
  );
}
