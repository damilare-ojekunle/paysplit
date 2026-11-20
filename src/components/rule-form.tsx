"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Field, Input, Select } from "./ui";

type Dest = { id: string; name: string; category: string; type: "WALLET" | "BENEFICIARY"; hasRule: boolean; ruleId?: string };
type Existing = { id: string; name: string; destinationType: "WALLET" | "BENEFICIARY"; destinationId: string; method: "FIXED" | "PERCENT"; value: string; priority: number; status: string };

export function RuleForm({ destinations, preset, existing, kycOk }: { destinations: Dest[]; preset?: { type?: string; dest?: string }; existing?: Existing; kycOk: boolean }) {
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
      router.push("/rules"); router.refresh();
    } catch (e) { setErr((e as ApiError).message); setReview(false); } finally { setLoading(null); }
  }

  if (review && chosen) {
    return (
      <div className="max-w-xl space-y-5">
        <h2 className="text-xl font-medium">Review rule</h2>
        <dl className="space-y-3 rounded-2xl bg-canvas p-5 text-sm">
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
    <form className="max-w-xl space-y-5" onSubmit={(e) => { e.preventDefault(); setErr(null); if (!chosen) return setErr("Choose a destination"); setReview(true); }}>
      {err && <Alert tone="danger">{err}</Alert>}
      <Field id="name" label="Rule name"><Input id="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Mother's monthly allowance" required maxLength={80} /></Field>
      {!existing && (
        <>
          <fieldset className="grid grid-cols-2 gap-3"><legend className="mb-1.5 text-sm font-medium">Destination type</legend>
            {(["WALLET", "BENEFICIARY"] as const).map((t) => <label key={t} className={`cursor-pointer rounded-xl border px-4 py-3 text-sm ${v.destinationType === t ? "border-brand bg-brand-50" : "border-line"}`}><input type="radio" className="sr-only" checked={v.destinationType === t} onChange={() => setV({ ...v, destinationType: t, destinationId: "" })} />{t === "WALLET" ? "Wallet" : "Beneficiary"}</label>)}
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
      <fieldset className="grid grid-cols-2 gap-3"><legend className="mb-1.5 text-sm font-medium">Allocation method</legend>
        {(["FIXED", "PERCENT"] as const).map((m) => <label key={m} className={`cursor-pointer rounded-xl border px-4 py-3 text-sm ${v.method === m ? "border-brand bg-brand-50" : "border-line"}`}><input type="radio" className="sr-only" checked={v.method === m} onChange={() => setV({ ...v, method: m, value: "" })} />{m === "FIXED" ? "Fixed amount" : "Percentage"}</label>)}
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

export function RuleActions({ id, status, kycOk }: { id: string; status: string; kycOk: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function act(fn: () => Promise<unknown>) { setBusy(true); setErr(null); try { await fn(); router.refresh(); } catch (e) { setErr((e as ApiError).message); } finally { setBusy(false); } }
  return (
    <div className="flex items-center justify-end gap-1">
      {status === "ACTIVE" && <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => api(`/api/rules/${id}`, { method: "PATCH", body: { status: "PAUSED" } }))}>Pause</Button>}
      {status !== "ACTIVE" && <Button size="sm" variant="ghost" disabled={busy || !kycOk} title={!kycOk ? "Verify your identity first" : undefined} onClick={() => act(() => api(`/api/rules/${id}`, { method: "PATCH", body: { status: "ACTIVE" } }))}>{status === "DRAFT" ? "Activate" : "Resume"}</Button>}
      <Link href={`/rules/${id}/edit`} className="rounded-lg px-3 py-2 text-sm text-brand hover:bg-brand-50">Edit</Link>
      <Button size="sm" variant="ghost" className="!text-danger" disabled={busy} onClick={() => confirm("Delete this rule? Past split records are kept.") && act(() => api(`/api/rules/${id}`, { method: "DELETE" }))}>Delete</Button>
      {err && <span role="alert" className="text-xs text-danger">{err}</span>}
    </div>
  );
}
