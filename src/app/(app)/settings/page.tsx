import Link from "next/link";
import { ArrowRight, ChevronRight, Download, ShieldCheck } from "lucide-react";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { walletsWithBalances } from "@/server/queries";
import { naira } from "@/lib/format";
import { Badge, LinkButton, PageHeader, Panel } from "@/components/ui";
import { CopyButton } from "@/components/client-bits";
import { Avatar } from "@/components/top-nav";
import { WalletIcon, walletTone } from "@/components/wallet-icon";
import { ChangePassword, ChangePhoto, SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const user = await requireVerifiedUser();
  const [account, kyc, wallets, audit] = await Promise.all([
    prisma.collectionAccount.findUnique({ where: { userId: user.id } }),
    prisma.kycVerification.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    walletsWithBalances(user.id),
    prisma.auditLog.findMany({ where: { actorId: user.id }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);
  const verified = user.kycStatus === "APPROVED";
  const accountId = `USER${user.id.slice(-7).toUpperCase()}`;
  const name = `${user.firstName} ${user.lastName}`;

  return (
    <>
      <PageHeader title="Profile & Setting" crumbs={[{ href: "/dashboard", label: "Dashboard" }, { label: "Profile & Setting" }]} />
      <Panel className="sm:-mx-4">
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          {/* ------------------------------------------ left column */}
          <div className="space-y-4">
            <section className="rounded-[20px] border border-line-2 bg-panel-2 p-2">
              <div className="kpi-card rounded-2xl p-4">
                <div className="flex items-center gap-4">
                  {user.avatarUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={user.avatarUrl} alt="" className="size-[60px] rounded-full object-cover ring-2 ring-white" />
                    : <Avatar name={name} size={60} />}
                  <div><p className="text-[22px] leading-tight">{name}</p><p className="mt-1 text-[13px] text-muted">{verified ? "Tier 2 · Verified" : "Tier 1 · Unverified"}</p></div>
                </div>
              </div>
              <dl className="space-y-3 px-3 py-4 text-[13px]">
                <div className="flex items-center justify-between"><dt className="text-muted">Account ID:</dt><dd className="flex items-center gap-2 text-sm">{accountId}<CopyButton text={accountId} label="" /></dd></div>
                <div className="flex items-center justify-between"><dt className="text-muted">Member since:</dt><dd className="text-sm">{user.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "Africa/Lagos" })}</dd></div>
              </dl>
              <div className="px-1 pb-1"><ChangePhoto /></div>
            </section>

            <section className="rounded-[20px] border border-line-2 bg-panel-2 p-2">
              <h2 className="px-3 py-3 text-lg">Account Details</h2>
              <div className="rounded-2xl border border-line bg-white p-4">
                {account?.status === "ACTIVE" ? (
                  <dl className="space-y-3 text-[13px]">
                    <div className="relative"><dt className="text-muted">Account Number:</dt><dd className="tabular mt-1 text-[32px] leading-tight tracking-wide">{account.accountNumber}</dd><span className="absolute right-0 top-0"><CopyButton text={`${account.accountNumber} — ${account.bankName} — ${account.accountName}`} label="" /></span></div>
                    <div><dt className="text-muted">Account Name:</dt><dd className="text-sm">{account.accountName}</dd></div>
                    <div><dt className="text-muted">Bank Name:</dt><dd className="text-sm">{account.bankName}</dd></div>
                  </dl>
                ) : <p className="text-sm text-muted">Your dedicated salary account is created once your identity is verified. <Link href="/onboarding" className="text-brand underline">Verify now</Link></p>}
              </div>
            </section>

            <section className="rounded-[20px] border border-line-2 bg-panel-2 p-2">
              <Link href="/destinations" className="flex items-center justify-between px-3 py-3 hover:text-brand"><h2 className="text-lg">Wallets</h2><ChevronRight size={18} /></Link>
              {wallets.length ? (
                <ul className="space-y-1">
                  {wallets.slice(0, 3).map((w, i) => (
                    <li key={w.id}><Link href={`/destinations/wallets/${w.id}`} className={`flex items-center gap-3 rounded-2xl bg-gradient-to-b ${walletTone(i, w.color).soft} p-3 hover:brightness-[0.98]`}>
                      <WalletIcon category={w.category} index={i} color={w.color} size={34} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm">{w.name}</span><span className="text-xs text-muted">{w.category}</span></span>
                      <span className="tabular text-[15px]">{naira(w.balanceMinor)}</span><ChevronRight size={16} />
                    </Link></li>
                  ))}
                </ul>
              ) : <p className="rounded-2xl bg-white p-4 text-sm text-muted">No wallets yet. <Link href="/destinations/wallets/new" className="text-brand underline">Create one</Link></p>}
            </section>

            <section className="rounded-[20px] border border-line-2 bg-panel-2 p-2">
              <h2 className="px-3 py-3 text-lg">Here to help</h2>
              <div className="rounded-2xl border border-line bg-white p-4 text-[13px] text-muted">
                <p>Questions about your account? Our support team is available around the clock.</p>
                <a href="mailto:support@paysplit.test" className="mt-3 inline-flex items-center gap-1 text-sm text-brand hover:underline">Contact support <ArrowRight size={14} /></a>
              </div>
            </section>
          </div>

          {/* ------------------------------------------ right column */}
          <div className="space-y-4">
            <SettingsForm initial={{ firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone ?? "", salaryDay: user.salaryDay, employer: user.employer ?? "", monthlySalary: user.monthlySalaryMinor ? String(Number(user.monthlySalaryMinor) / 100) : "", notifyEmail: user.notifyEmail, notifyPrefs: (user.notifyPrefs ?? {}) as { email?: Record<string, boolean> }, passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null }} />

            <section className="rounded-[20px] border border-line-2 bg-panel-2 p-2">
              <h2 className="px-3 py-3 text-lg">Security</h2>
              <div className="divide-y divide-line rounded-2xl border border-line bg-white px-4">
                <div className="py-4"><ChangePassword changedAt={user.passwordChangedAt?.toISOString() ?? user.createdAt.toISOString()} /></div>
                <div className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div><p className="flex items-center gap-2 text-[15px]"><ShieldCheck size={17} className={verified ? "text-success" : "text-muted"} /> Identity verification <Badge status={user.kycStatus} /></p><p className="mt-1 text-[13px] text-muted">{kyc ? `${kyc.idType} ${kyc.idNumberMasked} · ${kyc.provider}` : "Verify with BVN or NIN and a selfie to unlock transfers."}</p></div>
                  {!verified && <LinkButton href="/onboarding" variant="outline" size="sm" className="h-10 px-4">Continue verification</LinkButton>}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div><p className="text-[15px]">Your data</p><p className="mt-1 text-[13px] text-muted">Download everything PaySplit holds about you as JSON.</p></div>
                  <a href="/api/me/export" className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line px-4 text-sm hover:bg-panel-2"><Download size={16} /> Download my data</a>
                </div>
                <div className="py-4">
                  <p className="text-[15px]">Recent account activity</p>
                  <ul className="mt-2 space-y-1 text-[13px] text-muted">{audit.map((a) => <li key={a.id} className="flex justify-between gap-4"><span className="capitalize">{a.action.replace(/[._]/g, " ")}</span><span>{a.createdAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })}</span></li>)}</ul>
                </div>
              </div>
            </section>
          </div>
        </div>
      </Panel>
    </>
  );
}
