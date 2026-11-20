import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth";
import { paymentProvider } from "@/server/providers";
import { confirmPayin, resolvePayinUser } from "@/server/money-service";
import { appUrl } from "@/server/env";
import { log } from "@/server/log";

export const dynamic = "force-dynamic";

/** Redirect target after the admin completes the sandbox checkout. Verifies with the provider; idempotent with the webhook. */
export async function GET(req: Request) {
  const admin = await requireAdmin().catch(() => null);
  const url = new URL(req.url);
  const id = url.searchParams.get("transaction_id");
  const status = url.searchParams.get("status");
  const back = (q: string) => NextResponse.redirect(`${appUrl()}/admin/payins?${q}`);
  if (!admin) return NextResponse.redirect(`${appUrl()}/admin/login`);
  if (!id || status === "cancelled") return back("result=cancelled");
  const verified = await paymentProvider().verifyPayin(id);
  if (!verified?.ok) return back("result=unverified");
  const user = await resolvePayinUser({ txRef: verified.txRef });
  if (!user) return back("result=nouser");
  try {
    const { payin } = await confirmPayin({ userId: user.id, providerRef: id, amountMinor: verified.amountMinor, currency: verified.currency, source: "ADMIN_TEST", initiatedBy: admin.id });
    return back(`result=ok&payin=${payin.id}`);
  } catch (e) {
    log.error("payin_callback_failed", { err: (e as Error).message });
    return back("result=error");
  }
}
