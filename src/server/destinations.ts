import { z } from "zod";
import { HttpError } from "./http";
import { parseMajor } from "@/core/money";
import { paymentProvider } from "./providers";
import { prisma } from "./db";
import { BENEFICIARY_CATEGORIES, amountMajor, percent } from "./validation";

export const BeneficiarySchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.enum(BENEFICIARY_CATEGORIES),
  bankCode: z.string().min(2).max(10),
  accountNumber: z.string().regex(/^\d{10}$/, "Account number must be 10 digits"),
  narration: z.string().trim().max(100).optional(),
});

export async function validatedAccount(bankCode: string, accountNumber: string) {
  const provider = paymentProvider();
  const banks = await provider.listBanks();
  const bank = banks.find((b) => b.code === bankCode);
  if (!bank) throw new HttpError(422, "Select a supported bank");
  try {
    const { accountName } = await provider.resolveAccount(bankCode, accountNumber);
    return { bankName: bank.name, accountName };
  } catch {
    throw new HttpError(422, "We couldn't verify that account. Check the bank and account number.");
  }
}


export const RuleSchema = z.object({
  name: z.string().trim().min(1).max(80),
  destinationType: z.enum(["WALLET", "BENEFICIARY"]),
  destinationId: z.string().min(1),
  method: z.enum(["FIXED", "PERCENT"]),
  value: z.string().trim(),
  priority: z.number().int().min(1).max(10),
  activate: z.boolean().default(false),
  conditionType: z.enum(["ANY", "MIN_AMOUNT", "SENDER"]).default("ANY"),
  conditionMin: z.string().trim().optional(),
  conditionSender: z.string().trim().max(120).optional(),
  executionMode: z.enum(["EACH_INFLOW", "MONTHLY_TARGET"]).default("EACH_INFLOW"),
  monthlyTarget: z.string().trim().optional(),
});

/** Validate condition/mode inputs into DB columns. Each choice must carry exactly the value it needs. */
export function parseConditions(b: { conditionType?: "ANY" | "MIN_AMOUNT" | "SENDER"; conditionMin?: string; conditionSender?: string; executionMode?: "EACH_INFLOW" | "MONTHLY_TARGET"; monthlyTarget?: string }) {
  const out: { conditionType?: "ANY" | "MIN_AMOUNT" | "SENDER"; conditionMinMinor?: bigint | null; conditionSender?: string | null; executionMode?: "EACH_INFLOW" | "MONTHLY_TARGET"; monthlyTargetMinor?: bigint | null } = {};
  if (b.conditionType) {
    out.conditionType = b.conditionType;
    out.conditionMinMinor = null; out.conditionSender = null;
    if (b.conditionType === "MIN_AMOUNT") {
      let v: bigint;
      try { v = parseMajor(b.conditionMin ?? ""); } catch { throw new HttpError(422, "Enter the minimum salary amount, e.g. 100,000"); }
      if (v <= 0n) throw new HttpError(422, "Minimum amount must be greater than zero");
      out.conditionMinMinor = v;
    }
    if (b.conditionType === "SENDER") {
      if (!b.conditionSender || b.conditionSender.length < 2) throw new HttpError(422, "Enter the sender's account name");
      out.conditionSender = b.conditionSender;
    }
  }
  if (b.executionMode) {
    out.executionMode = b.executionMode;
    out.monthlyTargetMinor = null;
    if (b.executionMode === "MONTHLY_TARGET") {
      let v: bigint;
      try { v = parseMajor(b.monthlyTarget ?? ""); } catch { throw new HttpError(422, "Enter the monthly target amount, e.g. 200,000"); }
      if (v <= 0n) throw new HttpError(422, "Monthly target must be greater than zero");
      out.monthlyTargetMinor = v;
    }
  }
  return out;
}

export function parseValue(method: "FIXED" | "PERCENT", value: string) {
  const r = method === "FIXED" ? amountMajor.safeParse(value) : percent.safeParse(value);
  if (!r.success) throw new HttpError(422, r.error.issues[0].message);
  return method === "FIXED" ? { amountMinor: r.data as bigint, percentBps: null } : { amountMinor: null, percentBps: r.data as number };
}

/** Active percentage rules can never exceed 100% of salary combined. */
export async function assertPercentBudget(userId: string, addBps: number, excludeRuleId?: string) {
  const agg = await prisma.splitRule.aggregate({ where: { userId, status: "ACTIVE", method: "PERCENT", id: excludeRuleId ? { not: excludeRuleId } : undefined }, _sum: { percentBps: true } });
  if ((agg._sum.percentBps ?? 0) + addBps > 10000) throw new HttpError(422, "Your active percentage rules would add up to more than 100% of your salary");
}

