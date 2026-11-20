import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { route, json } from "@/server/http";
import { audit } from "@/server/notify";

/** Personal data export (privacy). Excludes secrets and hashes. */
export const GET = route(async () => {
  const u = await requireUser();
  const data = await prisma.user.findUniqueOrThrow({
    where: { id: u.id },
    select: {
      email: true, firstName: true, lastName: true, country: true, phone: true, kycStatus: true, salaryDay: true, createdAt: true,
      kyc: { select: { idType: true, idNumberMasked: true, status: true, createdAt: true } },
      collectionAccount: { select: { accountNumber: true, bankName: true, accountName: true, status: true } },
      wallets: { select: { name: true, category: true, targetMinor: true, createdAt: true } },
      beneficiaries: { select: { name: true, category: true, bankName: true, accountNumber: true, accountName: true, createdAt: true } },
      rules: { select: { name: true, method: true, amountMinor: true, percentBps: true, priority: true, status: true } },
      payins: { select: { amountMinor: true, receivedAt: true, providerRef: true } },
      transfers: { select: { amountMinor: true, reference: true, status: true, createdAt: true } },
    },
  });
  await audit(u.id, "privacy.export", { type: "User", id: u.id });
  return json(data, { headers: { "Content-Disposition": `attachment; filename="paysplit-data-${new Date().toISOString().slice(0, 10)}.json"` } });
});
