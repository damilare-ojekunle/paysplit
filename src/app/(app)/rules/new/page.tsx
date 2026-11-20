import { requireVerifiedUser } from "@/server/auth";
import { destinationOptions } from "@/server/rule-page-data";
import { Card, PageHeader } from "@/components/ui";
import { RuleForm } from "@/components/rule-form";

export default async function NewRule({ searchParams }: { searchParams: Promise<{ type?: string; dest?: string }> }) {
  const user = await requireVerifiedUser();
  return (
    <>
      <PageHeader title="Add new rule" crumbs={[{ href: "/rules", label: "Split Rules" }, { label: "New rule" }]} />
      <Card className="p-6 sm:p-10"><RuleForm destinations={await destinationOptions(user.id)} preset={await searchParams} kycOk={user.kycStatus === "APPROVED"} /></Card>
    </>
  );
}
