"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, LogOut, Settings, User } from "lucide-react";
import clsx from "clsx";
import { Logo } from "./logo";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

type N = { id: string; title: string; body: string; createdAt: string; readAt: string | null };

export function TopNav({ name, links }: { name: string; links: { href: string; label: string }[] }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState<null | "bell" | "user">(null);
  const [notes, setNotes] = useState<{ items: N[]; unread: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => api<{ items: N[]; unread: number }>("/api/notifications").then(setNotes).catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(null);
    document.addEventListener("click", close);
    return () => { clearInterval(t); document.removeEventListener("click", close); };
  }, []);

  async function openBell() {
    setOpen(open === "bell" ? null : "bell");
    if (notes?.unread) { await api("/api/notifications/read", { method: "POST" }).catch(() => {}); setNotes({ ...notes, unread: 0 }); }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-4 px-4 sm:px-6" ref={ref}>
        <Link href={links[0].href} aria-label="PaySplit home"><Logo /></Link>
        <nav aria-label="Main" className="mx-auto hidden gap-1 md:flex">
          {links.map((l) => {
            const active = path === l.href || path.startsWith(l.href + "/");
            return (
              <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={clsx("relative px-3 py-5 text-sm", active ? "font-semibold text-ink" : "text-ink/80 hover:text-ink")}>
                {l.label}
                {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" />}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <div className="relative">
            <button onClick={openBell} aria-label={`Notifications${notes?.unread ? `, ${notes.unread} unread` : ""}`} aria-expanded={open === "bell"} className="relative grid size-10 place-items-center rounded-full border border-line hover:bg-canvas">
              <Bell size={18} />
              {!!notes?.unread && <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-danger text-[10px] font-semibold text-white">{notes.unread}</span>}
            </button>
            {open === "bell" && (
              <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white p-2 shadow-xl">
                <p className="px-3 py-2 text-sm font-semibold">Notifications</p>
                <ul className="max-h-96 overflow-auto">
                  {!notes?.items.length && <li className="px-3 py-6 text-center text-sm text-muted">You're all caught up.</li>}
                  {notes?.items.map((n) => (
                    <li key={n.id} className="rounded-xl px-3 py-2.5 hover:bg-canvas">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-sm text-muted">{n.body}</p>
                      <p className="mt-1 text-xs text-muted">{fmtDateTime(n.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="relative">
            <button onClick={() => setOpen(open === "user" ? null : "user")} aria-expanded={open === "user"} className="flex h-10 items-center gap-2 rounded-full border border-line pl-1 pr-3 text-sm hover:bg-canvas">
              <span className="grid size-8 place-items-center rounded-full bg-brand-50 text-brand"><User size={16} /></span>
              {name}
            </button>
            {open === "user" && (
              <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-line bg-white p-1.5 shadow-xl">
                {links.map((l) => <Link key={l.href} href={l.href} className="block rounded-lg px-3 py-2 text-sm hover:bg-canvas md:hidden">{l.label}</Link>)}
                {!path.startsWith("/admin") && <Link href="/settings" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-canvas"><Settings size={15} /> Profile & settings</Link>}
                {path.startsWith("/admin") && <Link href="/admin/settings" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-canvas"><Settings size={15} /> Admin settings</Link>}
                <button onClick={async () => { await api("/api/auth/logout", { method: "POST" }).catch(() => {}); router.push(path.startsWith("/admin") ? "/admin/login" : "/login"); router.refresh(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger-50"><LogOut size={15} /> Sign out</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
