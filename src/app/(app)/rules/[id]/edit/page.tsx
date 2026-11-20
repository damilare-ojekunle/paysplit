import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { destinationOptions } from "@/server/rule-page-data";
import { Card, PageHeader } from "@/components/ui";
import { RuleForm } from "@/components/rule-form";

export default async function EditRule({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireVerifiedUser();
  const r = await prisma.splitRule.findFirst({ where: { id: (await params).id, userId: user.id } });
  if (!r) notFound();
  const value = r.method === "FIXED" ? (Number(r.amountMinor) / 100).toString() : (r.percentBps! / 100).toString();
  return (
    <>
      <PageHeader title="Reconfigure rule" crumbs={[{ href: "/rules", label: "Split Rules" }, { label: r.name }]} />
      <Card className="p-6 sm:p-10"><RuleForm destinations={await destinationOptions(user.id)} kycOk={user.kycStatus === "APPROVED"} existing={{ id: r.id, name: r.name, destinationType: r.destinationType, destinationId: (r.walletId || r.beneficiaryId)!, method: r.method, value, priority: r.priority, status: r.status }} /></Card>
    </>
  );
}
