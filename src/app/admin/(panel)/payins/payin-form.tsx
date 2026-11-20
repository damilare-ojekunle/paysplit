"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

type U = { id: string; label: string; account: string; rules: string[] };

export function PayinForm({ users, preselect }: { users: U[]; preselect?: string }) {
  const [userId, setUserId] = useState(users.find((u) => u.id === preselect)?.id ?? users[0].id);
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const u = users.find((x) => x.id === userId)!;
  return (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setLoading(true); setErr(null); try { const r = await api<{ url: string }>("/api/admin/payins", { body: { userId, amount } }); window.location.href = r.url; } catch (er) { setErr((er as ApiError).message); setLoading(false); } }}>
      {err && <Alert tone="danger">{err}</Alert>}
      <Field id="user" label="Verified user"><Select id="user" value={userId} onChange={(e) => setUserId(e.target.value)}>{users.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select></Field>
      <div className="rounded-2xl bg-canvas p-4 text-sm">
        <p className="text-muted">Salary account</p><p className="font-medium">{u.account}</p>
        <p className="mt-3 text-muted">Active rules (in priority order)</p>
        {u.rules.length ? <ul className="mt-1 list-inside space-y-0.5">{u.rules.map((r) => <li key={r}>{r}</li>)}</ul> : <p>None — the salary will stay in the salary account.</p>}
      </div>
      <Field id="amount" label="Salary amount (₦)"><Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="600,000" required /></Field>
      <Button type="submit" size="lg" loading={loading}>Continue to sandbox checkout</Button>
    </form>
  );
}
