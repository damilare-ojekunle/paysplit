export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden>
      <path d="M9.4 2h11.2L28 9.4v11.2L20.6 28H9.4L2 20.6V9.4z" fill="#33a7f5" />
      <path d="M3 27 27 3" stroke="#fff" strokeWidth="2.2" />
      <path d="M1.2 28.8 3.2 26.8M26.8 3.2l2-2" stroke="#33a7f5" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-[17px] font-medium ${light ? "text-white" : "text-ink"} ${className}`}>
      <LogoMark />
      Paysplit
    </span>
  );
}
