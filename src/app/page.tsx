import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { Landing } from "@/components/landing";

export default async function Home() {
  const u = await currentUser();
  if (u) redirect(u.role === "ADMIN" ? "/admin" : "/dashboard");
  return <Landing />;
}
