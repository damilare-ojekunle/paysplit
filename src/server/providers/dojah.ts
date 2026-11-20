import { env } from "../env";
import { ProviderUncertainError, type VerificationProvider } from "./types";

// Dojah (Nigeria): BVN / NIN lookup + selfie verification against the identity photo + liveness.
const base = () => env.DOJAH_BASE_URL || "https://sandbox.dojah.io";

async function call<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  if (!env.DOJAH_APP_ID || !env.DOJAH_SECRET_KEY) throw new ProviderUncertainError("Verification provider is not configured");
  let res: Response;
  try {
    res = await fetch(base() + path, {
      ...init,
      headers: { AppId: env.DOJAH_APP_ID || "", Authorization: env.DOJAH_SECRET_KEY || "", "Content-Type": "application/json", ...(init.headers || {}) },
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new ProviderUncertainError(`Dojah unreachable: ${(e as Error).message}`);
  }
  if (res.status >= 500) throw new ProviderUncertainError(`Dojah ${res.status}`);
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(body.error || body.message || `Dojah error ${res.status}`);
  return body.entity as T;
}

const norm = (s?: string) => (s || "").trim().toLowerCase();

export const dojah: VerificationProvider = {
  name: "dojah",

  async verifyIdentity({ idType, idNumber, firstName, lastName }) {
    const path = idType === "BVN" ? `/api/v1/kyc/bvn/full?bvn=${idNumber}` : `/api/v1/kyc/nin?nin=${idNumber}`;
    try {
      const e = await call(path);
      const fn = norm(e.first_name || e.firstname);
      const ln = norm(e.last_name || e.surname || e.lastname);
      if (!fn && !ln) return { state: "REJECTED", reason: "Identity record not found" };
      // Sandbox returns fixed test identities, so a name mismatch is surfaced but not blocking there.
      const nameMatches = fn === norm(firstName) || ln === norm(lastName);
      if (!nameMatches && !base().includes("sandbox")) return { state: "ACTION_REQUIRED", reason: "Name does not match identity record" };
      return { state: "IN_PROGRESS", reference: `${idType}:${idNumber.slice(-4)}` };
    } catch (err) {
      if (err instanceof ProviderUncertainError) throw err;
      return { state: "REJECTED", reason: (err as Error).message };
    }
  },

  async verifyLiveness({ idType, idNumber, selfieBase64 }) {
    const image = selfieBase64.replace(/^data:image\/\w+;base64,/, "");
    try {
      const live = await call("/api/v1/ml/liveness", { method: "POST", body: JSON.stringify({ image }) }).catch((e) => {
        if (e instanceof ProviderUncertainError) throw e;
        return null; // liveness model not available on this plan — fall through to selfie match
      });
      if (live && live.liveness && live.liveness.liveness_check === false) return { state: "REJECTED", reason: "Liveness check failed — please retake in good light" };

      const path = idType === "BVN" ? "/api/v1/kyc/bvn/verify" : "/api/v1/kyc/nin/verify";
      const key = idType === "BVN" ? "bvn" : "nin";
      const e = await call(path, { method: "POST", body: JSON.stringify({ [key]: idNumber, selfie_image: image }) });
      const match = e.selfie_verification?.match ?? e.selfie_verification?.confidence_value >= 90;
      if (match) return { state: "APPROVED", reference: e.selfie_verification?.confidence_value?.toString() };
      return { state: "REJECTED", reason: "Selfie did not match identity record" };
    } catch (err) {
      if (err instanceof ProviderUncertainError) throw err;
      return { state: "REJECTED", reason: (err as Error).message };
    }
  },
};
