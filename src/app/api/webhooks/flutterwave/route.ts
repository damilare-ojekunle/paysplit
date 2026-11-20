import { prisma, isUniqueViolation } from "@/server/db";
import { json } from "@/server/http";
import { log } from "@/server/log";
import { paymentProvider } from "@/server/providers";
import { confirmPayin, resolvePayinUser, applyTransferState } from "@/server/money-service";

export const dynamic = "force-dynamic";

/**
 * Provider webhook. Signature-checked, stored once per event (dedupe), and never trusted on its own:
 * pay-ins are re-verified with the provider API, transfers are re-fetched by reference.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const provider = paymentProvider();
  let event;
  try {
    event = provider.parseWebhook(raw, req.headers);
  } catch {
    log.warn("webhook_rejected", { provider: provider.name });
    return json({ error: "invalid signature" }, { status: 401 });
  }
  if (!event) return json({ ok: true, ignored: true });

  let record;
  try {
    record = await prisma.webhookEvent.create({ data: { provider: provider.name, eventId: event.eventId, type: event.kind, payload: JSON.parse(raw) } });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    record = await prisma.webhookEvent.findUniqueOrThrow({ where: { provider_eventId: { provider: provider.name, eventId: event.eventId } } });
    if (record.processedAt) return json({ ok: true, duplicate: true });
  }

  try {
    if (event.kind === "PAYIN") {
      const verified = await provider.verifyPayin(event.providerRef);
      if (!verified?.ok) throw new Error("Pay-in could not be verified with provider");
      const user = await resolvePayinUser({ ...event.userHint, txRef: verified.txRef ?? event.userHint.txRef, email: verified.email ?? event.userHint.email });
      if (!user) throw new Error("No user matches this pay-in");
      const isTest = (verified.txRef ?? "").startsWith("salary-");
      await confirmPayin({ userId: user.id, providerRef: event.providerRef, amountMinor: verified.amountMinor, currency: verified.currency, source: isTest ? "ADMIN_TEST" : "WEBHOOK", senderName: verified.senderName });
    } else {
      const known = await provider.getTransfer(event.reference);
      const t = await prisma.transfer.findUnique({ where: { reference: event.reference } });
      if (t && known) await applyTransferState(t.id, known.state, known.providerCode, known.message);
    }
    await prisma.webhookEvent.update({ where: { id: record.id }, data: { processedAt: new Date(), error: null } });
    return json({ ok: true });
  } catch (e) {
    await prisma.webhookEvent.update({ where: { id: record.id }, data: { error: (e as Error).message.slice(0, 300) } });
    log.error("webhook_processing_failed", { eventId: event.eventId, err: (e as Error).message });
    return json({ error: "processing failed" }, { status: 500 }); // provider will retry
  }
}
