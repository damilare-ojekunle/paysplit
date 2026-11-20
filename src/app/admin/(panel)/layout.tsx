import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { TopNav } from "@/components/top-nav";

export const dynamic = "force-dynamic";
const LINKS = [{ href: "/admin", label: "Overview" }, { href: "/admin/payins", label: "Salary pay-ins" }, { href: "/admin/settings", label: "Settings" }];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "ADMIN") redirect("/dashboard");
  return (
    <>
      <TopNav name={`${user.firstName} (admin)`} links={LINKS} />
      <main id="main" className="mx-auto max-w-[1360px] px-4 pb-16 sm:px-6">{children}</main>
    </>
  );
}
