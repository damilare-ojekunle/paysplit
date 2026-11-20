import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { env } from "@/server/env";
import { fmtDate } from "@/lib/format";
import { Badge, PageHeader, Panel } from "@/components/ui";
import { Avatar } from "@/components/top-nav";
import { ChangePassword, ChangePhoto } from "@/app/(app)/settings/settings-form";
import { AdminProfileForm } from "./form";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[20px] border border-line-2 bg-panel-2 p-2"><h2 className="px-3 py-3 text-lg">{title}</h2><div className="rounded-2xl border border-line bg-white p-4">{children}</div></section>;
}

export default async function AdminSettings() {
  const a = await requireAdmin();
  const recon = await prisma.auditLog.findFirst({ where: { action: "reconcile.run" }, orderBy: { createdAt: "desc" } });
  const r = recon?.metadata as { ledgerImbalance?: string; inFlightMismatch?: unknown } | undefined;
  const integrations: [string, string, boolean][] = [
    ["Payments", "Flutterwave (test mode)", !!env.FLW_SECRET_KEY],
    ["Payment webhooks", "Flutterwave signed webhook", !!env.FLW_WEBHOOK_HASH],
    ["Identity verification", "Dojah sandbox (BVN/NIN + selfie)", !!env.DOJAH_APP_ID && !!env.DOJAH_SECRET_KEY],
    ["Transactional email", "Brevo", !!env.BREVO_API_KEY && !!env.EMAIL_FROM],
    ["Scheduler", "Daily reconciliation cron", !!env.CRON_SECRET],
  ];
  return (
    <>
      <PageHeader title="Settings" crumbs={[{ href: "/admin", label: "Dashboard" }, { label: "Settings" }]} />
      <Panel className="grid gap-4 sm:-mx-4 lg:grid-cols-[300px_1fr]">
        <section className="h-fit rounded-[20px] border border-line-2 bg-panel-2 p-2">
          <div className="kpi-card flex items-center gap-4 rounded-2xl p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {a.avatarUrl ? <img src={a.avatarUrl} alt="" className="size-[60px] rounded-full object-cover" /> : <Avatar name={`${a.firstName} ${a.lastName}`} size={60} />}
            <div><p className="text-[22px] leading-tight">{a.firstName} {a.lastName}</p><p className="mt-1 text-[13px] text-muted">Administrator</p></div>
          </div>
          <dl className="space-y-3 px-3 py-4 text-[13px]">
            <div className="flex justify-between gap-3"><dt className="text-muted">Email:</dt><dd className="truncate text-sm">{a.email}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Admin since:</dt><dd className="text-sm">{fmtDate(a.createdAt)}</dd></div>
          </dl>
          <div className="px-1 pb-1"><ChangePhoto /></div>
        </section>
        <div className="space-y-4">
          <Section title="Personal details"><AdminProfileForm initial={{ firstName: a.firstName, lastName: a.lastName, phone: a.phone ?? "" }} /></Section>
          <Section title="Integrations">
            <ul className="divide-y divide-line">{integrations.map(([k, v, ok]) => <li key={k} className="flex items-center justify-between gap-3 py-3"><span><span className="block text-[15px]">{k}</span><span className="text-[13px] text-muted">{v}</span></span><Badge status={ok ? "ACTIVE" : "FAILED"} label={ok ? "Connected" : "Not configured"} /></li>)}</ul>
          </Section>
          <Section title="Reconciliation">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[15px]">Last run</p><p className="mt-1 text-[13px] text-muted">{recon ? `${recon.createdAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })} · ledger sum ${r?.ledgerImbalance ?? "?"}` : "Not run yet. Runs daily at 06:00 Lagos time."}</p></div>{recon && <Badge status={r?.ledgerImbalance === "0" && !r?.inFlightMismatch ? "SUCCESS" : "FAILED"} label={r?.ledgerImbalance === "0" && !r?.inFlightMismatch ? "Balanced" : "Mismatch"} />}</div>
          </Section>
          <Section title="Security"><ChangePassword changedAt={a.passwordChangedAt?.toISOString() ?? a.createdAt.toISOString()} /></Section>
        </div>
      </Panel>
    </>
  );
}
