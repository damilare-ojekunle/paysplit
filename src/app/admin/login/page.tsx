import { LoginForm } from "@/components/auth-forms";

export default function AdminLogin() {
  return (
    <div className="hero-dark flex min-h-screen flex-col items-center justify-center p-4">
      <main role="dialog" aria-labelledby="auth-title" className="w-full max-w-[540px] rounded-[20px] bg-white px-6 pb-6 pt-6 text-ink shadow-2xl">
        <p className="mb-2 flex justify-center"><span className="rounded-full bg-ink px-2.5 py-0.5 text-xs text-white">Admin</span></p>
        <LoginForm admin />
      </main>
      <footer className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/60"><span>Paysplit {new Date().getFullYear()}</span><a href="/terms" className="hover:text-white">Terms of Use</a><a href="/privacy" className="hover:text-white">Privacy Policy</a><span>English · Nigeria</span></footer>
    </div>
  );
}
