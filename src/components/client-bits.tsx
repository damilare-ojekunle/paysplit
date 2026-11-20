"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy, X } from "lucide-react";
import { api, newKey, ApiError } from "@/lib/api";
import { naira } from "@/lib/format";
import { Alert, Badge, Button } from "./ui";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={async () => { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }} className="inline-flex items-center gap-1 text-sm text-brand hover:underline" aria-live="polite">
      {ok ? <Check size={14} /> : <Copy size={14} />}{ok ? "Copied" : label}
    </button>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-labelledby="modal-title" className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-lg"} rounded-3xl p-0 backdrop:bg-navy/50`}>
      {open && (
        <div className="p-6 sm:p-8">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 id="modal-title" className="text-xl font-semibold">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full hover:bg-canvas"><X size={18} /></button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

type Preview = { available: string; totalAllocated: string; remaining: string; items: { ruleId: string; ruleName: string; destination: string; destinationType: string; priority: number; value: string; requestedMinor: string; allocatedMinor: string; status: string; skipReason?: string }[] };

export function RunNowButton({ disabledReason }: { disabledReason?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [key] = useState(newKey); // one key per dialog → double-clicks can't double-run

  async function start() {
    setOpen(true); setError(null); setPreview(null);
    try { setPreview(await api<Preview>("/api/splits/preview")); } catch (e) { setError((e as ApiError).message); }
  }
  async function confirm() {
    setLoading(true); setError(null);
    try { const r = await api<{ id: string }>("/api/splits/run", { body: { idempotencyKey: key } }); router.push(`/rules/history/${r.id}`); router.refresh(); }
    catch (e) { setError((e as ApiError).message); } finally { setLoading(false); }
  }
  return (
    <>
      <Button onClick={start} disabled={!!disabledReason} title={disabledReason}>Run split now</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Run split now" wide>
        {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
        {!preview && !error && <p className="text-sm text-muted">Calculating…</p>}
        {preview && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Your active rules will run against <b className="text-ink">{naira(preview.available)}</b> of unallocated salary. Rules that can't be fully funded are skipped — nothing is partially paid.</p>
            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-left text-xs text-muted"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Rule</th><th className="px-3 py-2">Destination</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Outcome</th></tr></thead>
                <tbody>
                  {preview.items.map((i) => (
                    <tr key={i.ruleId} className="border-t border-line">
                      <td className="px-3 py-2">{i.priority}</td><td className="px-3 py-2">{i.ruleName} <span className="text-muted">({i.value})</span></td><td className="px-3 py-2">{i.destination}</td>
                      <td className="tabular px-3 py-2 text-right">{naira(i.requestedMinor)}</td>
                      <td className="px-3 py-2">{i.status === "SKIPPED" ? <span title={i.skipReason}><Badge status="SKIPPED" /> <span className="text-xs text-muted">{i.skipReason}</span></span> : <Badge status="ACTIVE" className="!bg-brand-50 !text-brand-600" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap justify-between gap-2 rounded-2xl bg-canvas p-4 text-sm"><span>Will allocate <b>{naira(preview.totalAllocated)}</b></span><span>Stays in salary account <b>{naira(preview.remaining)}</b></span></div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={confirm} loading={loading} disabled={preview.totalAllocated === "0"}>Confirm and run</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export function RetryProvision() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button size="sm" variant="secondary" loading={loading} onClick={async () => { setLoading(true); setErr(null); try { await api("/api/collection-account", { method: "POST" }); router.refresh(); } catch (e) { setErr((e as ApiError).message); } finally { setLoading(false); } }}>Retry setup</Button>
      {err && <p className="text-xs text-danger">{err}</p>}
    </div>
  );
}
