import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/client-bits";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const user = await requireVerifiedUser();
  const [account, kyc, audit] = await Promise.all([
    prisma.collectionAccount.findUnique({ where: { userId: user.id } }),
    prisma.kycVerification.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.auditLog.findMany({ where: { actorId: user.id }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  return (
    <>
      <PageHeader title="Profile & settings" crumbs={[{ href: "/dashboard", label: "Dashboard" }, { label: "Settings" }]} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="p-6 sm:p-8"><SettingsForm initial={{ firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone ?? "", salaryDay: user.salaryDay, notifyEmail: user.notifyEmail }} /></Card>
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-medium">Verification</h2>
            <p className="mt-2 flex items-center gap-2 text-sm"><Badge status={user.kycStatus} /> {kyc ? `${kyc.idType} ${kyc.idNumberMasked}` : ""}</p>
            {user.kycStatus !== "APPROVED" && <LinkButton href="/onboarding" size="sm" className="mt-3">Continue verification</LinkButton>}
          </Card>
          <Card className="p-6">
            <h2 className="font-medium">Salary account</h2>
            {account?.status === "ACTIVE" ? <div className="mt-2 space-y-1 text-sm"><p className="tabular text-lg font-semibold">{account.accountNumber}</p><p>{account.bankName} · {account.accountName}</p><CopyButton text={`${account.accountNumber} — ${account.bankName} — ${account.accountName}`} label="Copy details" /></div> : <p className="mt-2 text-sm text-muted">Available after verification.</p>}
          </Card>
          <Card className="p-6">
            <h2 className="font-medium">Security & privacy</h2>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <LinkButton href="/forgot-password" variant="secondary" size="sm">Change password</LinkButton>
              <a href="/api/me/export" className="inline-flex h-9 items-center justify-center rounded-xl border border-line text-sm hover:bg-canvas">Download my data</a>
            </div>
            <h3 className="mt-5 text-sm font-medium">Recent account activity</h3>
            <ul className="mt-2 space-y-1 text-xs text-muted">{audit.map((a) => <li key={a.id}>{a.action.replace(/[._]/g, " ")} · {a.createdAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</li>)}</ul>
          </Card>
        </div>
      </div>
    </>
  );
}
