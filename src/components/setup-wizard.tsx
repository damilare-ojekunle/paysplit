"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ClipboardList, Landmark, ShieldCheck, Split, Wallet } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Field, Input, Select } from "./ui";

type Steps = { income: boolean; wallets: boolean; recipients: boolean; rules: boolean };
const ORDER = ["income", "wallets", "recipients", "rules"] as const;
const META = {
  income: { label: "Income", sub: "Salary Info", icon: ClipboardList },
  wallets: { label: "Wallets", sub: "Savings Pocket", icon: Wallet },
  recipients: { label: "Recipients", sub: "Beneficiary", icon: Landmark },
  rules: { label: "Rules", sub: "Split Strategy", icon: Split },
};
const KEY = "ps-setup-dismissed";
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

export function SetupWizard({ steps, salaryDay }: { steps: Steps; salaryDay: number | null }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [done, setDone] = useState<Steps>(steps);
  const [step, setStep] = useState<number>(Math.max(0, ORDER.findIndex((k) => !steps[k])));
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [income, setIncome] = useState({ employer: "", monthlySalary: "", salaryDay: salaryDay ? String(salaryDay) : "28" });
  const [wallet, setWallet] = useState({ name: "", category: "Savings", target: "" });
  const [ben, setBen] = useState({ name: "", category: "Family", bankCode: "", accountNumber: "" });
  const [rule, setRule] = useState({ dest: "", method: "PERCENT", value: "", priority: "1" });
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);
  const [resolved, setResolved] = useState<string | null>(null);
  const [dests, setDests] = useState<{ id: string; type: "WALLET" | "BENEFICIARY"; name: string }[]>([]);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(KEY) === "1"; } catch {}
    if (!dismissed) setOpen(true);
  }, []);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  useEffect(() => { if (ORDER[step] === "recipients" && !banks.length) api<{ code: string; name: string }[]>("/api/banks").then(setBanks).catch(() => {}); }, [step, banks.length]);
  useEffect(() => {
    if (ORDER[step] !== "rules") return;
    Promise.all([api<{ id: string; name: string; rule: unknown }[]>("/api/wallets"), api<{ id: string; name: string; rule: unknown }[]>("/api/beneficiaries")]).then(([w, b]) => {
      const list = [...w.filter((x) => !x.rule).map((x) => ({ id: x.id, type: "WALLET" as const, name: `${x.name} (wallet)` })), ...b.filter((x) => !x.rule).map((x) => ({ id: x.id, type: "BENEFICIARY" as const, name: x.name }))];
      setDests(list); if (list[0]) setRule((r) => ({ ...r, dest: r.dest || `${list[0].type}:${list[0].id}` }));
    }).catch(() => {});
  }, [step]);
  useEffect(() => {
    setResolved(null);
    if (ben.accountNumber.length !== 10 || !ben.bankCode) return;
    let live = true;
    api<{ accountName: string }>("/api/banks/resolve", { body: { bankCode: ben.bankCode, accountNumber: ben.accountNumber } }).then((r) => { if (live) { setResolved(r.accountName); setBen((b) => ({ ...b, name: b.name || r.accountName })); } }).catch((e) => live && setErr((e as ApiError).message));
    return () => { live = false; };
  }, [ben.bankCode, ben.accountNumber]);

  function close() {
    try { sessionStorage.setItem(KEY, "1"); } catch {}
    setOpen(false); router.refresh();
  }
  function next() { setErr(null); if (step >= ORDER.length - 1) close(); else setStep(step + 1); }

  async function save() {
    setBusy(true); setErr(null);
    try {
      const k = ORDER[step];
      if (k === "income") await api("/api/profile", { method: "PATCH", body: { employer: income.employer || null, monthlySalary: income.monthlySalary || null, salaryDay: Number(income.salaryDay) } });
      if (k === "wallets") await api("/api/wallets", { body: wallet });
      if (k === "recipients") await api("/api/beneficiaries", { body: ben });
      if (k === "rules") {
        const [type, id] = rule.dest.split(":");
        const d = dests.find((x) => x.id === id);
        try { await api("/api/rules", { body: { name: d?.name.replace(" (wallet)", "") ?? "Rule", destinationType: type, destinationId: id, method: rule.method, value: rule.value, priority: Number(rule.priority), activate: true } }); }
        catch (e) { if ((e as ApiError).code === "KYC_REQUIRED") await api("/api/rules", { body: { name: d?.name.replace(" (wallet)", "") ?? "Rule", destinationType: type, destinationId: id, method: rule.method, value: rule.value, priority: Number(rule.priority), activate: false } }); else throw e; }
      }
      setDone({ ...done, [k]: true });
      next();
    } catch (e) { setErr((e as ApiError).message); } finally { setBusy(false); }
  }

  const k = ORDER[step];
  const canSave = k === "income" ? !!income.salaryDay : k === "wallets" ? !!wallet.name : k === "recipients" ? !!resolved && !!ben.name : !!rule.dest && !!rule.value;

  return (
    <dialog ref={ref} onClose={close} aria-labelledby="setup-title" className="m-auto w-[calc(100%-2rem)] max-w-[678px] overflow-hidden rounded-[20px] bg-white p-0 text-ink shadow-2xl backdrop:bg-black/30 backdrop:backdrop-blur-md">
      {open && (
        <div>
          <div className="bg-gradient-to-b from-[#ececec] via-white to-white px-4 pb-1 pt-9 text-center">
            <h2 id="setup-title" className="text-[19px] font-semibold">Configure your Salary Partitions</h2>
            <p className="mt-1.5 text-[13px] text-muted">Complete {ORDER.length} steps to activate automated payroll distribution.</p>
            <ol className="mx-auto mt-6 flex max-w-[420px] items-start justify-between">
              {ORDER.map((key, i) => {
                const M = META[key]; const Icon = M.icon; const active = i === step; const ok = done[key];
                return (
                  <li key={key} className="relative flex w-[85px] flex-col items-center">
                    {i < ORDER.length - 1 && <span className="absolute left-[60px] top-4 h-0.5 w-[50px] bg-line"><span className={clsx("block h-full bg-brand transition-all", i < step ? "w-full" : active ? "w-1/2" : "w-0")} /></span>}
                    <button type="button" onClick={() => setStep(i)} aria-current={active ? "step" : undefined} aria-label={`${M.label}: ${M.sub}${ok ? " (done)" : ""}`} className={clsx("relative grid size-8 place-items-center rounded-lg border", active ? "border-brand/30 bg-brand-100 text-brand" : ok ? "border-success/30 bg-success-50 text-success" : "border-line bg-white text-subtle")}>
                      {ok && !active ? <Check size={16} /> : <Icon size={16} />}
                      {active && <span className="absolute -right-[7px] top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-brand" />}
                    </button>
                    <span className="mt-2 text-[13px] font-medium">{M.label}</span>
                    <span className="text-[10px] text-muted">{M.sub}</span>
                  </li>
                );
              })}
            </ol>
          </div>

          <form className="px-6 pb-6 pt-5" onSubmit={(e) => { e.preventDefault(); if (canSave) save(); }}>
            {err && <Alert tone="danger" className="mb-4">{err}</Alert>}
            {k === "income" && (
              <div className="space-y-4">
                <h3 className="text-[15px] font-medium">Salary Income Source</h3>
                <Field id="w-employer" label="Employer"><Input id="w-employer" value={income.employer} onChange={(e) => setIncome({ ...income, employer: e.target.value })} placeholder="Talent Nation" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="w-salary" label="Monthly Salary Amount"><Input id="w-salary" inputMode="decimal" value={income.monthlySalary} onChange={(e) => setIncome({ ...income, monthlySalary: e.target.value })} placeholder="₦850,000" /></Field>
                  <Field id="w-day" label="Expected Payday Day of Month"><Select id="w-day" value={income.salaryDay} onChange={(e) => setIncome({ ...income, salaryDay: e.target.value })}>{Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{ordinal(i + 1)}</option>)}</Select></Field>
                </div>
              </div>
            )}
            {k === "wallets" && (
              <div className="space-y-4">
                <h3 className="text-[15px] font-medium">Create a Savings Pocket</h3>
                <Field id="w-name" label="Wallet Name"><Input id="w-name" value={wallet.name} onChange={(e) => setWallet({ ...wallet, name: e.target.value })} placeholder="Dec Trip Fund" maxLength={60} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="w-cat" label="Category"><Select id="w-cat" value={wallet.category} onChange={(e) => setWallet({ ...wallet, category: e.target.value })}>{["Savings", "Emergency", "Rent", "Bills", "Education", "Travel", "Investment", "Other"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
                  <Field id="w-target" label="Target Amount (optional)"><Input id="w-target" inputMode="decimal" value={wallet.target} onChange={(e) => setWallet({ ...wallet, target: e.target.value })} placeholder="₦220,000" /></Field>
                </div>
              </div>
            )}
            {k === "recipients" && (
              <div className="space-y-4">
                <h3 className="text-[15px] font-medium">Add a Beneficiary</h3>
                <Field id="w-bank" label="Bank"><Select id="w-bank" value={ben.bankCode} onChange={(e) => setBen({ ...ben, bankCode: e.target.value })}><option value="">{banks.length ? "Select bank" : "Loading banks…"}</option>{banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</Select></Field>
                <Field id="w-acct" label="Account Number" hint={resolved ? `✓ ${resolved}` : undefined}><Input id="w-acct" inputMode="numeric" maxLength={10} value={ben.accountNumber} onChange={(e) => setBen({ ...ben, accountNumber: e.target.value.replace(/\D/g, "") })} placeholder="0123456789" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="w-bname" label="Display Name"><Input id="w-bname" value={ben.name} onChange={(e) => setBen({ ...ben, name: e.target.value })} placeholder="Mum" /></Field>
                  <Field id="w-bcat" label="Category"><Select id="w-bcat" value={ben.category} onChange={(e) => setBen({ ...ben, category: e.target.value })}>{["Family", "Personal", "Rent", "Utilities", "Education", "Bills", "Other"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
                </div>
              </div>
            )}
            {k === "rules" && (
              <div className="space-y-4">
                <h3 className="text-[15px] font-medium">Create your first Split Rule</h3>
                {dests.length ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {([["WALLET", "Move to Wallet", Wallet], ["BENEFICIARY", "Send to Beneficiary", Landmark]] as const).map(([t, label, Icon]) => {
                        const on = rule.dest.startsWith(t + ":"); const first = dests.find((d) => d.type === t);
                        return (
                          <button key={t} type="button" disabled={!first} onClick={() => first && setRule({ ...rule, dest: `${t}:${first.id}` })} className={clsx("flex items-center gap-3 rounded-2xl border p-3 text-left disabled:opacity-40", on ? "border-brand bg-brand-50" : "border-line")}>
                            <span className={clsx("grid size-9 place-items-center rounded-full", on ? "bg-brand text-white" : "bg-panel text-muted")}><Icon size={16} /></span><span className="text-sm font-medium">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <Field id="w-dest" label="Destination"><Select id="w-dest" value={rule.dest} onChange={(e) => setRule({ ...rule, dest: e.target.value })}>{dests.filter((d) => rule.dest.startsWith(d.type + ":")).map((d) => <option key={d.id} value={`${d.type}:${d.id}`}>{d.name}</option>)}</Select></Field>
                    <div className="grid grid-cols-[1fr_1fr_90px] gap-3">
                      <Field id="w-method" label="Method"><Select id="w-method" value={rule.method} onChange={(e) => setRule({ ...rule, method: e.target.value })}><option value="PERCENT">Percentage</option><option value="FIXED">Fixed amount</option></Select></Field>
                      <Field id="w-val" label={rule.method === "PERCENT" ? "Percent" : "Amount (₦)"}><Input id="w-val" inputMode="decimal" value={rule.value} onChange={(e) => setRule({ ...rule, value: e.target.value })} placeholder={rule.method === "PERCENT" ? "10" : "50,000"} /></Field>
                      <Field id="w-pri" label="Priority"><Select id="w-pri" value={rule.priority} onChange={(e) => setRule({ ...rule, priority: e.target.value })}>{Array.from({ length: 10 }, (_, i) => <option key={i}>{i + 1}</option>)}</Select></Field>
                    </div>
                  </>
                ) : <p className="rounded-xl bg-panel-2 p-4 text-sm text-muted">Add a wallet or beneficiary first. Every destination without a rule appears here.</p>}
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4">
              <Button type="button" variant="secondary" size="lg" onClick={next}>{step === ORDER.length - 1 ? "Finish later" : "Skip"}</Button>
              <Button type="submit" size="lg" loading={busy} disabled={!canSave}>{step === ORDER.length - 1 ? "Finish" : "Next"}</Button>
            </div>
          </form>
        </div>
      )}
    </dialog>
  );
}

/** First-visit pop-up (Figma "Modal" 6026:26835): the two stages of getting started. */
export function GettingStarted() {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { let seen = false; try { seen = localStorage.getItem("ps-welcome") === "1"; } catch {} if (!seen) setOpen(true); }, []);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  const close = () => { try { localStorage.setItem("ps-welcome", "1"); } catch {} setOpen(false); };
  return (
    <dialog ref={ref} onClose={close} aria-labelledby="welcome-title" className="m-auto w-[calc(100%-2rem)] max-w-[803px] overflow-hidden rounded-[20px] bg-white p-0 text-ink shadow-2xl backdrop:bg-black/30 backdrop:backdrop-blur-md">
      {open && (
        <>
          <div className="relative mx-6 mt-6 grid h-[221px] place-items-center overflow-hidden rounded-2xl bg-gradient-to-b from-brand-50 to-white" aria-hidden>
            {[609, 520, 430, 340, 250].map((d, i) => <span key={d} className="absolute rounded-full border border-brand/10" style={{ width: d, height: d, opacity: 1 - i * 0.12 }} />)}
            <span className="relative grid size-[110px] place-items-center rounded-full bg-white shadow-[0_12px_32px_rgba(51,167,245,0.25)]"><ShieldCheck size={48} className="text-brand" /></span>
          </div>
          <div className="px-6 pb-2 pt-6 text-center">
            <h2 id="welcome-title" className="text-[19px] font-semibold">Welcome to Paysplit</h2>
            <p className="mx-auto mt-1 max-w-[511px] text-sm text-muted">Two quick stages and your salary will split itself every pay day. You can set things up now and verify any time.</p>
            <div className="mt-5 grid gap-4 text-left sm:grid-cols-2">
              {[{ s: "Step 1", t: "Profile & Identity Verification", d: "BVN or NIN, then a biometric liveness selfie.", icon: ShieldCheck }, { s: "Step 2", t: "Setup Checklist", d: "Income, vaults & rules: tell us where each naira goes.", icon: ClipboardList }].map(({ s, t, d, icon: Icon }) => (
                <div key={s} className="rounded-2xl border border-line bg-panel-2 p-5">
                  <span className="flex items-center justify-between"><span className="text-xs font-medium text-brand">{s}</span><Icon size={20} className="text-brand" aria-hidden /></span>
                  <p className="mt-3 text-[15px] font-medium">{t}</p><p className="mt-1 text-sm text-muted">{d}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line px-6 py-6">
            <Button variant="secondary" size="lg" className="h-[60px]" onClick={close}>I&apos;ll do this later</Button>
            <Button size="lg" className="h-[60px]" onClick={() => { close(); window.location.href = "/onboarding"; }}>Start verification</Button>
          </div>
        </>
      )}
    </dialog>
  );
}
