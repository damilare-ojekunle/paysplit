"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Plus, RefreshCcwDot, SquarePen, Trash2 } from "lucide-react";
import { api, ApiError, newKey } from "@/lib/api";
import { naira } from "@/lib/format";
import { Alert, Button, Field, Input, Select } from "./ui";
import { Modal } from "./client-bits";

const WALLET_CATS = ["Savings", "Emergency", "Rent", "Bills", "Education", "Travel", "Investment", "Other"];
const BEN_CATS = ["Family", "Personal", "Rent", "Utilities", "Education", "Bills", "Other"];

export function WalletForm() {
  const router = useRouter();
  const [v, setV] = useState({ name: "", category: "Savings", target: "", description: "" });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<null | "save" | "rule">(null);
  async function save(next: "save" | "rule") {
    setLoading(next); setErr(null);
    try {
      const w = await api<{ id: string }>("/api/wallets", { body: v });
      router.push(next === "rule" ? `/rules/new?type=WALLET&dest=${w.id}` : `/destinations/wallets/${w.id}`); router.refresh();
    } catch (e) { setErr((e as ApiError).message); setLoading(null); }
  }
  return (
    <form className="max-w-xl space-y-5" onSubmit={(e: FormEvent) => { e.preventDefault(); save("save"); }}>
      {err && <Alert tone="danger">{err}</Alert>}
      <Field id="name" label="Wallet name"><Input id="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Dec Trip Fund" required maxLength={60} /></Field>
      <Field id="category" label="Category"><Select id="category" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>{WALLET_CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
      <Field id="target" label="Target amount (optional)" hint="Informational only — it doesn't lock funds or change how splits run.">
        <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">₦</span><Input id="target" inputMode="decimal" className="pl-8" value={v.target} onChange={(e) => setV({ ...v, target: e.target.value })} placeholder="0.00" aria-describedby="target-hint" /></div>
      </Field>
      <Field id="description" label="Description (optional)"><Input id="description" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={200} /></Field>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="secondary" loading={loading === "save"} disabled={!!loading || !v.name}>Save wallet</Button>
        <Button type="button" loading={loading === "rule"} disabled={!!loading || !v.name} onClick={() => save("rule")}>Save wallet & create split rule</Button>
      </div>
    </form>
  );
}

export function BeneficiaryForm() {
  const router = useRouter();
  const [banks, setBanks] = useState<{ code: string; name: string }[] | null>(null);
  const [v, setV] = useState({ name: "", category: "Family", bankCode: "", accountNumber: "", narration: "" });
  const [lookup, setLookup] = useState<{ state: "idle" | "loading" | "ok" | "error"; name?: string; msg?: string }>({ state: "idle" });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<null | "save" | "rule">(null);

  useEffect(() => { api<{ code: string; name: string }[]>("/api/banks").then(setBanks).catch((e) => setErr((e as ApiError).message)); }, []);
  useEffect(() => {
    if (v.accountNumber.length !== 10 || !v.bankCode) { setLookup({ state: "idle" }); return; }
    let live = true;
    setLookup({ state: "loading" });
    api<{ accountName: string }>("/api/banks/resolve", { body: { bankCode: v.bankCode, accountNumber: v.accountNumber } })
      .then((r) => live && setLookup({ state: "ok", name: r.accountName }))
      .catch((e) => live && setLookup({ state: "error", msg: (e as ApiError).message }));
    return () => { live = false; };
  }, [v.bankCode, v.accountNumber]);

  async function save(next: "save" | "rule") {
    setLoading(next); setErr(null);
    try {
      const b = await api<{ id: string }>("/api/beneficiaries", { body: { ...v, narration: v.narration || undefined } });
      router.push(next === "rule" ? `/rules/new?type=BENEFICIARY&dest=${b.id}` : `/destinations/beneficiaries/${b.id}`); router.refresh();
    } catch (e) { setErr((e as ApiError).message); setLoading(null); }
  }
  const ready = v.name && lookup.state === "ok";
  return (
    <form className="max-w-xl space-y-5" onSubmit={(e) => { e.preventDefault(); save("save"); }}>
      {err && <Alert tone="danger">{err}</Alert>}
      <Field id="name" label="Beneficiary name"><Input id="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Mum" required maxLength={80} /></Field>
      <Field id="category" label="Category"><Select id="category" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>{BEN_CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
      <Field id="bank" label="Bank">
        <Select id="bank" value={v.bankCode} onChange={(e) => setV({ ...v, bankCode: e.target.value })} required disabled={!banks}>
          <option value="">{banks ? "Select bank" : "Loading banks…"}</option>
          {banks?.map((b) => <option key={b.code + b.name} value={b.code}>{b.name}</option>)}
        </Select>
      </Field>
      <Field id="acct" label="Account number" hint="Sandbox test account: Access Bank (044) · 0690000031" error={lookup.state === "error" ? lookup.msg : undefined}>
        <Input id="acct" inputMode="numeric" maxLength={10} value={v.accountNumber} onChange={(e) => setV({ ...v, accountNumber: e.target.value.replace(/\D/g, "") })} required aria-invalid={lookup.state === "error"} aria-describedby="acct-hint acct-error" />
      </Field>
      <div aria-live="polite">
        {lookup.state === "loading" && <p className="text-sm text-muted">Looking up account…</p>}
        {lookup.state === "ok" && <p className="flex items-center gap-2 rounded-xl bg-success-50 px-3 py-2 text-sm text-success"><CheckCircle2 size={16} /> {lookup.name}</p>}
      </div>
      <Field id="narration" label="Payment narration (optional)"><Input id="narration" value={v.narration} onChange={(e) => setV({ ...v, narration: e.target.value })} maxLength={100} placeholder="e.g. Monthly allowance" /></Field>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="secondary" loading={loading === "save"} disabled={!!loading || !ready}>Save beneficiary</Button>
        <Button type="button" loading={loading === "rule"} disabled={!!loading || !ready} onClick={() => save("rule")}>Save & create split rule</Button>
      </div>
    </form>
  );
}

export function MoveToSalary({ walletId, balance, disabledReason }: { walletId: string; balance: string; disabledReason?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [key, setKey] = useState(newKey);
  return (
    <>
      <Button size="sm" className="h-10 px-4" onClick={() => { setOpen(true); setConfirm(false); setErr(null); setKey(newKey()); }} disabled={!!disabledReason || balance === "0"} title={disabledReason ?? (balance === "0" ? "This wallet is empty" : "Move money back to your salary account")}><RefreshCcwDot size={16} /> Move</Button>
      <Modal open={open} onClose={() => setOpen(false)} size="sm" icon={<RefreshCcwDot size={18} />} title="Move to salary account" description="Internal move, no fee. The money becomes available for your next split.">
        {err && <Alert tone="danger" className="mb-4">{err}</Alert>}
        {!confirm ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setConfirm(true); }}>
            <Field id="amt" label="Amount" hint={`Available: ${naira(balance)}`}><Input id="amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required aria-describedby="amt-hint" /></Field>
            <Button type="submit" size="lg" disabled={!amount}>Review</Button>
          </form>
        ) : (
          <div className="space-y-4">
            <dl className="space-y-2 rounded-2xl bg-panel-2 p-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted">From</dt><dd>This wallet</dd></div>
              <div className="flex justify-between"><dt className="text-muted">To</dt><dd>Your salary account</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Amount</dt><dd className="font-semibold">₦{amount}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Fee</dt><dd>₦0 (internal move)</dd></div>
            </dl>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setConfirm(false)}>Back</Button>
              <Button loading={loading} onClick={async () => { setLoading(true); setErr(null); try { await api(`/api/wallets/${walletId}/move-to-salary`, { body: { amount, idempotencyKey: key } }); setOpen(false); router.refresh(); } catch (e) { setErr((e as ApiError).message); setConfirm(false); } finally { setLoading(false); } }}>Confirm move</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export function DeleteButton({ url, label, confirmText, after, icon }: { url: string; label: string; confirmText: string; after: string; icon?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <>
      {icon
        ? <button onClick={() => { setOpen(true); setErr(null); }} aria-label={label} title={label} className="grid size-8 place-items-center rounded-lg text-[#e5484d] hover:bg-panel"><Trash2 size={18} strokeWidth={1.7} /></button>
        : <Button variant="danger" size="sm" onClick={() => { setOpen(true); setErr(null); }}>{label}</Button>}
      <Modal open={open} onClose={() => setOpen(false)} size="sm" icon={<Trash2 size={18} className="text-[#e5484d]" />} title={label}>
        <p className="text-sm text-muted">{confirmText}</p>
        {err && <Alert tone="danger" className="mt-4">{err}</Alert>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={loading} onClick={async () => { setLoading(true); try { await api(url, { method: "DELETE" }); router.push(after); router.refresh(); } catch (e) { setErr((e as ApiError).message); } finally { setLoading(false); } }}>{label}</Button>
        </div>
      </Modal>
    </>
  );
}

export function EditTarget({ walletId, current }: { walletId: string; current: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(current ? String(Number(current) / 100) : "");
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button className="text-sm text-brand hover:underline" onClick={() => setOpen(true)}>{current ? "Edit target" : "Set a target"}</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Wallet target">
        {err && <Alert tone="danger" className="mb-4">{err}</Alert>}
        <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); try { await api(`/api/wallets/${walletId}`, { method: "PATCH", body: { target: v } }); setOpen(false); router.refresh(); } catch (er) { setErr((er as ApiError).message); } }}>
          <Field id="t" label="Target amount" hint="Leave empty to remove the target."><Input id="t" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} aria-describedby="t-hint" /></Field>
          <Button type="submit" size="lg">Save</Button>
        </form>
      </Modal>
    </>
  );
}

