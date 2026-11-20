"use client";
import { useState } from "react";
import { Banknote } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Field, Input } from "./ui";
import { Modal } from "./client-bits";

/** Admin "Pay salary": opens a Flutterwave sandbox checkout that pays into the user's salary account. */
export function PaySalaryButton({ user, defaultAmount, rules }: { user: { id: string; name: string; account: string }; defaultAmount?: string; rules: string[] }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(defaultAmount ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const over = Number(amount.replace(/[,₦\s]/g, "")) > 50_000;
  return (
    <>
      <Button size="sm" className="h-8 rounded-lg px-2.5" onClick={() => { setOpen(true); setErr(null); }}>Pay salary</Button>
      <Modal open={open} onClose={() => setOpen(false)} icon={<Banknote size={20} />} title={`Pay salary to ${user.name}`} description="Opens a Flutterwave sandbox checkout. After payment is verified with Flutterwave, the salary is credited and the user's split rules run."
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button form={`pay-${user.id}`} type="submit" loading={loading}>Continue to checkout</Button></>}>
        <form id={`pay-${user.id}`} className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setLoading(true); setErr(null); try { const r = await api<{ url: string }>("/api/admin/payins", { body: { userId: user.id, amount } }); window.location.href = r.url; } catch (er) { setErr((er as ApiError).message); setLoading(false); } }}>
          {err && <Alert tone="danger">{err}</Alert>}
          <dl className="space-y-3 rounded-2xl bg-panel-2 p-4 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted">Salary account</dt><dd className="text-right">{user.account}</dd></div>
            <div><dt className="text-muted">Active rules, in priority order</dt><dd className="mt-1">{rules.length ? <ol className="list-inside list-decimal space-y-0.5">{rules.map((r) => <li key={r}>{r}</li>)}</ol> : "None. The salary stays in the salary account."}</dd></div>
          </dl>
          <Field id={`amt-${user.id}`} label="Salary amount (₦)" hint="Flutterwave sandbox caps card payments at ₦50,000." error={over ? "The sandbox rejects card payments above ₦50,000." : undefined}>
            <Input id={`amt-${user.id}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50,000" required aria-describedby={`amt-${user.id}-hint`} />
          </Field>
          <p className="rounded-xl bg-brand-50 px-3 py-2.5 text-[13px] text-[#1673b3]">Test card: 5531 8866 5214 2950 · 09/32 · CVV 564 · PIN 3310 · OTP 12345</p>
        </form>
      </Modal>
    </>
  );
}
