"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Field, Input } from "@/components/ui";

export function AdminProfileForm({ initial }: { initial: { firstName: string; lastName: string; phone: string } }) {
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<{ t: "success" | "danger"; m: string } | null>(null);
  return (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); try { await api("/api/admin/profile", { method: "PATCH", body: v }); setMsg({ t: "success", m: "Saved." }); } catch (er) { setMsg({ t: "danger", m: (er as ApiError).message }); } }}>
      {msg && <Alert tone={msg.t}>{msg.m}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <Field id="fn" label="First name"><Input id="fn" value={v.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} /></Field>
        <Field id="ln" label="Last name"><Input id="ln" value={v.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} /></Field>
      </div>
      <Field id="ph" label="Phone number"><Input id="ph" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
      <Button type="submit">Save</Button>
    </form>
  );
}
