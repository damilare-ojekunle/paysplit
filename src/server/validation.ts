import { z } from "zod";
import { parseMajor, parsePercentToBps } from "@/core/money";

export const WALLET_CATEGORIES = ["Savings", "Emergency", "Rent", "Bills", "Education", "Travel", "Investment", "Other"] as const;
export const BENEFICIARY_CATEGORIES = ["Family", "Personal", "Rent", "Utilities", "Education", "Bills", "Other"] as const;

/** Major-unit amount string → bigint minor units, validated. */
export const amountMajor = z.string().trim().transform((s, ctx) => {
  try {
    const v = parseMajor(s);
    if (v <= 0n) throw new Error();
    if (v > 100_000_000_000n) throw new Error(); // ₦1bn ceiling
    return v;
  } catch {
    ctx.addIssue({ code: "custom", message: "Enter a valid amount greater than zero" });
    return z.NEVER;
  }
});

export const percent = z.string().trim().transform((s, ctx) => {
  try {
    return parsePercentToBps(s);
  } catch (e) {
    ctx.addIssue({ code: "custom", message: (e as Error).message });
    return z.NEVER;
  }
});
