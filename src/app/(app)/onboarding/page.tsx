import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { PageHeader } from "@/components/ui";
import { KycWizard } from "./wizard";

export default async function OnboardingPage() {
  const user = await requireVerifiedUser();
  const latest = await prisma.kycVerification.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  const account = await prisma.collectionAccount.findUnique({ where: { userId: user.id } });
  return (
    <>
      <PageHeader title="Complete KYC" crumbs={[{ href: "/dashboard", label: "Dashboard" }, { label: "Onboarding" }]} />
      <KycWizard
        initial={{
          country: user.country ?? "NG",
          phone: user.phone?.replace(/^\+234/, "") ?? "",
          kycStatus: user.kycStatus,
          hasProfile: !!user.country && !!user.phone,
          verification: latest && { id: latest.id, idType: latest.idType as "BVN" | "NIN", masked: latest.idNumberMasked, identityOk: latest.identityStatus === "APPROVED", reason: latest.failureReason },
          account: account && { status: account.status, accountNumber: account.accountNumber, bankName: account.bankName, accountName: account.accountName },
        }}
      />
    </>
  );
}