/* ---------------------------------------------------------------- Figma pop-ups */

const COLORS = [{ v: "green", label: "Green", hex: "#0f9523" }, { v: "orange", label: "Orange", hex: "#fc4f24" }, { v: "purple", label: "Purple", hex: "#8a38f5" }, { v: "blue", label: "Blue", hex: "#33a7f5" }];
type WalletInit = { id: string; name: string; category: string; target: string | null; color: string | null };

export function WalletModalButton({ existing, trigger = "create", className, autoOpen }: { existing?: WalletInit; trigger?: "create" | "edit" | "empty"; className?: string; autoOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!autoOpen);
  const init = () => ({ name: existing?.name ?? "", category: existing?.category ?? "Emergency", target: existing?.target ? String(Number(existing.target) / 100) : "", color: existing?.color ?? "green", noTarget: existing ? !existing.target : false });
  const [v, setV] = useState(init);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<null | "save" | "rule">(null);
  const swatch = COLORS.find((c) => c.v === v.color) ?? COLORS[0];
  async function save(next: "save" | "rule") {
    setLoading(next); setErr(null);
    const body = { name: v.name, category: v.category, color: v.color, target: v.noTarget ? "" : v.target };
    try {
      if (existing) { await api(`/api/wallets/${existing.id}`, { method: "PATCH", body: { ...body, target: v.noTarget ? null : v.target || null } }); setOpen(false); router.refresh(); }
      else { const w = await api<{ id: string }>("/api/wallets", { body }); setOpen(false); router.push(next === "rule" ? `/rules?new=WALLET:${w.id}` : `/destinations/wallets/${w.id}`); router.refresh(); }
    } catch (e) { setErr((e as ApiError).message); } finally { setLoading(null); }
  }
  return (
    <>
      {trigger === "edit"
        ? <button onClick={() => { setV(init()); setOpen(true); }} className="inline-flex items-center gap-2 text-sm hover:text-brand"><SquarePen size={16} /> Edit Wallet</button>
        : <Button size={trigger === "empty" ? "md" : "sm"} className={className ?? "h-10 px-4"} onClick={() => { setV(init()); setOpen(true); }}><Plus size={16} /> Create Wallet</Button>}
      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={existing ? "Edit Wallet" : "Create New Wallet"}
        footer={<div className="grid w-full grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" loading={loading === "save"} disabled={!!loading || !v.name} onClick={() => save("save")}>Save</Button>
          {existing ? <Button size="lg" onClick={() => setOpen(false)} variant="primary">Done</Button> : <Button size="lg" loading={loading === "rule"} disabled={!!loading || !v.name} onClick={() => save("rule")}>Create Rule</Button>}
        </div>}>
        {err && <Alert tone="danger" className="mb-4">{err}</Alert>}
        <form className="grid gap-x-4 gap-y-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save("save"); }}>
          <Field id="wm-name" label="Wallet Name *"><Input id="wm-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g Children school fees" maxLength={60} required /></Field>
          <Field id="wm-cat" label="Select Category"><Select id="wm-cat" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>{WALLET_CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <div className="space-y-2">
            <Field id="wm-target" label="Budget Target Amount (₦)"><Input id="wm-target" inputMode="decimal" value={v.target} disabled={v.noTarget} onChange={(e) => setV({ ...v, target: e.target.value })} placeholder="e.g ₦1,500,000" /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-[15px] accent-brand" checked={v.noTarget} onChange={(e) => setV({ ...v, noTarget: e.target.checked, target: e.target.checked ? "" : v.target })} /> No Targeted Amount</label>
          </div>
          <Field id="wm-color" label="Accent Color">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 size-7 -translate-y-1/2 rounded-full" style={{ background: swatch.hex }} aria-hidden />
              <Select id="wm-color" value={v.color} onChange={(e) => setV({ ...v, color: e.target.value })} className="pl-12">{COLORS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</Select>
            </div>
          </Field>
        </form>
      </Modal>
    </>
  );
}

type BenInit = { id: string; name: string; category: string; bankCode: string; accountNumber: string; narration: string | null };

export function BeneficiaryModalButton({ existing, trigger = "create", autoOpen }: { existing?: BenInit; trigger?: "create" | "edit" | "icon" | "empty"; autoOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!autoOpen);
  const [banks, setBanks] = useState<{ code: string; name: string }[] | null>(null);
  const init = () => ({ name: existing?.name ?? "", category: existing?.category ?? "Family", bankCode: existing?.bankCode ?? "", accountNumber: existing?.accountNumber ?? "", narration: existing?.narration ?? "" });
  const [v, setV] = useState(init);
  const [lookup, setLookup] = useState<{ state: "idle" | "loading" | "ok" | "error"; name?: string; msg?: string }>({ state: "idle" });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<null | "save" | "rule">(null);
  useEffect(() => { if (open && !banks) api<{ code: string; name: string }[]>("/api/banks").then(setBanks).catch((e) => setErr((e as ApiError).message)); }, [open, banks]);
  useEffect(() => {
    if (!open || v.accountNumber.length !== 10 || !v.bankCode) { setLookup({ state: "idle" }); return; }
    if (existing && v.bankCode === existing.bankCode && v.accountNumber === existing.accountNumber) { setLookup({ state: "ok", name: "Saved account" }); return; }
    let live = true;
    setLookup({ state: "loading" });
    api<{ accountName: string }>("/api/banks/resolve", { body: { bankCode: v.bankCode, accountNumber: v.accountNumber } })
      .then((r) => { if (live) { setLookup({ state: "ok", name: r.accountName }); setV((x) => ({ ...x, name: x.name || r.accountName })); } })
      .catch((e) => live && setLookup({ state: "error", msg: (e as ApiError).message }));
    return () => { live = false; };
  }, [open, v.bankCode, v.accountNumber, existing]);
  async function save(next: "save" | "rule") {
    setLoading(next); setErr(null);
    const body = { ...v, narration: v.narration || undefined };
    try {
      if (existing) { await api(`/api/beneficiaries/${existing.id}`, { method: "PATCH", body }); setOpen(false); router.refresh(); }
      else { const b = await api<{ id: string }>("/api/beneficiaries", { body }); setOpen(false); router.push(next === "rule" ? `/rules?new=BENEFICIARY:${b.id}` : `/destinations/beneficiaries/${b.id}`); router.refresh(); }
    } catch (e) { setErr((e as ApiError).message); } finally { setLoading(null); }
  }
  const ready = !!v.name && lookup.state === "ok";
  const openIt = () => { setV(init()); setErr(null); setOpen(true); };
  return (
    <>
      {trigger === "icon" ? <button onClick={openIt} aria-label={`Edit ${existing?.name}`} title="Edit" className="grid size-8 place-items-center rounded-lg hover:bg-panel"><SquarePen size={18} strokeWidth={1.7} /></button>
        : trigger === "edit" ? <button onClick={openIt} className="inline-flex items-center gap-2 text-sm hover:text-brand"><SquarePen size={16} /> Edit Beneficiary</button>
        : <Button size={trigger === "empty" ? "md" : "sm"} className={trigger === "empty" ? "" : "h-10 px-4"} onClick={openIt}><Plus size={16} /> Add beneficiary</Button>}
      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={existing ? "Edit Beneficiary" : "Add New Beneficiary"}
        footer={<div className="grid w-full grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" loading={loading === "save"} disabled={!!loading || !ready} onClick={() => save("save")}>Save</Button>
          {existing ? <Button size="lg" onClick={() => setOpen(false)}>Done</Button> : <Button size="lg" loading={loading === "rule"} disabled={!!loading || !ready} onClick={() => save("rule")}>Create Rule</Button>}
        </div>}>
        {err && <Alert tone="danger" className="mb-4">{err}</Alert>}
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (ready) save("save"); }}>
          <Field id="bm-bank" label="Bank Name *">
            <Select id="bm-bank" value={v.bankCode} onChange={(e) => setV({ ...v, bankCode: e.target.value })} disabled={!banks}>
              <option value="">{banks ? "Select bank" : "Loading banks…"}</option>
              {banks?.map((b) => <option key={b.code + b.name} value={b.code}>{b.name}</option>)}
            </Select>
          </Field>
          <Field id="bm-acct" label="Account Number *" error={lookup.state === "error" ? lookup.msg : undefined}>
            <Input id="bm-acct" inputMode="numeric" maxLength={10} value={v.accountNumber} onChange={(e) => setV({ ...v, accountNumber: e.target.value.replace(/\D/g, "") })} placeholder="e.g 0690000031" aria-invalid={lookup.state === "error"} />
          </Field>
          <div className="sm:col-span-2" aria-live="polite">
            {lookup.state === "loading" && <p className="text-sm text-muted">Looking up account…</p>}
            {lookup.state === "ok" && <p className="flex items-center gap-2 rounded-xl bg-success-50 px-3 py-2.5 text-sm text-success-ink"><CheckCircle2 size={16} /> {lookup.name}</p>}
            {lookup.state === "idle" && !existing && <p className="text-xs text-muted">Sandbox test account: Access Bank · 0690000031</p>}
          </div>
          <Field id="bm-name" label="Recipient / Entity Name *"><Input id="bm-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g Funke Adebayo" maxLength={80} /></Field>
          <Field id="bm-cat" label="Select Category"><Select id="bm-cat" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>{BEN_CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <div className="sm:col-span-2"><Field id="bm-narr" label="Narration"><Input id="bm-narr" value={v.narration} onChange={(e) => setV({ ...v, narration: e.target.value })} maxLength={100} placeholder="e.g Monthly allowance" /></Field></div>
        </form>
      </Modal>
    </>
  );
}
