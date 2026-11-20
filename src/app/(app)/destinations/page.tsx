import Link from "next/link";
import type { LedgerTxnType } from "@prisma/client";
import { ArrowRight, Eye, Landmark, Wallet } from "lucide-react";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { listTransactions, nextSalaryDate, walletsWithBalances } from "@/server/queries";
import { naira } from "@/lib/format";
import { Badge, CategoryPill, Checkbox, Empty, PageHeader, Pagination, Panel, SearchBox, Segmented, Table, TablePanel, td, th } from "@/components/ui";
import { BeneficiaryModalButton, DeleteButton, WalletModalButton } from "@/components/destination-forms";
import { WalletIcon, walletTone } from "@/components/wallet-icon";
import { GoalBar, WalletTxRows } from "@/components/destination-view";

type SP = { tab?: string; q?: string; f?: string; page?: string; new?: string };
const MONEY: Record<string, LedgerTxnType[]> = { all: ["WALLET_ALLOCATION", "WALLET_TO_SALARY"], in: ["WALLET_ALLOCATION"], out: ["WALLET_TO_SALARY"] };

export default async function DestinationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireVerifiedUser();
  const sp = await searchParams;
  const tab = sp.tab === "beneficiaries" ? "beneficiaries" : "wallets";
  const page = Math.max(1, Number(sp.page) || 1);
  const href = (o: Partial<SP>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ tab: tab === "beneficiaries" ? tab : undefined, q: sp.q, f: sp.f, ...o })) if (v) p.set(k, v);
    const s = p.toString();
    return `/destinations${s ? `?${s}` : ""}`;
  };
  const tabs = <Segmented label="Destination type" active={tab} items={[{ key: "wallets", label: "Wallets", href: "/destinations" }, { key: "beneficiaries", label: "Beneficiary", href: "/destinations?tab=beneficiaries" }]} />;

  if (tab === "beneficiaries") {
    const f = sp.f === "active" || sp.f === "paused" ? sp.f : "all";
    const q = sp.q?.toLowerCase();
    const all = await prisma.beneficiary.findMany({ where: { userId: user.id, archivedAt: null }, include: { rule: true }, orderBy: { createdAt: "asc" } });
    const bens = all
      .filter((b) => f === "all" || (f === "active" ? b.rule?.status === "ACTIVE" : b.rule?.status !== "ACTIVE"))
      .filter((b) => !q || [b.name, b.bankName, b.category].some((x) => x.toLowerCase().includes(q)));
    const next = nextSalaryDate(user.salaryDay, user.timezone);
    const nextLabel = next ? `${next.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })} ${ordinal(next.getUTCDate())}` : "—";
    return (
      <>
        <PageHeader title="Destinations" crumbs={[{ href: "/dashboard", label: "Dashboard" }, { label: "Destinations" }]} />
        <Panel className="space-y-4 sm:-mx-4">
          <div className="flex items-center justify-between px-2 pt-1">{tabs}<BeneficiaryModalButton autoOpen={sp.new === "1"} /></div>
          <TablePanel
            title="All Beneficiary"
            tools={<><SearchBox defaultValue={sp.q} hidden={{ tab, f: f !== "all" ? f : undefined }} /><Segmented label="Rule status" active={f} items={[{ key: "all", label: "All", href: href({ f: undefined }) }, { key: "active", label: "Active", href: href({ f: "active" }) }, { key: "paused", label: "Paused", href: href({ f: "paused" }) }]} /></>}
            footer={<span>Showing {bens.length} of {all.length} beneficiaries</span>}
          >
            {bens.length ? (
              <Table head={<><th className={th + " w-10"}><Checkbox aria-label="Select all" /></th><th className={th}>Recipient / Entity</th><th className={th}>Bank Name</th><th className={th}>Account Number</th><th className={th}>Category</th><th className={th}>Next split</th><th className={th + " w-32 text-right"}>Action</th></>}>
                {bens.map((b) => (
                  <tr key={b.id} className="hover:bg-panel-2">
                    <td className={td}><Checkbox aria-label={`Select ${b.name}`} /></td>
                    <td className={td}><Link href={`/destinations/beneficiaries/${b.id}`} className="hover:text-brand">{b.name}</Link>{b.rule && b.rule.status !== "ACTIVE" && <Badge status={b.rule.status} className="ml-2" />}</td>
                    <td className={td}>{b.bankName}</td>
                    <td className={td + " tabular"}>*****{b.accountNumber.slice(-4)}</td>
                    <td className={td}><CategoryPill>{b.category}</CategoryPill></td>
                    <td className={td + " font-semibold"}>{b.rule?.status === "ACTIVE" ? nextLabel : <span className="font-normal text-muted">No active rule</span>}</td>
                    <td className={td}>
                      <span className="flex items-center justify-end gap-1">
                        <Link href={`/destinations/beneficiaries/${b.id}`} aria-label={`View ${b.name}`} title="View" className="grid size-8 place-items-center rounded-lg hover:bg-panel"><Eye size={18} strokeWidth={1.7} /></Link>
                        <BeneficiaryModalButton trigger="icon" existing={{ id: b.id, name: b.name, category: b.category, bankCode: b.bankCode, accountNumber: b.accountNumber, narration: b.narration }} />
                        <DeleteButton icon url={`/api/beneficiaries/${b.id}`} label="Remove beneficiary" confirmText="The beneficiary and its split rule will be removed. Past transfers stay in your history." after="/destinations?tab=beneficiaries" />
                      </span>
                    </td>
                  </tr>
                ))}
              </Table>
            ) : all.length
              ? <Empty title="No matching beneficiaries" body="Try a different search or filter." />
              : <Empty icon={<Landmark size={32} />} title="No beneficiaries saved" body="Save the people and businesses you pay every month, then add a split rule to pay them automatically." action={<BeneficiaryModalButton trigger="empty" />} />}
          </TablePanel>
        </Panel>
      </>
    );
  }

  const f = sp.f && sp.f in MONEY ? sp.f : "all";
  const [wallets, activity] = await Promise.all([
    walletsWithBalances(user.id),
    listTransactions(user.id, { types: MONEY[f], q: sp.q || undefined, page, pageSize: 10 }),
  ]);
  const pages = Math.max(1, Math.ceil(activity.total / activity.pageSize));
  return (
    <>
      <PageHeader title="Destinations" crumbs={[{ href: "/dashboard", label: "Dashboard" }, { label: "Destinations" }]} />
      <Panel className="space-y-4 sm:-mx-4">
        <div className="flex items-center justify-between px-2 pt-1">{tabs}<WalletModalButton autoOpen={sp.new === "1"} /></div>
        {wallets.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {wallets.map((w, i) => {
              const tone = walletTone(i, w.color);
              const pct = w.targetMinor ? Math.min(100, Number((w.balanceMinor * 100n) / w.targetMinor)) : null;
              return (
                <article key={w.id} className={`flex min-h-[260px] flex-col rounded-[20px] bg-gradient-to-b ${tone.soft} p-5`}>
                  <div className="flex items-start gap-3">
                    <WalletIcon category={w.category} index={i} color={w.color} size={48} />
                    <div className="min-w-0 flex-1"><h2 className="truncate text-[15px] font-medium"><Link href={`/destinations/wallets/${w.id}`} className="hover:text-brand">{w.name}</Link></h2><p className="text-xs text-muted">{w.category}</p></div>
                    <p className="tabular text-[24px]">{naira(w.balanceMinor)}</p>
                  </div>
                  <div className="mt-9">
                    <p className="flex justify-between text-xs"><span className="text-muted">{w.targetMinor ? <>Target: <span className="text-ink">{naira(w.targetMinor)}</span></> : "No target set"}</span>{pct !== null && <b className="font-semibold">{pct}%</b>}</p>
                    <GoalBar pct={pct ?? 0} />
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-6 text-xs">
                    <span className="text-muted">Created: <span className="text-ink">{w.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Africa/Lagos" }).replace(",", "")}</span></span>
                    <Link href={`/destinations/wallets/${w.id}`} className="flex items-center gap-1 font-medium hover:text-brand">View wallet <ArrowRight size={14} /></Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <div className="rounded-[20px] border border-line-2 bg-panel-2"><Empty icon={<Wallet size={32} />} title="No wallets created" body="Wallets hold money for goals like savings, rent or emergencies. Your split rules fill them automatically." action={<WalletModalButton trigger="empty" />} /></div>}

        <TablePanel
          title="All Wallet Activity"
          tools={<><SearchBox defaultValue={sp.q} hidden={{ f: f !== "all" ? f : undefined }} /><Segmented label="Money direction" active={f} items={[{ key: "all", label: "All", href: href({ f: undefined, page: undefined }) }, { key: "in", label: "Money in", href: href({ f: "in", page: undefined }) }, { key: "out", label: "Money out", href: href({ f: "out", page: undefined }) }]} /></>}
          footer={<><span>Showing {activity.rows.length} of {activity.total.toLocaleString()} activity entries</span><Pagination page={page} pages={pages} href={(p) => href({ page: p > 1 ? String(p) : undefined })} /></>}
        >
          {activity.rows.length ? <WalletTxRows rows={activity.rows} /> : <Empty title="No wallet activity yet" body="Money your split rules move into wallets, and anything you move back to salary, appears here." />}
        </TablePanel>
      </Panel>
    </>
  );
}

function ordinal(n: number) {
  return `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
}
