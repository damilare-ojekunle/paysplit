// Provider ports. Core logic (split engine, ledger, scheduler) depends only on these
// interfaces and the normalized status sets — never on a vendor SDK or payload shape.

export type TransferState = "PENDING" | "SUCCESS" | "FAILED";
export type KycState = "IN_PROGRESS" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "ACTION_REQUIRED";

export interface CollectionAccountResult {
  status: "ACTIVE" | "PENDING" | "FAILED";
  accountNumber?: string;
  accountName?: string;
  bankName?: string;
  providerRef?: string;
  failureReason?: string;
}

export type PaymentEvent =
  | { kind: "PAYIN"; eventId: string; providerRef: string; amountMinor: bigint; currency: string; userHint: { txRef?: string; email?: string; accountNumber?: string } }
  | { kind: "TRANSFER"; eventId: string; reference: string; state: TransferState; providerCode?: string; message?: string };

export interface PaymentProvider {
  readonly name: string;
  createCollectionAccount(input: { userId: string; email: string; firstName: string; lastName: string; phone?: string | null; bvn?: string }): Promise<CollectionAccountResult>;
  listBanks(): Promise<{ code: string; name: string }[]>;
  resolveAccount(bankCode: string, accountNumber: string): Promise<{ accountName: string }>;
  /** Idempotent on `reference`. Network errors must throw ProviderUncertainError, not be treated as failure. */
  transfer(input: { reference: string; amountMinor: bigint; bankCode: string; accountNumber: string; narration: string }): Promise<{ state: TransferState; providerCode?: string; message?: string }>;
  /** Authoritative status for reconciliation. Returns null if the provider has no record of the reference. */
  getTransfer(reference: string): Promise<{ state: TransferState; providerCode?: string; message?: string } | null>;
  /** Verify a pay-in directly with the provider (never trust webhook payloads alone). */
  verifyPayin(providerRef: string): Promise<{ ok: boolean; amountMinor: bigint; currency: string; txRef?: string; email?: string; senderName?: string } | null>;
  /** Create a sandbox checkout used by admins to push a test salary pay-in through the real event flow. */
  createTestPayinLink(input: { txRef: string; amountMinor: bigint; email: string; name: string; redirectUrl: string }): Promise<{ url: string }>;
  parseWebhook(rawBody: string, headers: Headers): PaymentEvent | null;
}

export interface VerificationProvider {
  readonly name: string;
  /** Identity lookup (BVN / NIN). Never persist the raw identifier. */
  verifyIdentity(input: { idType: "BVN" | "NIN"; idNumber: string; firstName: string; lastName: string }): Promise<{ state: KycState; reference?: string; reason?: string }>;
  /** Liveness: verify a selfie image (base64) against the identity record. */
  verifyLiveness(input: { idType: "BVN" | "NIN"; idNumber: string; selfieBase64: string }): Promise<{ state: KycState; reference?: string; reason?: string }>;
}

export class ProviderUncertainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderUncertainError";
  }
}
