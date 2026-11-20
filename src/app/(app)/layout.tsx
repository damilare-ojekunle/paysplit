import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { TopNav } from "@/components/top-nav";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/destinations", label: "Destinations" },
  { href: "/rules", label: "Split Rules" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role === "ADMIN") redirect("/admin");
  if (!user.emailVerifiedAt) redirect("/verify-email");
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <TopNav name={user.firstName} links={LINKS} />
      <main id="main" className="mx-auto max-w-[1360px] px-4 pb-16 sm:px-6">{children}</main>
    </>
  );
}
