import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={clsx("rounded-[var(--radius-card)] border border-line bg-white", className)} {...p} />;
}

const btn = {
  primary: "bg-brand text-white hover:bg-brand-600 disabled:bg-brand/50",
  secondary: "bg-white text-ink border border-line hover:bg-canvas disabled:opacity-50",
  dark: "bg-navy text-white hover:bg-black disabled:opacity-50",
  danger: "bg-white text-danger border border-danger/30 hover:bg-danger-50 disabled:opacity-50",
  ghost: "text-brand hover:bg-brand-50 disabled:opacity-50",
};
type BtnProps = { variant?: keyof typeof btn; size?: "sm" | "md" | "lg"; loading?: boolean };
const sizes = { sm: "h-9 px-3 text-sm", md: "h-11 px-4 text-sm", lg: "h-12 px-5 text-base w-full" };

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...p }: ComponentProps<"button"> & BtnProps) {
  return (
    <button className={clsx("inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed", btn[variant], sizes[size], className)} disabled={disabled || loading} aria-busy={loading || undefined} {...p}>
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({ variant = "primary", size = "md", className, ...p }: ComponentProps<typeof Link> & BtnProps) {
  return <Link className={clsx("inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors", btn[variant], sizes[size], className)} {...p} />;
}

export function Field({ label, error, hint, children, id }: { label: string; error?: string; hint?: string; children: ReactNode; id: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

const control = "w-full rounded-xl border border-line bg-white px-3.5 h-12 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 aria-[invalid=true]:border-danger";
export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input className={clsx(control, className)} {...p} />;
}
export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select className={clsx(control, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22><path d=%22m4 6 4 4 4-4%22/></svg>')] bg-[right_14px_center] bg-no-repeat pr-10", className)} {...p} />;
}

const tone: Record<string, string> = {
  SUCCESS: "bg-success-50 text-success", ACTIVE: "bg-success-50 text-success", APPROVED: "bg-success-50 text-success",
  PENDING: "bg-warn-50 text-warn", RETRYING: "bg-warn-50 text-warn", IN_PROGRESS: "bg-warn-50 text-warn", PENDING_REVIEW: "bg-warn-50 text-warn", PARTIAL: "bg-warn-50 text-warn", DRAFT: "bg-canvas text-muted", PAUSED: "bg-canvas text-muted",
  FAILED: "bg-danger-50 text-danger", REJECTED: "bg-danger-50 text-danger", ACTION_REQUIRED: "bg-danger-50 text-danger", SKIPPED: "bg-canvas text-muted", REVERSED: "bg-canvas text-muted", NOT_STARTED: "bg-canvas text-muted",
};
const words: Record<string, string> = { PARTIAL: "Partially completed", IN_PROGRESS: "In progress", PENDING_REVIEW: "Pending review", ACTION_REQUIRED: "Action required", NOT_STARTED: "Not started" };
export function Badge({ status, className }: { status: string; className?: string }) {
  const label = words[status] ?? status.charAt(0) + status.slice(1).toLowerCase();
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tone[status] ?? "bg-canvas text-muted", className)}>{label}</span>;
}

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
  const c = { info: "bg-brand-50 text-brand-600 border-brand/20", warn: "bg-warn-50 text-warn border-warn/20", danger: "bg-danger-50 text-danger border-danger/20", success: "bg-success-50 text-success border-success/20" }[t];
  return <div role={t === "danger" ? "alert" : "status"} className={clsx("rounded-xl border px-4 py-3 text-sm", c, className)}>{children}</div>;
}

export function PageHeader({ title, crumbs, action }: { title: string; crumbs?: { href?: string; label: string }[]; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6 pt-6">
      <div>
        <h1 className="text-2xl font-medium text-ink">{title}</h1>
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mt-1 text-sm text-muted">
            {crumbs.map((c, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-1.5">/</span>}
                {c.href ? <Link href={c.href} className="text-brand hover:underline">{c.label}</Link> : c.label}
              </span>
            ))}
          </nav>
        )}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-lg bg-line/60", className)} aria-hidden />;
}
