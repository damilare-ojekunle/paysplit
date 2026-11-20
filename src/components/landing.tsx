import Link from "next/link";
import { Apple, ArrowRight, BellRing, Landmark, Play, ShieldCheck, Split } from "lucide-react";
import { Logo } from "./logo";

function StoreBadge({ store }: { store: "apple" | "google" }) {
  return (
    <span className="inline-flex h-[54px] items-center gap-2.5 rounded-xl bg-white/[0.06] px-4 text-white ring-1 ring-white/10" title="Mobile apps are coming soon">
      {store === "apple" ? <Apple size={24} fill="currentColor" strokeWidth={1} aria-hidden /> : <Play size={22} fill="currentColor" aria-hidden />}
      <span className="leading-tight"><span className="block text-[10px] text-white/70">Download on the</span><span className="text-[15px] font-medium">{store === "apple" ? "App Store" : "Google play"}</span></span>
    </span>
  );
}

/** Public landing page (Figma "Landing Page"). Sign-in and sign-up open as pop-ups over it. */
export function Landing() {
  return (
    <div className="bg-black text-white">
      <section className="relative min-h-[903px] overflow-hidden [background:radial-gradient(55%_60%_at_70%_75%,rgba(51,167,245,0.18),transparent_70%),radial-gradient(40%_40%_at_10%_100%,rgba(30,80,130,0.35),transparent_70%),linear-gradient(180deg,#000_0%,#05101a_60%,#0b1a28_100%)]">
        <header className="mx-auto flex h-[102px] max-w-[1440px] items-center justify-between px-6 sm:px-9">
          <Link href="/" aria-label="Paysplit home"><Logo light /></Link>
          <nav aria-label="Main" className="hidden gap-10 text-[15px] md:flex">
            <a href="#about" className="hover:text-brand">About PaySplit</a>
            <a href="#how" className="hover:text-brand">Blog</a>
            <a href="#contact" className="hover:text-brand">Contact</a>
          </nav>
          <div className="flex items-center gap-6">
            <Link href="/login" scroll={false} className="hidden items-center gap-2 text-[15px] hover:text-brand sm:flex">Login <ArrowRight size={16} /></Link>
            <Link href="/register" scroll={false} className="inline-flex h-[60px] items-center gap-2 rounded-[14px] bg-brand px-5 text-[15px] hover:bg-brand-600">Get Started <ArrowRight size={16} /></Link>
          </div>
        </header>

        <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-6 pb-20 pt-10 sm:px-9 lg:grid-cols-[520px_1fr] lg:pt-[110px]">
          <div>
            <h1 className="text-[44px] font-normal leading-[0.98] tracking-[-0.02em] sm:text-[64px]">We automate salary partitions that ignite financial clarity.</h1>
            <p className="mt-6 max-w-[440px] text-[17px] text-white/70">Set your rules once. The moment salary lands in your PaySplit account, it&apos;s split into savings wallets and sent to the people you support, with a receipt for every naira.</p>
            <div className="mt-8 flex flex-wrap gap-3"><StoreBadge store="apple" /><StoreBadge store="google" /></div>
          </div>
          <div className="relative hidden lg:block" aria-hidden>
            <div className="mx-auto w-[760px] [perspective:1800px]">
              <div className="origin-bottom rounded-t-[22px] border-[10px] border-b-0 border-[#1d1f22] bg-[#1d1f22] shadow-[0_40px_120px_rgba(0,0,0,0.6)] [transform:rotateX(8deg)_rotateY(-12deg)_rotateZ(-2deg)]">
                <div className="mx-auto mb-1 h-3 w-24 rounded-b-lg bg-black" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/landing/dashboard.webp" alt="" width={1152} height={720} className="block w-full rounded-[4px]" />
              </div>
              <div className="relative -mt-1 h-5 rounded-b-[18px] bg-gradient-to-b from-[#3a3d42] to-[#16181b] [transform:rotateX(8deg)_rotateY(-12deg)_rotateZ(-2deg)]"><div className="mx-auto h-2 w-32 rounded-b-xl bg-[#0e0f11]" /></div>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="bg-canvas text-ink">
        <div className="mx-auto max-w-[1440px] px-6 py-20 sm:px-9">
          <p className="text-sm font-medium text-brand">About PaySplit</p>
          <h2 className="mt-2 max-w-2xl text-[32px] leading-tight">Every salary, routed to the right place automatically.</h2>
          <div id="how" className="mt-10 grid gap-4 md:grid-cols-4">
            {[
              { icon: Landmark, t: "Your own salary account", b: "A dedicated account number for your employer to pay into." },
              { icon: Split, t: "Rules you control", b: "Fixed amounts or percentages, in the order you choose." },
              { icon: BellRing, t: "Every move recorded", b: "A double-entry ledger, receipts and instant notifications." },
              { icon: ShieldCheck, t: "Verified and secure", b: "BVN/NIN and selfie checks before any money moves." },
            ].map(({ icon: Icon, t, b }) => (
              <div key={t} className="kpi-card rounded-2xl p-6"><Icon className="text-brand" size={26} /><h3 className="mt-6 text-lg">{t}</h3><p className="mt-2 text-sm text-muted">{b}</p></div>
            ))}
          </div>
        </div>
      </section>

      <footer id="contact" className="border-t border-white/10 bg-black">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-6 py-10 text-sm text-white/60 sm:px-9">
          <Logo light />
          <p>Questions? <a href="mailto:support@paysplit.test" className="text-brand hover:underline">support@paysplit.test</a></p>
          <p>Sandbox environment · no real money moves</p>
        </div>
      </footer>
    </div>
  );
}
