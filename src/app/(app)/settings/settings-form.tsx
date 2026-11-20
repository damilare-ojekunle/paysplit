"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { KeyRound } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { Modal } from "@/components/client-bits";

type Prefs = { email?: Record<string, boolean>; inApp?: Record<string, boolean> };
type Init = { firstName: string; lastName: string; email: string; phone: string; salaryDay: number | null; employer: string; monthlySalary: string; notifyEmail: boolean; notifyPrefs: Prefs; passwordChangedAt: string | null };
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[20px] border border-line-2 bg-panel-2 p-2">
      <h2 className="px-3 py-3 text-lg">{title}</h2>
      <div className="rounded-2xl border border-line bg-white p-4">{children}</div>
    </section>
  );
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={clsx("flex items-center justify-between gap-4 py-2.5 text-[15px]", disabled && "opacity-60")}>
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={clsx("relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors", checked ? "bg-brand" : "bg-line")}>
        <span className={clsx("absolute top-[2px] size-[18px] rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-[2px]")} />
      </button>
    </label>
  );
}

const CATS: [string, string][] = [["salary", "Salary received in your salary account"], ["split", "Split results and upcoming-salary reminders"], ["transfer", "Transfer receipts, delays and failures"]];

export function SettingsForm({ initial }: { initial: Init }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [tab, setTab] = useState<"inApp" | "email" | "sms">("inApp");
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const pref = (ch: "email" | "inApp", k: string) => (ch === "email" ? v.notifyEmail : true) && (v.notifyPrefs[ch]?.[k] ?? true);
  const setPref = (ch: "email" | "inApp", k: string, on: boolean) => setV({ ...v, notifyEmail: ch === "email" && on ? true : v.notifyEmail, notifyPrefs: { ...v.notifyPrefs, [ch]: { ...(v.notifyPrefs[ch] ?? {}), [k]: on } } });

  async function save(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMsg(null);
    try {
      await api("/api/profile", { method: "PATCH", body: { firstName: v.firstName, lastName: v.lastName, phone: v.phone || undefined, salaryDay: v.salaryDay, employer: v.employer || null, monthlySalary: v.monthlySalary || null, notifyEmail: v.notifyEmail, notifyPrefs: v.notifyPrefs } });
      setMsg({ tone: "success", text: "Your changes are saved." }); router.refresh();
    } catch (er) { setMsg({ tone: "danger", text: (er as ApiError).message }); } finally { setLoading(false); }
  }

  return (
    <form className="space-y-4" onSubmit={save}>
      <Section title="Personal details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="firstName" label="First name"><Input id="firstName" value={v.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} autoComplete="given-name" required /></Field>
          <Field id="lastName" label="Last name"><Input id="lastName" value={v.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} autoComplete="family-name" required /></Field>
          <Field id="email" label="Email address" hint="Contact support to change your email."><Input id="email" value={v.email} disabled aria-describedby="email-hint" /></Field>
          <Field id="phone" label="Phone Number">
            <div className="flex">
              <span className="grid h-[52px] place-items-center rounded-l-[10px] border border-r-0 border-line bg-panel-2 px-3.5 text-[15px] text-ink">+234</span>
              <Input id="phone" className="rounded-l-none" inputMode="tel" autoComplete="tel-national" value={v.phone.replace(/^\+234/, "")} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="803 456 7890" />
            </div>
          </Field>
        </div>
      </Section>

      <Section title="Salary Income Source">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field id="employer" label="Employer"><Input id="employer" value={v.employer} onChange={(e) => setV({ ...v, employer: e.target.value })} placeholder="Talent Nation" maxLength={80} /></Field></div>
          <Field id="monthlySalary" label="Monthly Salary Amount" hint="Used to preview your allocation. Splits always use the salary that actually arrives.">
            <div className="flex">
              <span className="grid h-[52px] place-items-center rounded-l-[10px] border border-r-0 border-line bg-panel-2 px-3.5 text-[15px]">NGN</span>
              <Input id="monthlySalary" className="rounded-l-none" inputMode="decimal" value={v.monthlySalary} onChange={(e) => setV({ ...v, monthlySalary: e.target.value })} placeholder="₦850,000" aria-describedby="monthlySalary-hint" />
            </div>
          </Field>
          <Field id="salaryDay" label="Expected Payday Day of Month" hint="If a month is shorter, we use its last day.">
            <Select id="salaryDay" value={v.salaryDay ?? ""} onChange={(e) => setV({ ...v, salaryDay: e.target.value ? Number(e.target.value) : null })} aria-describedby="salaryDay-hint">
              <option value="">Not set</option>
              {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{ordinal(i + 1)}</option>)}
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Notifications">
        <div role="tablist" aria-label="Notification channel" className="inline-flex rounded-xl bg-panel-2 p-1">
          {([["inApp", "Push Notifications"], ["sms", "SMS Alerts"], ["email", "Email Notifications"]] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={clsx("rounded-lg px-3 py-1.5 text-sm", tab === k ? "bg-brand-50 text-brand" : "text-muted hover:text-ink")}>{l}</button>
          ))}
        </div>
        <div className="mt-3 divide-y divide-line-2">
          {tab === "sms" ? (
            <p className="py-3 text-sm text-muted">SMS alerts aren&apos;t available yet. Security and verification messages always reach you by email and in the app.</p>
          ) : (
            <>
              {CATS.map(([k, label]) => <Toggle key={k} label={label} checked={pref(tab, k)} onChange={(on) => setPref(tab, k, on)} />)}
              <Toggle label="Security and identity verification alerts (always on)" checked disabled onChange={() => {}} />
            </>
          )}
        </div>
      </Section>

      <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-line bg-white p-3" aria-live="polite">
        {msg && <Alert tone={msg.tone} className="mr-auto py-2">{msg.text}</Alert>}
        <Button type="button" variant="secondary" onClick={() => { setV(initial); setMsg(null); }}>Discard</Button>
        <Button type="submit" loading={loading}>Save changes</Button>
      </div>
    </form>
  );
}

