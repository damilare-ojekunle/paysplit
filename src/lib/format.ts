import { formatMinor } from "@/core/money";
export const naira = (minor: bigint | string | number) => formatMinor(BigInt(minor));
export const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" });
export const fmtDateTime = (d: Date | string) => new Date(d).toLocaleString("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
export const maskAcct = (n: string) => `••••${n.slice(-4)}`;
export const flowKind = (t: { direction: "in" | "out" | "internal" }): "wallet" | "out" | "in" => (t.direction === "in" ? "in" : t.direction === "out" ? "out" : "wallet");
export const fmtDateTimeBar = (d: Date | string) => {
  const x = new Date(d);
  return `${x.toLocaleDateString("en-US", { timeZone: "Africa/Lagos", month: "short", day: "numeric", year: "numeric" })} | ${x.toLocaleTimeString("en-US", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit" }).replace(" ", "")}`;
};
