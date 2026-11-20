import { notFound } from "next/navigation";
import { requireVerifiedUser } from "@/server/auth";
import { getTransaction } from "@/server/queries";
import { PageHeader, Panel } from "@/components/ui";
import { ReceiptBody, ReceiptDownload } from "@/components/receipt";

export default async function TxDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireVerifiedUser();
  const t = await getTransaction(user.id, (await params).id);
  if (!t) notFound();
  return (
    <>
      <PageHeader title="Transaction Receipt" crumbs={[{ href: "/dashboard", label: "Dashboard" }, { href: "/transactions", label: "Transactions" }, { label: t.reference }]} action={<ReceiptDownload t={t} />} />
      <Panel className="mx-auto max-w-[560px]">
        <div className="p-2"><ReceiptBody t={t} /></div>
      </Panel>
    </>
  );
}
