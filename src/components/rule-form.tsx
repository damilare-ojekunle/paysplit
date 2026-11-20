"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Columns2, Play, Plus, RotateCcw, Split, SquarePen, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "./client-bits";
import { Alert, Button, Field, Input, Select } from "./ui";

type Dest = { id: string; name: string; category: string; type: "WALLET" | "BENEFICIARY"; hasRule: boolean; ruleId?: string };
type Existing = { id: string; name: string; destinationType: "WALLET" | "BENEFICIARY"; destinationId: string; method: "FIXED" | "PERCENT"; value: string; priority: number; status: string };

export function RuleForm({ destinations, preset, existing, kycOk, onDone }: { destinations: Dest[]; preset?: { type?: string; dest?: string }; existing?: Existing; kycOk: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    name: existing?.name ?? "",
    destinationType: (existing?.destinationType ?? (preset?.type as Dest["type"]) ?? "WALLET") as Dest["type"],
    destinationId: existing?.destinationId ?? preset?.dest ?? "",
    method: existing?.method ?? ("FIXED" as "FIXED" | "PERCENT"),
    value: existing?.value ?? "",
    priority: existing?.priority ?? 1,
  });
  const [review, setReview] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<null | "draft" | "active">(null);
  const options = destinations.filter((d) => d.type === v.destinationType);
  const chosen = destinations.find((d) => d.id === v.destinationId);
  const conflict = !existing && chosen?.hasRule;

  async function submit(activate: boolean) {
    setLoading(activate ? "active" : "draft"); setErr(null);
    try {
      if (existing) await api(`/api/rules/${existing.id}`, { method: "PATCH", body: { name: v.name, method: v.method, value: v.value, priority: v.priority, status: activate ? "ACTIVE" : existing.status === "ACTIVE" ? "PAUSED" : existing.status } });
      else await api("/api/rules", { body: { ...v, activate } });
      if (onDone) { onDone(); router.refresh(); } else { router.push("/rules"); router.refresh(); }
    } catch (e) { setErr((e as ApiError).message); setReview(false); } finally { setLoading(null); }
  }

  if (review && chosen) {
    return (
      <div className="space-y-5">
        <h2 className="text-lg font-medium">Review rule</h2>
        <dl className="space-y-3 rounded-2xl bg-panel-2 p-5 text-sm">
          {[["Rule name", v.name], ["Destination", `${chosen.name} (${v.destinationType === "WALLET" ? "Wallet" : "Beneficiary"})`], ["Category", chosen.category], ["Method", v.method === "FIXED" ? "Fixed amount" : "Percentage of salary"], ["Value", v.method === "FIXED" ? `₦${v.value}` : `${v.value}%`], ["Priority", `${v.priority} (1 runs first)`]].map(([k, x]) => <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{x}</dd></div>)}
        </dl>
        <p className="text-sm text-muted">{v.method === "PERCENT" ? "Percentages are calculated from your full confirmed salary, not what's left after earlier rules." : "Fixed amounts are only paid in full — if there isn't enough left when this rule's turn comes, it's skipped."}</p>
        {!kycOk && <Alert tone="warn">You can save this as a draft. Activation unlocks after identity verification. <Link href="/onboarding" className="underline">Verify now</Link></Alert>}
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setReview(false)}>Edit</Button>
          <Button variant="secondary" loading={loading === "draft"} disabled={!!loading} onClick={() => submit(false)}>Save as draft</Button>
          <Button loading={loading === "active"} disabled={!!loading || !kycOk} onClick={() => submit(true)}>Confirm & activate</Button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setErr(null); if (!chosen) return setErr("Choose a destination"); setReview(true); }}>
      {err && <Alert tone="danger">{err}</Alert>}
      <Field id="name" label="Rule name"><Input id="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Mother's monthly allowance" required maxLength={80} /></Field>
      {!existing && (
        <>
          <fieldset className="grid grid-cols-2 gap-3"><legend className="mb-2 text-sm">Destination type</legend>
            {(["WALLET", "BENEFICIARY"] as const).map((t) => <label key={t} className={`cursor-pointer rounded-xl border px-4 py-3.5 text-sm ${v.destinationType === t ? "border-brand bg-brand-50 text-ink" : "border-line text-muted"}`}><input type="radio" className="sr-only" checked={v.destinationType === t} onChange={() => setV({ ...v, destinationType: t, destinationId: "" })} />{t === "WALLET" ? "Wallet" : "Beneficiary"}</label>)}
          </fieldset>
          <Field id="dest" label="Destination" error={conflict ? "This destination already has a rule" : undefined}>
            <Select id="dest" value={v.destinationId} onChange={(e) => setV({ ...v, destinationId: e.target.value })} required aria-invalid={conflict}>
              <option value="">{options.length ? "Select destination" : `No ${v.destinationType === "WALLET" ? "wallets" : "beneficiaries"} yet`}</option>
              {options.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.category}{d.hasRule ? " (has a rule)" : ""}</option>)}
            </Select>
          </Field>
          {conflict && chosen?.ruleId && <Alert tone="info">Each destination can have one rule. <Link className="underline" href={`/rules/${chosen.ruleId}/edit`}>Reconfigure the existing rule</Link></Alert>}
          {!options.length && <Link href={v.destinationType === "WALLET" ? "/destinations/wallets/new" : "/destinations/beneficiaries/new"} className="text-sm text-brand hover:underline">+ Create a {v.destinationType === "WALLET" ? "wallet" : "beneficiary"} first</Link>}
        </>
      )}
      <fieldset className="grid grid-cols-2 gap-3"><legend className="mb-2 text-sm">Allocation method</legend>
        {(["FIXED", "PERCENT"] as const).map((m) => <label key={m} className={`cursor-pointer rounded-xl border px-4 py-3.5 text-sm ${v.method === m ? "border-brand bg-brand-50 text-ink" : "border-line text-muted"}`}><input type="radio" className="sr-only" checked={v.method === m} onChange={() => setV({ ...v, method: m, value: "" })} />{m === "FIXED" ? "Fixed amount" : "Percentage"}</label>)}
      </fieldset>
      <Field id="value" label={v.method === "FIXED" ? "Amount" : "Percentage of salary"} hint={v.method === "FIXED" ? "e.g. 50,000" : "Up to 2 decimal places, e.g. 12.5"}>
        <div className="relative">
          {v.method === "FIXED" && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">₦</span>}
          <Input id="value" inputMode="decimal" className={v.method === "FIXED" ? "pl-8" : "pr-8"} value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} required aria-describedby="value-hint" />
          {v.method === "PERCENT" && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted">%</span>}
        </div>
      </Field>
      <Field id="priority" label="Priority" hint="1 runs first, 10 runs last. Rules with the same priority run oldest first.">
        <Select id="priority" value={v.priority} onChange={(e) => setV({ ...v, priority: Number(e.target.value) })} aria-describedby="priority-hint">{Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</Select>
      </Field>
      <Button type="submit" size="lg" disabled={!!conflict}>Review rule</Button>
    </form>
  );
}

