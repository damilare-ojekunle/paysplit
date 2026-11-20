// Money helpers. All amounts are bigint minor units (kobo for NGN). No floats.

export type Minor = bigint;

export const CURRENCY = "NGN";

/** Parse a user-entered major-unit string ("50,000.50") into minor units. Rejects >2 decimals. */
export function parseMajor(input: string): Minor {
  const s = input.replace(/[,\s₦]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error("Invalid amount");
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole) * 100n + BigInt((frac + "00").slice(0, 2));
}

export function formatMinor(minor: Minor | number | string, currency = CURRENCY): string {
  const v = BigInt(minor);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = (abs % 100n).toString().padStart(2, "0");
  const symbol = currency === "NGN" ? "₦" : currency + " ";
  return `${neg ? "-" : ""}${symbol}${whole}${frac === "00" ? "" : "." + frac}`;
}

/** Percent string ("15", "12.5", "33.33") -> basis points (1500, 1250, 3333). */
export function parsePercentToBps(input: string): number {
  const s = input.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) throw new Error("Invalid percentage");
  const [w, f = ""] = s.split(".");
  const bps = Number(w) * 100 + Number((f + "00").slice(0, 2));
  if (bps < 1 || bps > 10000) throw new Error("Percentage must be between 0.01 and 100");
  return bps;
}

export function formatBps(bps: number): string {
  const w = Math.floor(bps / 100);
  const f = bps % 100;
  return f === 0 ? `${w}%` : `${w}.${String(f).padStart(2, "0").replace(/0$/, "")}%`;
}

/** floor(amount * bps / 10000). Rounding down guarantees allocations never exceed the base. */
export function percentOf(amount: Minor, bps: number): Minor {
  return (amount * BigInt(bps)) / 10000n;
}
