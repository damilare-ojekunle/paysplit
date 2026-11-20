import { Card, PageHeader } from "@/components/ui";
import { WalletForm } from "@/components/destination-forms";

export default function NewWallet() {
  return (
    <>
      <PageHeader title="Create new wallet" crumbs={[{ href: "/destinations", label: "Destinations" }, { label: "New wallet" }]} />
      <Card className="p-6 sm:p-10"><WalletForm /></Card>
    </>
  );
}
