import { requireAdmin } from "@/server/auth";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { AdminProfileForm } from "./form";

export default async function AdminSettings() {
  const a = await requireAdmin();
  return (
    <>
      <PageHeader title="Admin settings" />
      <Card className="max-w-2xl p-6 sm:p-8">
        <AdminProfileForm initial={{ firstName: a.firstName, lastName: a.lastName, phone: a.phone ?? "" }} />
        <div className="mt-8 border-t border-line pt-6"><h2 className="font-medium">Password</h2><p className="mb-3 text-sm text-muted">We'll email you a secure reset link.</p><LinkButton href="/forgot-password" variant="secondary" size="sm">Change password</LinkButton></div>
      </Card>
    </>
  );
}
