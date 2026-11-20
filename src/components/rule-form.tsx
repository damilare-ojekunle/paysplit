"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Columns2, Landmark, Play, Plus, RotateCcw, Split, SquarePen, Trash2, Wallet as WalletIcon } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "./client-bits";
import { Alert, Button, Field, Input, Select } from "./ui";

type Dest = { id: string; name: string; category: string; type: "WALLET" | "BENEFICIARY"; hasRule: boolean; ruleId?: string };
type Existing = { id: string; name: string; destinationType: "WALLET" | "BENEFICIARY"; destinationId: string; method: "FIXED" | "PERCENT"; value: string; priority: number; status: string; conditionType?: "ANY" | "MIN_AMOUNT" | "SENDER"; conditionMin?: string; conditionSender?: string; executionMode?: "EACH_INFLOW" | "MONTHLY_TARGET"; monthlyTarget?: string };

export function RuleForm({ destinations, preset, existing, kycOk, onDone }: { destinations: Dest[]; preset?: { type?: string; dest?: string }; existing?: Existing; kycOk: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    name: existing?.name ?? "",
    destinationType: (existing?.destinationType ?? (preset?.type as Dest["type"]) ?? "WALLET") as Dest["type"],
    destinationId: existing?.destinationId ?? preset?.dest ?? "",
    method: existing?.method ?? ("FIXED" as "FIXED" | "PERCENT"),
    value: existing?.value ?? "",
    priority: existing?.priority ?? 1,
    conditionType: existing?.conditionType ?? ("ANY" as "ANY" | "MIN_AMOUNT" | "SENDER"),
    conditionMin: existing?.conditionMin ?? "",
    conditionSender: existing?.conditionSender ?? "",
    executionMode: existing?.executionMode ?? ("EACH_INFLOW" as "EACH_INFLOW" | "MONTHLY_TARGET"),
    monthlyTarget: existing?.monthlyTarget ?? "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const options = destinations.filter((d) => d.type === v.destinationType);
  const chosen = destinations.find((d) => d.id === v.destinationId);
  const conflict = !existing && chosen?.hasRule;
  const ready = !!v.name && !!chosen && !!v.value && !conflict && (v.conditionType !== "MIN_AMOUNT" || !!v.conditionMin) && (v.conditionType !== "SENDER" || !!v.conditionSender) && (v.executionMode !== "MONTHLY_TARGET" || !!v.monthlyTarget);

  async function submit() {
    setLoading(true); setErr(null);
    const extra = { conditionType: v.conditionType, conditionMin: v.conditionMin, conditionSender: v.conditionSender, executionMode: v.executionMode, monthlyTarget: v.monthlyTarget };
    try {
      if (existing) await api(`/api/rules/${existing.id}`, { method: "PATCH", body: { name: v.name, method: v.method, value: v.value, priority: v.priority, ...extra, ...(kycOk && existing.status === "DRAFT" ? { status: "ACTIVE" } : {}) } });
      else await api("/api/rules", { body: { name: v.name, destinationType: v.destinationType, destinationId: v.destinationId, method: v.method, value: v.value, priority: v.priority, activate: kycOk, ...extra } });
      if (onDone) { onDone(); router.refresh(); } else { router.push("/rules"); router.refresh(); }
    } catch (e) { setErr((e as ApiError).message); } finally { setLoading(false); }
  }

  const card = (on: boolean) => `flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 ${on ? "border-brand bg-brand-50" : "border-line"}`;
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (ready) submit(); }}>
      {err && <Alert tone="danger">{err}</Alert>}
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field id="name" label="Rule Name"><Input id="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Mother's Monthly Allowance" required maxLength={80} /></Field>
        <Field id="priority" label="Priority"><Select id="priority" value={v.priority} onChange={(e) => setV({ ...v, priority: Number(e.target.value) })}>{Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}{i === 0 ? " (first)" : ""}</option>)}</Select></Field>
      </div>
      {!existing && (
        <fieldset>
          <legend className="mb-2 text-sm">Destination Type</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {([["WALLET", "Move to Wallet", "Save into one of your wallets", WalletIcon], ["BENEFICIARY", "Send to Beneficiary", "Transfer to a saved bank account", Landmark]] as const).map(([t, title, sub, Icon]) => (
              <label key={t} className={card(v.destinationType === t)}>
                <input type="radio" className="sr-only" checked={v.destinationType === t} onChange={() => setV({ ...v, destinationType: t, destinationId: "" })} />
                <span className={`grid size-10 place-items-center rounded-full ${v.destinationType === t ? "bg-brand text-white" : "bg-panel text-muted"}`}><Icon size={18} /></span>
                <span><span className="block text-[15px] font-medium">{title}</span><span className="text-xs text-muted">{sub}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {!existing && (
        <Field id="dest" label={v.destinationType === "WALLET" ? "Select Wallet" : "Select Beneficiary"} error={conflict ? "This destination already has a rule" : undefined}>
          <Select id="dest" value={v.destinationId} onChange={(e) => setV({ ...v, destinationId: e.target.value })} required aria-invalid={conflict}>
            <option value="">{options.length ? "Choose destination" : `No ${v.destinationType === "WALLET" ? "wallets" : "beneficiaries"} yet`}</option>
            {options.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.category}{d.hasRule ? " (has a rule)" : ""}</option>)}
          </Select>
        </Field>
      )}
      {conflict && chosen?.ruleId && <Alert tone="info">Each destination can have one rule. <Link className="underline" href={`/rules/${chosen.ruleId}/edit`}>Edit the existing rule</Link></Alert>}
      {!existing && !options.length && <Link href={v.destinationType === "WALLET" ? "/destinations/wallets/new" : "/destinations/beneficiaries/new"} className="text-sm text-brand hover:underline">+ Create a {v.destinationType === "WALLET" ? "wallet" : "beneficiary"} first</Link>}

      <div>
        <p className="mb-2 text-sm">Allocation Method</p>
        <div role="tablist" className="mb-3 inline-flex gap-2">
          {(["FIXED", "PERCENT"] as const).map((m) => <button key={m} type="button" role="tab" aria-selected={v.method === m} onClick={() => setV({ ...v, method: m, value: "" })} className={`rounded-lg border px-4 py-2 text-sm ${v.method === m ? "border-brand bg-brand-50 text-brand" : "border-line text-muted"}`}>{m === "FIXED" ? "Fixed Amount" : "Percentage"}</button>)}
        </div>
        <div className="relative">
          {v.method === "FIXED" && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">₦</span>}
          <Input id="value" aria-label={v.method === "FIXED" ? "Amount" : "Percentage of salary"} inputMode="decimal" className={v.method === "FIXED" ? "pl-8" : "pr-8"} value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} placeholder={v.method === "FIXED" ? "50,000" : "15"} required />
          {v.method === "PERCENT" && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted">%</span>}
        </div>
        <p className="mt-1.5 text-xs text-muted">{v.method === "PERCENT" ? "Percentages use the full salary, not what's left after earlier rules." : "Fixed amounts are paid in full or skipped, never partly paid."}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Field id="cond" label="Qualifying Inflow"><Select id="cond" value={v.conditionType} onChange={(e) => setV({ ...v, conditionType: e.target.value as typeof v.conditionType })}><option value="ANY">Every eligible inflow</option><option value="MIN_AMOUNT">Inflow above a minimum amount</option><option value="SENDER">Inflow from a specific sender</option></Select></Field>
          {v.conditionType === "MIN_AMOUNT" && <Input aria-label="Minimum inflow amount" inputMode="decimal" className="h-[44px]" value={v.conditionMin} onChange={(e) => setV({ ...v, conditionMin: e.target.value })} placeholder="Minimum amount, e.g. ₦100,000" />}
          {v.conditionType === "SENDER" && <Input aria-label="Sender account name" className="h-[44px]" value={v.conditionSender} onChange={(e) => setV({ ...v, conditionSender: e.target.value })} placeholder="Sender's account name, e.g. Talent Nation" />}
        </div>
        <div className="space-y-2">
          <Field id="mode" label="Execution Mode"><Select id="mode" value={v.executionMode} onChange={(e) => setV({ ...v, executionMode: e.target.value as typeof v.executionMode })}><option value="EACH_INFLOW">As money comes in</option><option value="MONTHLY_TARGET">Monthly target</option></Select></Field>
          {v.executionMode === "MONTHLY_TARGET" && <Input aria-label="Monthly allocation target" inputMode="decimal" className="h-[44px]" value={v.monthlyTarget} onChange={(e) => setV({ ...v, monthlyTarget: e.target.value })} placeholder="Monthly target, e.g. ₦200,000" />}
        </div>
      </div>

      {!kycOk && <Alert tone="warn">This rule is saved as a draft. It activates after identity verification. <Link href="/onboarding" className="underline">Verify now</Link></Alert>}
      <div className="-mx-6 border-t border-line px-6 pt-5">
        <Button type="submit" size="lg" className="h-[60px]" loading={loading} disabled={!ready}><Plus size={16} /> {existing ? "Save Rule" : "Add Rule"}</Button>
      </div>
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
      <span className="contents">{edit}</span>
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
