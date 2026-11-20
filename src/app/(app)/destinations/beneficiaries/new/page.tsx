import { Card, PageHeader } from "@/components/ui";
import { BeneficiaryForm } from "@/components/destination-forms";

export default function NewBeneficiary() {
  return (
    <>
      <PageHeader title="Add beneficiary" crumbs={[{ href: "/destinations?tab=beneficiaries", label: "Destinations" }, { label: "New beneficiary" }]} />
      <Card className="p-6 sm:p-10"><BeneficiaryForm /></Card>
    </>
  );
}
