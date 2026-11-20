import clsx from "clsx";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleDollarSign, Search } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

/* ---------------------------------------------------------------- surfaces */

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={clsx("rounded-[var(--radius-card)] border border-line bg-white", className)} {...p} />;
}

/** Large white page container with a light border (Figma: 24px radius, 16px inset). */
export function Panel({ className, ...p }: ComponentProps<"section">) {
  return <section className={clsx("rounded-[var(--radius-panel)] border border-line bg-white p-2 sm:p-4", className)} {...p} />;
}

/** Light-blue gradient summary card used at the top of panels. */
export function HeroCard({ className, ...p }: ComponentProps<"div">) {
  return <div className={clsx("kpi-card rounded-[20px] p-5 sm:p-[30px]", className)} {...p} />;
}

/** Grey panel holding a titled white table card (Figma "All Salary Rules", "Transaction & Splits History"). */
export function TablePanel({ title, tools, footer, children, className }: { title: ReactNode; tools?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-[20px] border border-line-2 bg-panel-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <h2 className="text-lg text-ink">{title}</h2>
        {tools && <div className="flex flex-wrap items-center gap-3">{tools}</div>}
      </div>
      <div className="mx-2 overflow-hidden rounded-2xl border border-line bg-white">{children}</div>
      {footer && <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-muted sm:px-[18px]">{footer}</div>}
      {!footer && <div className="h-2" />}
    </section>
  );
}

/* ---------------------------------------------------------------- tables */

export const th = "h-12 px-3 text-left text-[13px] font-normal text-muted first:pl-5 last:pr-5";
export const td = "h-[50px] px-3 text-sm text-ink first:pl-5 last:pr-5";

export function Table({ head, children, className }: { head: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={clsx("w-full min-w-[720px] border-collapse", className)}>
        <thead className="border-b border-line"><tr>{head}</tr></thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-0">{children}</tbody>
      </table>
    </div>
  );
}

export function Checkbox(p: ComponentProps<"input">) {
  return <input type="checkbox" className="size-[15px] rounded-[4px] border border-line accent-brand align-middle" {...p} />;
}

/* ---------------------------------------------------------------- filters */

export function SearchBox({ name = "q", defaultValue, placeholder = "Search", action, hidden }: { name?: string; defaultValue?: string; placeholder?: string; action?: string; hidden?: Record<string, string | undefined> }) {
  return (
    <form action={action} role="search" className="relative">
      {hidden && Object.entries(hidden).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <Search size={18} strokeWidth={1.6} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" aria-hidden />
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} aria-label={placeholder} className="h-10 w-36 rounded-xl border border-line bg-transparent pl-11 pr-3 text-sm placeholder:text-muted focus:w-56 focus:border-brand focus:bg-white focus:outline-none" />
    </form>
  );
}

/** Segmented tabs rendered as links (works without JS). */
export function Segmented({ items, active, label }: { items: { key: string; label: string; href: string }[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="flex rounded-xl border border-line bg-panel p-1">
      {items.map((i) => (
        <Link key={i.key} href={i.href} aria-current={i.key === active ? "true" : undefined} className={clsx("rounded-lg px-2 py-1.5 text-sm", i.key === active ? "bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-ink hover:text-brand")}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  const nums: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) if (p <= 5 || p === pages || Math.abs(p - page) <= 1) nums.push(p); else if (nums[nums.length - 1] !== "…") nums.push("…");
  const arrow = "grid size-8 place-items-center rounded-full";
  return (
    <nav aria-label="Pagination" className="flex items-center gap-1.5 text-sm">
      {page > 1 ? <Link href={href(page - 1)} aria-label="Previous page" className={clsx(arrow, "bg-panel text-ink")}><ChevronLeft size={16} /></Link> : <span className={clsx(arrow, "text-subtle/60")} aria-hidden><ChevronLeft size={16} /></span>}
      {nums.map((n, i) => n === "…" ? <span key={i} className="px-1.5 text-ink">…</span> : (
        <Link key={i} href={href(n)} aria-current={n === page ? "page" : undefined} className={clsx("grid h-8 min-w-8 place-items-center rounded-full px-2", n === page ? "bg-ink text-white" : "text-ink hover:bg-panel")}>{n}</Link>
      ))}
      {page < pages ? <Link href={href(page + 1)} aria-label="Next page" className={clsx(arrow, "bg-panel text-ink")}><ChevronRight size={16} /></Link> : <span className={clsx(arrow, "text-subtle/60")} aria-hidden><ChevronRight size={16} /></span>}
    </nav>
  );
}

/* ---------------------------------------------------------------- pills */

export function CategoryPill({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center whitespace-nowrap rounded-lg border border-line bg-white px-2.5 py-1 text-sm text-ink shadow-[0_1px_1px_rgba(0,0,0,0.03)]">{children}</span>;
}

const tone: Record<string, string> = {
  SUCCESS: "bg-success-50 text-success-ink", ACTIVE: "bg-success-50 text-success-ink", APPROVED: "bg-success-50 text-success-ink", COMPLETED: "bg-success-50 text-success-ink", VERIFIED: "bg-success-50 text-success-ink",
  PENDING: "bg-warn-50 text-warn", RETRYING: "bg-warn-50 text-warn", IN_PROGRESS: "bg-warn-50 text-warn", PENDING_REVIEW: "bg-warn-50 text-warn", PARTIAL: "bg-warn-50 text-warn",
  DRAFT: "bg-panel text-muted", PAUSED: "bg-panel text-muted", SKIPPED: "bg-panel text-muted", REVERSED: "bg-panel text-muted", NOT_STARTED: "bg-panel text-muted", INACTIVE: "bg-panel text-muted",
  FAILED: "bg-danger-50 text-danger-ink", REJECTED: "bg-danger-50 text-danger-ink", ACTION_REQUIRED: "bg-danger-50 text-danger-ink", UNAVAILABLE: "bg-danger-50 text-danger-ink", SUSPENDED: "bg-danger-50 text-danger-ink",
};
const words: Record<string, string> = { PARTIAL: "Partially completed", IN_PROGRESS: "In progress", PENDING_REVIEW: "Pending review", ACTION_REQUIRED: "Action required", NOT_STARTED: "Not started" };
export function Badge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const text = label ?? words[status] ?? status.charAt(0) + status.slice(1).toLowerCase();
  return <span className={clsx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-medium leading-none", tone[status] ?? "bg-panel text-muted", className)}>{text}</span>;
}

/** Round money icon used in activity rows; colour by flow kind. */
export function FlowIcon({ kind }: { kind: "wallet" | "out" | "in" }) {
  const c = { wallet: "bg-brand-50 text-brand", out: "bg-danger-50 text-[#e5484d]", in: "bg-success-50 text-success" }[kind];
  return <span className={clsx("grid size-[22px] shrink-0 place-items-center rounded-full", c)} aria-hidden><CircleDollarSign size={14} strokeWidth={2} /></span>;
}

export function amountClass(kind: "wallet" | "out" | "in") {
  return { wallet: "text-brand", out: "text-[#d6463a]", in: "text-success" }[kind];
}

/* ---------------------------------------------------------------- controls */

const btn = {
  primary: "bg-brand text-white hover:bg-brand-600 disabled:bg-brand/50",
  secondary: "bg-white text-ink border border-line hover:bg-panel-2 disabled:opacity-50",
  outline: "bg-white text-brand border border-brand hover:bg-brand-50 disabled:opacity-50",
  dark: "bg-ink text-white hover:bg-black disabled:opacity-50",
  danger: "bg-white text-danger border border-danger/30 hover:bg-danger-50 disabled:opacity-50",
  ghost: "text-brand hover:bg-brand-50 disabled:opacity-50",
};
type BtnProps = { variant?: keyof typeof btn; size?: "sm" | "md" | "lg" | "xl"; loading?: boolean };
const sizes = { sm: "h-9 px-3 text-sm rounded-[10px]", md: "h-11 px-4 text-sm rounded-xl", lg: "h-[52px] px-5 text-base w-full rounded-xl", xl: "h-[60px] px-5 text-[15px] rounded-[14px]" };

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...p }: ComponentProps<"button"> & BtnProps) {
  return (
    <button className={clsx("inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:cursor-not-allowed", btn[variant], sizes[size], className)} disabled={disabled || loading} aria-busy={loading || undefined} {...p}>
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({ variant = "primary", size = "md", className, ...p }: ComponentProps<typeof Link> & BtnProps) {
  return <Link className={clsx("inline-flex items-center justify-center gap-2 font-medium transition-colors", btn[variant], sizes[size], className)} {...p} />;
}

export function Field({ label, error, hint, children, id }: { label: string; error?: string; hint?: string; children: ReactNode; id: string }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm text-ink">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export const control = "w-full rounded-[10px] border border-line bg-white px-3.5 h-[52px] text-[15px] text-ink placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 aria-[invalid=true]:border-danger disabled:bg-panel-2 disabled:text-muted";
export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input className={clsx(control, className)} {...p} />;
}
export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select className={clsx(control, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2218%22 height=%2218%22 fill=%22none%22 stroke=%22%23171918%22 stroke-width=%221.6%22><path d=%22m4.5 7 4.5 4.5L13.5 7%22/></svg>')] bg-[right_14px_center] bg-no-repeat pr-10", className)} {...p} />;
}

/* ---------------------------------------------------------------- feedback */

export function Empty({ title, body, action, icon }: { title: string; body: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="mb-1 text-brand">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      <p className="max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Alert({ tone: t = "info", children, className }: { tone?: "info" | "warn" | "danger" | "success"; children: ReactNode; className?: string }) {
  const c = { info: "bg-brand-50 text-[#1673b3] border-brand/20", warn: "bg-warn-50 text-warn border-warn/20", danger: "bg-danger-50 text-danger-ink border-danger/20", success: "bg-success-50 text-success-ink border-success/20" }[t];
  return <div role={t === "danger" ? "alert" : "status"} className={clsx("rounded-xl border px-4 py-3 text-sm", c, className)}>{children}</div>;
}

export function PageHeader({ title, crumbs, action }: { title: string; crumbs?: { href?: string; label: string }[]; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pb-5 pt-6">
      <div>
        <h1 className="text-[22px] leading-tight text-ink">{title}</h1>
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mt-2.5 text-sm text-muted">
            {crumbs.map((c, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-2 text-subtle">/</span>}
                {c.href ? <Link href={c.href} className="text-brand hover:underline">{c.label}</Link> : c.label}
              </span>
            ))}
          </nav>
        )}
      </div>
      {action && <div className="flex flex-wrap gap-3">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-lg bg-line/60", className)} aria-hidden />;
}
