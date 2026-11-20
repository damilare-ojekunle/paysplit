import Link from "next/link";
import { Landmark, Plus, Wallet } from "lucide-react";
import clsx from "clsx";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { walletsWithBalances } from "@/server/queries";
import { naira, maskAcct } from "@/lib/format";
import { Badge, Card, Empty, LinkButton, PageHeader } from "@/components/ui";

export default async function DestinationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireVerifiedUser();
  const tab = (await searchParams).tab === "beneficiaries" ? "beneficiaries" : "wallets";
  const [wallets, bens] = await Promise.all([walletsWithBalances(user.id), prisma.beneficiary.findMany({ where: { userId: user.id, archivedAt: null }, include: { rule: true }, orderBy: { createdAt: "asc" } })]);
  return (
    <>
      <PageHeader title="Destinations" crumbs={[{ href: "/dashboard", label: "Dashboard" }, { label: "Destinations" }]} action={
        <div className="flex gap-2"><LinkButton href="/destinations/beneficiaries/new" variant="secondary"><Plus size={16} /> Add beneficiary</LinkButton><LinkButton href="/destinations/wallets/new"><Plus size={16} /> Create wallet</LinkButton></div>
      } />
      <div role="tablist" className="mb-6 inline-flex rounded-xl border border-line bg-white p-1">
        {(["wallets", "beneficiaries"] as const).map((t) => (
          <Link key={t} role="tab" aria-selected={tab === t} href={`/destinations?tab=${t}`} className={clsx("rounded-lg px-4 py-2 text-sm capitalize", tab === t ? "bg-brand-50 font-medium text-brand-600" : "text-muted")}>{t} ({t === "wallets" ? wallets.length : bens.length})</Link>
        ))}
      </div>
      {tab === "wallets" ? (
        wallets.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {wallets.map((w) => {
              const pct = w.targetMinor ? Math.min(100, Number((w.balanceMinor * 100n) / w.targetMinor)) : null;
              return (
                <Link key={w.id} href={`/destinations/wallets/${w.id}`}>
                  <Card className="h-full p-5 hover:border-brand/40">
                    <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand"><Wallet size={18} /></span><div><p className="font-medium">{w.name}</p><p className="text-xs text-muted">{w.category}</p></div></div>
                    <p className="tabular mt-4 text-2xl font-semibold">{naira(w.balanceMinor)}</p>
                    {pct !== null && <div className="mt-3"><div className="h-2 rounded-full bg-canvas"><div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} /></div><p className="mt-1 text-xs text-muted">{pct}% of {naira(w.targetMinor!)} target</p></div>}
                    <p className="mt-3 text-xs">{w.rule ? <>Rule: {w.rule.name} <Badge status={w.rule.status} /></> : <span className="text-muted">No split rule</span>}</p>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : <Card><Empty icon={<Wallet size={32} />} title="No wallets created" body="Wallets hold money for goals like savings, rent or emergencies. Your split rules fill them automatically." action={<LinkButton href="/destinations/wallets/new">Create your first wallet</LinkButton>} /></Card>
      ) : bens.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bens.map((b) => (
            <Link key={b.id} href={`/destinations/beneficiaries/${b.id}`}>
              <Card className="h-full p-5 hover:border-brand/40">
                <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-canvas text-ink"><Landmark size={18} /></span><div><p className="font-medium">{b.name}</p><p className="text-xs text-muted">{b.category}</p></div></div>
                <p className="mt-4 text-sm">{b.bankName} · {maskAcct(b.accountNumber)}</p>
                <p className="text-xs text-muted">{b.accountName}</p>
                <p className="mt-3 text-xs">{b.rule ? <>Rule: {b.rule.name} <Badge status={b.rule.status} /></> : <span className="text-muted">No split rule</span>}</p>
              </Card>
            </Link>
          ))}
        </div>
      ) : <Card><Empty icon={<Landmark size={32} />} title="No beneficiaries saved" body="Save the people and businesses you pay every month, then add a split rule to pay them automatically." action={<LinkButton href="/destinations/beneficiaries/new">Add a beneficiary</LinkButton>} /></Card>}
    </>
  );
}
