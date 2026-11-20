import { z } from "zod";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { route, body, json, HttpError } from "@/server/http";
import { audit } from "@/server/notify";
import { SUPPORTED_COUNTRIES } from "@/server/providers";
import { amountMajor } from "@/server/validation";

const Schema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  country: z.string().length(2).toUpperCase().optional(),
  phone: z.string().trim().optional(),
  salaryDay: z.number().int().min(1).max(31).nullable().optional(),
  notifyEmail: z.boolean().optional(),
  employer: z.string().trim().max(80).nullable().optional(),
  monthlySalary: amountMajor.nullable().optional(),
  notifyPrefs: z.object({ email: z.record(z.enum(["salary", "split", "transfer"]), z.boolean()).optional(), inApp: z.record(z.enum(["salary", "split", "transfer"]), z.boolean()).optional() }).optional(),
  avatarUrl: z.string().max(200_000).regex(/^data:image\/(png|jpeg|webp);base64,/, "Upload a PNG, JPEG or WebP image").nullable().optional(),
});

/** Nigerian mobile: +234 followed by 10 digits starting 7/8/9 (accepts 0803…, 803…, +234803…). */
function normalisePhone(country: string, raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (country === "NG") {
    const local = digits.replace(/^234/, "").replace(/^0/, "");
    if (!/^[789][01]\d{8}$/.test(local)) throw new HttpError(422, "Enter a valid Nigerian mobile number, e.g. 803 456 7890");
    return `+234${local}`;
  }
  if (digits.length < 7 || digits.length > 15) throw new HttpError(422, "Enter a valid phone number");
  return `+${digits}`;
}

export const PATCH = route(async (req) => {
  const user = await requireVerifiedUser();
  const b = await body(req, Schema);
  const country = b.country ?? user.country;
  if (b.country && !SUPPORTED_COUNTRIES.some((c) => c.code === b.country)) throw new HttpError(422, "This country is not supported yet");
  if (b.country && user.kycStatus === "APPROVED" && b.country !== user.country) throw new HttpError(409, "Country can't be changed after verification");
  const { monthlySalary, ...rest } = b;
  const data = { ...rest, monthlySalaryMinor: monthlySalary === undefined ? undefined : monthlySalary, phone: b.phone ? normalisePhone(country || "NG", b.phone) : undefined };
  await prisma.user.update({ where: { id: user.id }, data });
  await audit(user.id, "profile.update", { type: "User", id: user.id }, { fields: Object.keys(b) });
  return json({ ok: true });
});
