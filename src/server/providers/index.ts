// Region router: picks adapters from the user's country. Core code imports only from here.
import { dojah } from "./dojah";
import { flutterwave } from "./flutterwave";
import type { PaymentProvider, VerificationProvider } from "./types";

const verificationByRegion: Record<string, VerificationProvider> = {
  NG: dojah,
  // International adapter (e.g. Persona / Didit) plugs in here behind the same interface.
};

export function verificationProviderFor(country: string | null | undefined): VerificationProvider {
  const p = verificationByRegion[(country || "").toUpperCase()];
  if (!p) throw new Error(`Identity verification is not yet supported for ${country || "this country"}`);
  return p;
}

export function paymentProvider(): PaymentProvider {
  return flutterwave;
}

export const SUPPORTED_COUNTRIES = [{ code: "NG", name: "Nigeria", dial: "+234", currency: "NGN" }];
