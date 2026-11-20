export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold text-ink ${className}`}>
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden><rect width="28" height="28" rx="8" fill="#1e9bf0" /><path d="M8 19 19 8M9.5 9.5h4M14.5 18.5h4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>
      Paysplit
    </span>
  );
}
