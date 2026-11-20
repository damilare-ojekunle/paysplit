import { Logo } from "@/components/logo";
import { LoginForm } from "@/components/auth-forms";

export default function AdminLogin() {
  return (
    <div className="grid min-h-screen place-items-center bg-navy p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8">
        <Logo className="mb-2" />
        <p className="mb-6 inline-block rounded-full bg-navy px-2.5 py-0.5 text-xs text-white">Admin</p>
        <LoginForm admin />
      </div>
    </div>
  );
}