export function ChangePassword({ changedAt }: { changedAt: string | null }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ currentPassword: "", password: "", confirmPassword: "" });
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-[15px]">Password</p><p className="mt-1 text-[13px] text-muted">{changedAt ? `Last updated ${new Date(changedAt).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos" }).replace(/\//g, ".")}` : "Never changed"}</p></div>
      <Button type="button" variant="outline" size="sm" className="h-10 px-4" onClick={() => { setOpen(true); setErr(null); setDone(false); setV({ currentPassword: "", password: "", confirmPassword: "" }); }}>Change password</Button>
      <Modal open={open} onClose={() => setOpen(false)} size="sm" icon={<KeyRound size={18} />} title="Change password" description="Your other devices will be signed out."
        footer={done ? <Button onClick={() => setOpen(false)}>Done</Button> : <><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button form="pw-form" type="submit" loading={loading}>Update password</Button></>}>
        {done ? <Alert tone="success">Password updated. Other sessions were signed out.</Alert> : (
          <form id="pw-form" className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setLoading(true); setErr(null); try { await api("/api/auth/change-password", { body: v }); setDone(true); } catch (er) { setErr((er as ApiError).message); } finally { setLoading(false); } }}>
            {err && <Alert tone="danger">{err}</Alert>}
            <Field id="cur" label="Current password"><Input id="cur" type="password" autoComplete="current-password" value={v.currentPassword} onChange={(e) => setV({ ...v, currentPassword: e.target.value })} required /></Field>
            <Field id="new" label="New password" hint="At least 8 characters, with upper and lower case letters and a number."><Input id="new" type="password" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} required aria-describedby="new-hint" /></Field>
            <Field id="conf" label="Confirm new password"><Input id="conf" type="password" autoComplete="new-password" value={v.confirmPassword} onChange={(e) => setV({ ...v, confirmPassword: e.target.value })} required /></Field>
          </form>
        )}
      </Modal>
    </div>
  );
}

/** Upload a profile photo: resized in the browser to 160px JPEG, stored as a small data URL. */
export function ChangePhoto() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function pick(file: File) {
    setErr(null);
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setErr("Choose a PNG, JPEG or WebP image.");
    if (file.size > 8_000_000) return setErr("That image is too large (max 8 MB).");
    setLoading(true);
    try {
      const img = await createImageBitmap(file);
      const s = Math.min(img.width, img.height), c = document.createElement("canvas");
      c.width = c.height = 160;
      c.getContext("2d")!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 160, 160);
      await api("/api/profile", { method: "PATCH", body: { avatarUrl: c.toDataURL("image/jpeg", 0.85) } });
      router.refresh();
    } catch (e) { setErr((e as ApiError).message || "Couldn't read that image."); } finally { setLoading(false); }
  }
  return (
    <div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Profile photo" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
      <Button type="button" variant="outline" size="lg" className="h-12" loading={loading} onClick={() => ref.current?.click()}>Change profile photo</Button>
      {err && <p role="alert" className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}
