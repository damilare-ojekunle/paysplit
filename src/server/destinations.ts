import { z } from "zod";
import { HttpError } from "./http";
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
});

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