export function RuleActions({ id, status, kycOk, edit }: { id: string; status: string; kycOk: boolean; edit: React.ReactNode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  async function act(fn: () => Promise<unknown>) { setBusy(true); setErr(null); try { await fn(); router.refresh(); setConfirmDel(false); } catch (e) { setErr((e as ApiError).message); } finally { setBusy(false); } }
  const icon = "grid size-8 place-items-center rounded-lg hover:bg-panel disabled:opacity-40";
  return (
    <div className="flex items-center justify-end gap-1">
      {status === "ACTIVE"
        ? <button className={icon} disabled={busy} aria-label="Pause rule" title="Pause rule" onClick={() => act(() => api(`/api/rules/${id}`, { method: "PATCH", body: { status: "PAUSED" } }))}><Columns2 size={18} strokeWidth={1.7} /></button>
        : <button className={icon} disabled={busy || !kycOk} aria-label={status === "DRAFT" ? "Activate rule" : "Resume rule"} title={!kycOk ? "Verify your identity first" : status === "DRAFT" ? "Activate rule" : "Resume rule"} onClick={() => act(() => api(`/api/rules/${id}`, { method: "PATCH", body: { status: "ACTIVE" } }))}><Play size={17} strokeWidth={1.7} /></button>}
      {edit}
      <button className={icon + " text-[#e5484d]"} disabled={busy} aria-label="Delete rule" title="Delete rule" onClick={() => setConfirmDel(true)}><Trash2 size={18} strokeWidth={1.7} /></button>
      {err && !confirmDel && <span role="alert" className="text-xs text-danger">{err}</span>}
      <Modal open={confirmDel} onClose={() => setConfirmDel(false)} size="sm" icon={<Trash2 size={18} className="text-[#e5484d]" />} title="Delete this rule?" description="It will stop running from the next split. Past split records are kept."
        footer={<><Button variant="secondary" onClick={() => setConfirmDel(false)}>Cancel</Button><Button className="!bg-[#e5484d] hover:!bg-[#cf3a3f]" loading={busy} onClick={() => act(() => api(`/api/rules/${id}`, { method: "DELETE" }))}>Delete rule</Button></>}>
        {err ? <Alert tone="danger">{err}</Alert> : <span className="sr-only">Confirm deletion</span>}
      </Modal>
    </div>
  );
}

export function RuleModalButton({ destinations, existing, kycOk, trigger, preset, autoOpen }: { destinations: Dest[]; existing?: Existing; kycOk: boolean; trigger: "add" | "edit" | "add-empty" | "reconfigure" | "create-for"; preset?: { type?: string; dest?: string }; autoOpen?: boolean }) {
  const [open, setOpen] = useState(!!autoOpen);
  return (
    <>
      {trigger === "reconfigure" || trigger === "create-for"
        ? <Button variant="outline" size="sm" className="h-10 px-4" onClick={() => setOpen(true)}><RotateCcw size={16} /> {trigger === "reconfigure" ? "Reconfigure Rule" : "Create Split Rule"}</Button>
        : trigger === "edit"
        ? <button className="grid size-8 place-items-center rounded-lg hover:bg-panel" aria-label="Edit rule" title="Edit rule" onClick={() => setOpen(true)}><SquarePen size={18} strokeWidth={1.7} /></button>
        : <Button size={trigger === "add" ? "xl" : "md"} className={trigger === "add" ? "px-6" : ""} onClick={() => setOpen(true)}><Plus size={18} /> {trigger === "add" ? "Add New Rule" : "Create your first rule"}</Button>}
      <Modal open={open} onClose={() => setOpen(false)} size="lg" icon={<Split size={20} />} title={existing ? "Edit split rule" : "Add new split rule"} description={existing ? "Changes apply from the next split. Past splits keep the values they ran with." : "Send a fixed amount or a percentage of each salary to a wallet or beneficiary."}>
        <RuleForm destinations={destinations} existing={existing} preset={preset} kycOk={kycOk} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
