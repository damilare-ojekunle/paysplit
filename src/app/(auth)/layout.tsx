import Link from "next/link";
import { X } from "lucide-react";
import { Landing } from "@/components/landing";

/** Auth screens are pop-ups over the landing page, as in Figma. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div aria-hidden inert className="pointer-events-none select-none"><Landing /></div>
      <div className="fixed inset-0 z-40 overflow-y-auto bg-black/45 backdrop-blur-[3px]">
        <div className="flex min-h-full items-center justify-center p-4">
          <main role="dialog" aria-modal="true" aria-labelledby="auth-title" className="relative w-full max-w-[540px] rounded-[20px] bg-white px-6 pb-6 pt-6 text-ink shadow-2xl">
            <Link href="/" aria-label="Close" className="absolute right-4 top-4 grid size-11 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-ink"><X size={22} /></Link>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
