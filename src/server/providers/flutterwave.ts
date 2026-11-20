import crypto from "node:crypto";
import { parseMajor } from "@/core/money";
import { env } from "../env";
import { ProviderUncertainError, type PaymentEvent, type PaymentProvider, type TransferState } from "./types";

const BASE = "https://api.flutterwave.com/v3";

async function call<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { Authorization: `Bearer ${env.FLW_SECRET_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new ProviderUncertainError(`Flutterwave unreachable: ${(e as Error).message}`);
  }
  if (res.status >= 500) throw new ProviderUncertainError(`Flutterwave ${res.status}`);
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || body.status !== "success") {
    const err = new Error(body.message || `Flutterwave error ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return body.data as T;
}

const toMajor = (minor: bigint) => Number(minor) / 100; // safe: amounts << 2^53 kobo
const toMinor = (major: number | string) => parseMajor(Number(major).toFixed(2));

function mapTransfer(status: string): TransferState {
  const s = (status || "").toUpperCase();
  if (s === "SUCCESSFUL" || s === "SUCCESS") return "SUCCESS";
  if (s === "FAILED") return "FAILED";
  return "PENDING"; // NEW, PENDING, QUEUED…
}

export const flutterwave: PaymentProvider = {
  name: "flutterwave",

  async createCollectionAccount({ userId, email, firstName, lastName, phone, bvn }) {
    try {
      const d = await call("/virtual-account-numbers", {
        method: "POST",
        body: JSON.stringify({
          email,
          is_permanent: true,
          bvn: bvn || env.FLW_SANDBOX_BVN, // permanent accounts require a BVN; sandbox accepts a test BVN
          tx_ref: `va-${userId}`,
          firstname: firstName,
          lastname: lastName,
          phonenumber: phone || undefined,
          narration: `PaySplit ${firstName} ${lastName}`,
        }),
      });
      return {
        status: d.account_number ? "ACTIVE" : "PENDING",
        accountNumber: d.account_number,
        bankName: d.bank_name,
        accountName: `PaySplit / ${firstName} ${lastName}`,
        providerRef: d.order_ref || d.flw_ref,
      };
    } catch (e) {
      if (e instanceof ProviderUncertainError) return { status: "PENDING", failureReason: "Provider temporarily unavailable" };
      return { status: "FAILED", failureReason: (e as Error).message };
    }
  },

  async listBanks() {
    const d = await call<{ code: string; name: string }[]>("/banks/NG");
    return d.map((b) => ({ code: b.code, name: b.name })).sort((a, b) => a.name.localeCompare(b.name));
  },

  async resolveAccount(bankCode, accountNumber) {
    const d = await call("/accounts/resolve", { method: "POST", body: JSON.stringify({ account_bank: bankCode, account_number: accountNumber }) });
    return { accountName: d.account_name };
  },

  async transfer({ reference, amountMinor, bankCode, accountNumber, narration }) {
    try {
      const d = await call("/transfers", {
        method: "POST",
        body: JSON.stringify({
          account_bank: bankCode,
          account_number: accountNumber,
          amount: toMajor(amountMinor),
          currency: "NGN",
          debit_currency: "NGN",
          narration: narration.slice(0, 100),
          reference,
          callback_url: env.APP_URL ? `${env.APP_URL}/api/webhooks/flutterwave` : undefined,
        }),
      });
      return { state: mapTransfer(d.status), providerCode: String(d.id), message: d.complete_message || undefined };
    } catch (e) {
      if (e instanceof ProviderUncertainError) throw e;
      // A duplicate reference means a previous attempt reached the provider — reconcile instead of failing.
      if (/reference/i.test((e as Error).message)) throw new ProviderUncertainError((e as Error).message);
      return { state: "FAILED", message: (e as Error).message };
    }
  },

  async getTransfer(reference) {
    const list = await call<any[]>(`/transfers?reference=${encodeURIComponent(reference)}`);
    const t = list?.find((x) => x.reference === reference);
    if (!t) return null;
    return { state: mapTransfer(t.status), providerCode: String(t.id), message: t.complete_message || undefined };
  },

  async verifyPayin(providerRef) {
    try {
      const d = await call(`/transactions/${encodeURIComponent(providerRef)}/verify`);
      return { ok: d.status === "successful", amountMinor: toMinor(d.amount), currency: d.currency, txRef: d.tx_ref, email: d.customer?.email };
    } catch {
      return null;
    }
  },

  async createTestPayinLink({ txRef, amountMinor, email, name, redirectUrl }) {
    const d = await call("/payments", {
      method: "POST",
      body: JSON.stringify({
        tx_ref: txRef,
        amount: toMajor(amountMinor),
        currency: "NGN",
        redirect_url: redirectUrl,
        customer: { email, name },
        customizations: { title: "PaySplit test salary pay-in" },
        payment_options: "card,banktransfer",
      }),
    });
    return { url: d.link };
  },

  parseWebhook(rawBody, headers): PaymentEvent | null {
    const sig = headers.get("verif-hash") || "";
    const expected = env.FLW_WEBHOOK_HASH || "";
    if (!expected || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      throw new Error("Invalid webhook signature");
    }
    const body = JSON.parse(rawBody);
    const event: string = body.event || body["event.type"] || "";
    const d = body.data || {};
    if (event === "charge.completed" && d.status === "successful") {
      return {
        kind: "PAYIN",
        eventId: `charge:${d.id}`,
        providerRef: String(d.id),
        amountMinor: toMinor(d.amount),
        currency: d.currency,
        userHint: { txRef: d.tx_ref, email: d.customer?.email },
      };
    }
    if (event === "transfer.completed" || /transfer/i.test(event)) {
      return { kind: "TRANSFER", eventId: `transfer:${d.id}:${d.status}`, reference: d.reference, state: mapTransfer(d.status), providerCode: String(d.id), message: d.complete_message };
    }
    return null;
  },
};
