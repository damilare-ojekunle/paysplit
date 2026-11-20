"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronRight, Eye, EyeOff, Landmark, Share } from "lucide-react";
import clsx from "clsx";
import { naira } from "@/lib/format";
import { Button, Input, Select } from "./ui";
import { CopyButton, Modal } from "./client-bits";

/* ---------------------------------------------------------------- hero notification carousel */

export function NotificationCarousel({ items }: { items: { id: string; title: string; body: string }[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [items.length]);
  if (!items.length) return null;
  const n = items[i];
  return (
    <div className="relative hidden h-[242px] w-[330px] lg:block" aria-live="polite">
      {/* stacked glass cards behind, as in Figma */}
      <div className="glass absolute left-[30px] top-[62px] h-[180px] w-[350px] rounded-[18px] opacity-50" aria-hidden />
      <div className="glass absolute left-[15px] top-[30px] h-[212px] w-[340px] rounded-[18px] opacity-70" aria-hidden />
      <div className="glass relative flex h-[242px] w-[330px] flex-col rounded-[18px] p-5 text-white">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2"><Bell size={14} /> Notification</span>
          <Link href="/transactions" className="flex items-center gap-1 text-brand hover:underline">View <ChevronRight size={16} /></Link>
        </div>
        <p className="mt-9 line-clamp-3 text-[17px] leading-[27px]"><span className="font-medium">{n.title}.</span> {n.body}</p>
        <div className="mt-auto flex justify-center gap-1" role="tablist" aria-label="Notifications">
          {items.map((it, k) => (
            <button key={it.id} role="tab" aria-selected={k === i} aria-label={`Notification ${k + 1}`} onClick={() => setI(k)} className={clsx("h-1 rounded-full transition-all", k === i ? "w-[30px] bg-brand" : "w-2 bg-white/25")} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- balance with eye toggle */

export function Balance({ minor }: { minor: string }) {
  const [hidden, setHidden] = useState(false);
  return (
    <p className="flex items-center gap-4">
      <span className="tabular text-[44px] font-semibold leading-none tracking-tight sm:text-[48px]">{hidden ? "₦ • • • • • •" : naira(minor)}</span>
      <button onClick={() => setHidden(!hidden)} aria-label={hidden ? "Show balance" : "Hide balance"} aria-pressed={hidden} className="text-ink hover:text-brand">
        {hidden ? <EyeOff size={26} strokeWidth={1.6} /> : <Eye size={26} strokeWidth={1.6} />}
      </button>
    </p>
  );
}

/* ---------------------------------------------------------------- account details modal */

export function AccountDetails({ account }: { account: { accountNumber: string; bankName: string; accountName: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-brand underline underline-offset-2 hover:no-underline">View Account Details</button>
      <Modal open={open} onClose={() => setOpen(false)} size="sm" icon={<Landmark size={20} />} title="Salary account details" description="Share these with your employer. Salary paid here is split automatically.">
        <dl className="space-y-4 rounded-2xl bg-panel-2 p-5">
          <div><dt className="text-xs text-muted">Account number</dt><dd className="tabular mt-1 text-[28px] font-semibold tracking-wide">{account.accountNumber}</dd></div>
          <div><dt className="text-xs text-muted">Account name</dt><dd className="mt-1 text-sm font-medium">{account.accountName}</dd></div>
          <div><dt className="text-xs text-muted">Bank name</dt><dd className="mt-1 text-sm font-medium">{account.bankName}</dd></div>
        </dl>
        <div className="mt-5 flex justify-center"><CopyButton text={`${account.accountNumber} — ${account.bankName} — ${account.accountName}`} label="Copy account details" /></div>
      </Modal>
    </>
  );
}

/* ---------------------------------------------------------------- export statement modal */

export function ExportButton({ dark = true, primary = false, label = "Export" }: { dark?: boolean; primary?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  return (
    <>
      {primary
        ? <button onClick={() => setOpen(true)} className="inline-flex h-[60px] items-center gap-2 rounded-[14px] bg-brand px-5 text-[15px] text-white hover:bg-brand-600"><Share size={17} /> {label}</button>
        : <button onClick={() => setOpen(true)} className={clsx("inline-flex h-[60px] items-center gap-2 rounded-[14px] border px-5 text-[15px]", dark ? "border-white/40 bg-black/30 text-white backdrop-blur hover:bg-white/10" : "border-line bg-white text-ink hover:bg-panel-2")}>{label} <Share size={17} /></button>}
      <Modal open={open} onClose={() => setOpen(false)} size="sm" icon={<Share size={18} />} title="Export statement" description="Download every salary, split and transfer in a date range."
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button form="export-form" type="submit" onClick={() => setTimeout(() => setOpen(false), 300)}>Download</Button></>}>
        <form id="export-form" action="/api/statements" className="grid grid-cols-2 gap-3">
          <label className="space-y-2 text-sm">From<Input type="date" name="from" defaultValue={monthAgo} max={today} /></label>
          <label className="space-y-2 text-sm">To<Input type="date" name="to" defaultValue={today} max={today} /></label>
          <label className="col-span-2 space-y-2 text-sm">Format<Select name="format" defaultValue={primary ? "csv" : "pdf"}><option value="pdf">PDF statement</option><option value="csv">CSV (spreadsheet)</option></Select></label>
        </form>
      </Modal>
    </>
  );
}

/* ---------------------------------------------------------------- cash flow chart */

type Month = { month: string; label: string; wallets: string; beneficiaries: string };

function compact(minor: number) {
  const v = minor / 100;
  if (v >= 1_000_000) return `₦${+(v / 1_000_000).toFixed(1)}m`;
  if (v >= 1000) return `₦${+(v / 1000).toFixed(0)}k`;
  return `₦${v.toFixed(0)}`;
}

export function CashFlowChart({ data }: { data: Month[] }) {
  const months = useMemo(() => data.map((d) => ({ ...d, w: Number(d.wallets), b: Number(d.beneficiaries) })), [data]);
  const lastActive = months.map((m, k) => (m.w || m.b ? k : -1)).filter((k) => k >= 0).pop() ?? months.length - 1;
  const [hover, setHover] = useState<number>(lastActive);
  const max = Math.max(1, ...months.map((m) => Math.max(m.w, m.b)));
  const step = niceStep(max / 3);
  const top = step * 3;
  const ticks = [3, 2, 1, 0, -1, -2, -3].map((k) => k * step);
  const W = 860, H = 250, L = 46, half = (H - 20) / 2, zero = 10 + half, col = (W - L) / months.length, barW = Math.min(76, col * 0.8);
  const y = (v: number) => zero - (v / top) * half;
  const m = months[hover];
  const prevTotal = hover > 0 ? months[hover - 1].w + months[hover - 1].b : 0;
  const delta = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null);
  const dw = hover > 0 ? delta(m.w, months[hover - 1].w) : null;
  const db = hover > 0 ? delta(m.b, months[hover - 1].b) : null;
  void prevTotal;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + 40}`} className="h-auto w-full" role="img" aria-label="Monthly money moved to wallets and beneficiaries">
        <defs>
          <linearGradient id="gUp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#33a7f5" stopOpacity=".16" /><stop offset="1" stopColor="#33a7f5" stopOpacity="0" /></linearGradient>
          <linearGradient id="gDown" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#171918" stopOpacity=".08" /><stop offset="1" stopColor="#171918" stopOpacity="0" /></linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#555653" : "#ececec"} strokeDasharray={t === 0 ? "6 5" : undefined} strokeWidth={t === 0 ? 1.2 : 1} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6a6b69">{t < 0 ? "-" : ""}{compact(Math.abs(t))}</text>
          </g>
        ))}
        <line x1={L} x2={L} y1={10} y2={H - 10} stroke="#e4e4e4" />
        {months.map((mm, k) => {
          const cx = L + col * k + col / 2, x = cx - barW / 2, active = k === hover;
          return (
            <g key={mm.month} onMouseEnter={() => setHover(k)} onFocus={() => setHover(k)} tabIndex={0} aria-label={`${mm.label}: ${naira(String(mm.w))} to wallets, ${naira(String(mm.b))} to beneficiaries`} className="cursor-pointer outline-none">
              <rect x={L + col * k} y={0} width={col} height={H} fill="transparent" />
              <line x1={L + col * (k + 1)} x2={L + col * (k + 1)} y1={10} y2={H - 10} stroke="#ececec" strokeDasharray="5 5" />
              {mm.w > 0 && (active
                ? <rect x={x} y={y(mm.w)} width={barW} height={zero - y(mm.w) + 8} rx="8" fill="#33a7f5" />
                : <><rect x={x} y={y(mm.w)} width={barW} height={zero - y(mm.w)} fill="url(#gUp)" /><line x1={x} x2={x + barW} y1={y(mm.w)} y2={y(mm.w)} stroke="#33a7f5" strokeWidth="2" /></>)}
              {mm.b > 0 && (active
                ? <rect x={x} y={zero} width={barW} height={y(-mm.b) - zero} rx="8" fill="#191a19" />
                : <><rect x={x} y={zero} width={barW} height={y(-mm.b) - zero} fill="url(#gDown)" /><line x1={x} x2={x + barW} y1={y(-mm.b)} y2={y(-mm.b)} stroke="#191a19" strokeWidth="2" /></>)}
              <text x={cx} y={H + 26} textAnchor="middle" fontSize="13" fill="#555653">{mm.label}</text>
            </g>
          );
        })}
        {hover >= 0 && <><line x1={L + col * (hover + 1)} x2={L + col * (hover + 1)} y1={10} y2={H - 10} stroke="#555653" strokeDasharray="5 4" strokeWidth="1.4" /><circle cx={L + col * (hover + 1)} cy={zero} r="5" fill="#fff" stroke="#33a7f5" strokeWidth="1.5" /></>}
      </svg>
      {m && (
        <div className="pointer-events-none absolute top-[6%] rounded-xl border border-line bg-white px-3 py-2.5 text-[13px] shadow-sm" style={{ left: `${Math.min(76, ((L + col * (hover + 1) + 12) / W) * 100)}%` }}>
          <p className="mb-1.5 text-muted">{new Date(m.month + "-01").toLocaleDateString("en-NG", { month: "long", year: "numeric" })}</p>
          <p className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-brand" />+{naira(String(m.w))}{dw !== null && <span className={clsx("text-[11px]", dw >= 0 ? "text-success" : "text-danger")}>{dw >= 0 ? "↑" : "↓"} {Math.abs(dw)}%</span>}</p>
          <p className="mt-1 flex items-center gap-2"><span className="size-1.5 rounded-full bg-ink" />-{naira(String(m.b))}{db !== null && <span className={clsx("text-[11px]", db >= 0 ? "text-success" : "text-danger")}>{db >= 0 ? "↑" : "↓"} {Math.abs(db)}%</span>}</p>
        </div>
      )}
    </div>
  );
}

function niceStep(raw: number) {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}
