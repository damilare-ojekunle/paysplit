import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { json } from "@/server/http";
import { reconcile } from "@/server/money-service";
import { notify } from "@/server/notify";
import { nextSalaryDate } from "@/server/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Scheduled job (Vercel Cron): reconcile transfers, catch missed splits, check ledger, send reminders. */
export async function GET(req: Request) {
  if (!env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) return json({ error: "unauthorized" }, { status: 401 });
  const report = await reconcile();

  // Upcoming-split reminders, 2 days before the expected salary date (deduped per month).
  const users = await prisma.user.findMany({ where: { salaryDay: { not: null }, kycStatus: "APPROVED" }, select: { id: true, salaryDay: true, timezone: true } });
  let reminders = 0;
  for (const u of users) {
    const next = nextSalaryDate(u.salaryDay, u.timezone);
    if (!next) continue;
    const days = Math.round((next.getTime() - Date.now()) / 864e5);
    if (days >= 0 && days <= 2) {
      const key = `upcoming:${u.id}:${next.toISOString().slice(0, 7)}`;
      await notify(u.id, { type: "split", title: "Salary expected soon", body: `Your salary is expected around ${next.toDateString()}. Your active rules will run once it arrives.`, dedupeKey: key });
      reminders++;
    }
  }
  return json({ ...report, reminders });
}
