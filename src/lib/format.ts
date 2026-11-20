import { formatMinor } from "@/core/money";
export const naira = (minor: bigint | string | number) => formatMinor(BigInt(minor));
export const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" });
export const fmtDateTime = (d: Date | string) => new Date(d).toLocaleString("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
export const maskAcct = (n: string) => `••••${n.slice(-4)}`;
