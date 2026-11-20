import Link from "next/link";
import type { LedgerTxnType } from "@prisma/client";
import { Download } from "lucide-react";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { listTransactions } from "@/server/queries";
import { Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { TxTable } from "@/components/tx-table";

type SP = { type?: string; status?: string; q?: string; from?: string; to?: string; walletId?: string; beneficiaryId?: string; page?: string };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireVerifiedUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [res, wallets, bens] = await Promise.all([
    listTransactions(user.id, { type: (sp.type as LedgerTxnType) || undefined, status: sp.status || undefined, q: sp.q || undefined, from: sp.from ? new Date(sp.from + "T00:00:00Z") : undefined, to: sp.to ? new Date(sp.to + "T23:59:59Z") : undefined, walletId: sp.walletId || undefined, beneficiaryId: sp.beneficiaryId || undefined, page, pageSize: 15 }),
    prisma.wallet.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
    prisma.beneficiary.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(res.total / res.pageSize));
  const qs = (p: number) => "?" + new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), page: String(p) }).toString();
  const filtered = Object.entries(sp).some(([k, v]) => v && k !== "page");
  return (
    <>
      <PageHeader title="Transactions" crumbs={[{ href: "/dashboard", label: "Dashboard" }, { label: "Transactions" }]} action={
        <form action="/api/statements" className="flex flex-wrap items-end gap-2" aria-label="Download statement">
          <label className="text-xs text-muted">From<Input type="date" name="from" className="h-10 w-40" defaultValue={sp.from} /></label>
          <label className="text-xs text-muted">To<Input type="date" name="to" className="h-10 w-40" defaultValue={sp.to} /></label>
          <Select name="format" className="h-10 w-24" aria-label="Format"><option value="pdf">PDF</option><option value="csv">CSV</option></Select>
          <Button type="submit" variant="secondary" size="sm" className="h-10"><Download size={15} /> Statement</Button>
        </form>
      } />
      <Card>
        <form className="grid gap-3 border-b border-line p-4 sm:grid-cols-3 lg:grid-cols-7" role="search">
          <Input name="q" placeholder="Search description or reference" defaultValue={sp.q} className="h-10 lg:col-span-2" aria-label="Search" />
          <Select name="type" defaultValue={sp.type ?? ""} className="h-10" aria-label="Type"><option value="">All types</option><option value="SALARY_IN">Salary received</option><option value="WALLET_ALLOCATION">Wallet allocation</option><option value="TRANSFER_OUT">Beneficiary transfer</option><option value="WALLET_TO_SALARY">Wallet → salary</option><option value="TRANSFER_REVERSAL">Reversal</option></Select>
          <Select name="status" defaultValue={sp.status ?? ""} className="h-10" aria-label="Status"><option value="">All statuses</option>{["SUCCESS", "PENDING", "RETRYING", "FAILED", "REVERSED"].map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}</Select>
          <Select name="walletId" defaultValue={sp.walletId ?? ""} className="h-10" aria-label="Wallet"><option value="">Any wallet</option>{wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select>
          <Select name="beneficiaryId" defaultValue={sp.beneficiaryId ?? ""} className="h-10" aria-label="Beneficiary"><option value="">Any beneficiary</option>{bens.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
          <div className="flex gap-2"><Button type="submit" size="sm" className="h-10 flex-1">Filter</Button>{filtered && <Link href="/transactions" className="grid h-10 place-items-center px-2 text-sm text-brand">Clear</Link>}</div>
          <input type="hidden" name="from" value={sp.from ?? ""} /><input type="hidden" name="to" value={sp.to ?? ""} />
        </form>
        <TxTable rows={res.rows} emptyTitle={filtered ? "No matching transactions" : "No transactions available"} emptyBody={filtered ? "Try different filters." : "Salary, splits and transfers will appear here."} />
        <div className="flex items-center justify-between border-t border-line px-6 py-4 text-sm text-muted">
          <span>Showing {res.rows.length} of {res.total}</span>
          <div className="flex gap-2">{page > 1 && <Link href={qs(page - 1)} className="text-brand">Previous</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link href={qs(page + 1)} className="text-brand">Next</Link>}</div>
        </div>
      </Card>
    </>
  );
}
