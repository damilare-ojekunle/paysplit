import { LoginForm } from "@/components/auth-forms";

export default function AdminLogin() {
  return (
    <div className="hero-dark grid min-h-screen place-items-center p-4">
      <main role="dialog" aria-labelledby="auth-title" className="w-full max-w-[540px] rounded-[20px] bg-white px-6 pb-6 pt-6 text-ink shadow-2xl">
        <p className="mb-2 flex justify-center"><span className="rounded-full bg-ink px-2.5 py-0.5 text-xs text-white">Admin</span></p>
        <LoginForm admin />
      </main>
    </div>
  );
}
