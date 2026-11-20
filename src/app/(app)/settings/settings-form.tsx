"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

type Init = { firstName: string; lastName: string; email: string; phone: string; salaryDay: number | null; notifyEmail: boolean };

export function SettingsForm({ initial }: { initial: Init }) {
  const router = useRouter();
  const [v, setV] = useState({ ...initial, phone: initial.phone.replace(/^\+234/, "") });
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <form className="max-w-xl space-y-5" onSubmit={async (e) => { e.preventDefault(); setLoading(true); setMsg(null); try { await api("/api/profile", { method: "PATCH", body: { firstName: v.firstName, lastName: v.lastName, phone: v.phone || undefined, salaryDay: v.salaryDay, notifyEmail: v.notifyEmail } }); setMsg({ tone: "success", text: "Saved." }); router.refresh(); } catch (er) { setMsg({ tone: "danger", text: (er as ApiError).message }); } finally { setLoading(false); } }}>
      <h2 className="text-lg font-medium">Profile</h2>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <Field id="fn" label="First name"><Input id="fn" value={v.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} /></Field>
        <Field id="ln" label="Last name"><Input id="ln" value={v.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} /></Field>
      </div>
      <Field id="em" label="Email" hint="Contact support to change your email."><Input id="em" value={v.email} disabled aria-describedby="em-hint" /></Field>
      <Field id="ph" label="Phone number"><div className="flex"><span className="grid h-12 place-items-center rounded-l-xl border border-r-0 border-line bg-canvas px-3 text-sm">+234</span><Input id="ph" className="rounded-l-none" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></div></Field>
      <h2 className="pt-4 text-lg font-medium">Salary</h2>
      <Field id="sd" label="Expected salary day" hint="An estimate used for reminders and your dashboard. Splits run only when salary actually arrives. If a month is shorter, we use its last day.">
        <Select id="sd" value={v.salaryDay ?? ""} onChange={(e) => setV({ ...v, salaryDay: e.target.value ? Number(e.target.value) : null })} aria-describedby="sd-hint">
          <option value="">Not set</option>{Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </Select>
      </Field>
      <h2 className="pt-4 text-lg font-medium">Notifications</h2>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4 accent-[var(--color-brand)]" checked={v.notifyEmail} onChange={(e) => setV({ ...v, notifyEmail: e.target.checked })} /><span>Email me about salary received, split results, transfer receipts and failures.<span className="block text-xs text-muted">Security and verification emails are always sent.</span></span></label>
      <Button type="submit" loading={loading}>Save changes</Button>
    </form>
  );
}
