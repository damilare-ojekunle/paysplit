import Link from "next/link";
import { Logo } from "@/components/logo";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white"><div className="mx-auto flex h-[63px] max-w-[880px] items-center px-6"><Link href="/"><Logo /></Link></div></header>
      <main className="mx-auto max-w-[880px] space-y-4 px-6 py-10 text-[15px] leading-relaxed text-ink [&_h1]:text-[28px] [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-medium [&_p]:text-muted">{children}</main>
    </div>
  );
}
