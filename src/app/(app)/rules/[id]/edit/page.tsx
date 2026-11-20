import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { requireVerifiedUser } from "@/server/auth";
import { destinationOptions, ruleForForm } from "@/server/rule-page-data";
import { Card, PageHeader } from "@/components/ui";
import { RuleForm } from "@/components/rule-form";

export default async function EditRule({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireVerifiedUser();
  const r = await prisma.splitRule.findFirst({ where: { id: (await params).id, userId: user.id } });
  if (!r) notFound();
  return (
    <>
      <PageHeader title="Reconfigure rule" crumbs={[{ href: "/rules", label: "Split Rules" }, { label: r.name }]} />
      <Card className="p-6 sm:p-10"><RuleForm destinations={await destinationOptions(user.id)} kycOk={user.kycStatus === "APPROVED"} existing={ruleForForm(r)} /></Card>
    </>
  );
}
