import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-40 -top-40 size-[520px] rounded-full bg-brand/30 blur-3xl" aria-hidden />
        <Logo className="relative text-white [&>svg]:shrink-0" />
        <div className="relative max-w-md space-y-4">
          <h2 className="text-4xl font-medium leading-tight">Your salary, split automatically. Every pay cycle.</h2>
          <p className="text-white/70">Set rules once — savings, family, rent — and PaySplit moves the money the moment your salary lands, with a record of every naira.</p>
        </div>
        <p className="relative text-xs text-white/50">Sandbox environment · no real money moves</p>
      </aside>
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
