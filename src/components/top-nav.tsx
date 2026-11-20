"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, LogOut, Search, Settings, X } from "lucide-react";
import clsx from "clsx";
import { Logo } from "./logo";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

type N = { id: string; title: string; body: string; createdAt: string; readAt: string | null };

export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-[#1b6fa8] font-semibold text-white" style={{ width: size, height: size, fontSize: Math.max(9, size * 0.38) }}>
      {initials}
    </span>
  );
}

export function TopNav({ name, links, searchHref = "/transactions" }: { name: string; links: { href: string; label: string }[]; searchHref?: string }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState<null | "bell" | "user" | "search">(null);
  const [q, setQ] = useState("");
  const [notes, setNotes] = useState<{ items: N[]; unread: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => api<{ items: N[]; unread: number }>("/api/notifications").then(setNotes).catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => { clearInterval(t); document.removeEventListener("click", close); document.removeEventListener("keydown", esc); };
  }, []);

  async function openBell() {
    setOpen(open === "bell" ? null : "bell");
    if (notes?.unread) { await api("/api/notifications/read", { method: "POST" }).catch(() => {}); setNotes({ ...notes, unread: 0 }); }
  }

  const iconBtn = "relative grid size-10 place-items-center rounded-xl border border-line bg-white text-ink hover:bg-panel-2";

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white">
      <div className="mx-auto flex h-[63px] max-w-[1440px] items-center gap-4 px-4 sm:px-9" ref={ref}>
        <Link href={links[0].href} aria-label="Paysplit home" className="w-[216px] shrink-0"><Logo /></Link>
        <nav aria-label="Main" className="mx-auto hidden h-full md:flex">
          {links.map((l) => {
            const active = path === l.href || path.startsWith(l.href + "/");
            return (
              <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={clsx("relative flex h-full items-center px-3 text-sm", active ? "font-semibold text-ink" : "text-ink hover:text-brand")}>
                {l.label}
                {active && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t bg-brand" />}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex w-auto items-center justify-end gap-3 md:ml-0 md:w-[216px]">
          <div className="relative">
            <button onClick={() => setOpen(open === "search" ? null : "search")} aria-label="Search" aria-expanded={open === "search"} className={iconBtn}><Search size={20} strokeWidth={1.8} /></button>
            {open === "search" && (
              <form onSubmit={(e) => { e.preventDefault(); setOpen(null); router.push(`${searchHref}?q=${encodeURIComponent(q)}`); }} className="absolute right-0 mt-2 flex w-[20rem] items-center gap-2 rounded-2xl border border-line bg-white p-2 shadow-xl">
                <Search size={16} className="ml-2 text-subtle" aria-hidden />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchHref.startsWith("/admin") ? "Search users" : "Search transactions"} aria-label="Search" className="h-9 flex-1 text-sm outline-none" />
                <button type="button" onClick={() => setOpen(null)} aria-label="Close search" className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-panel"><X size={16} /></button>
              </form>
            )}
          </div>
          <div className="relative">
            <button onClick={openBell} aria-label={`Notifications${notes?.unread ? `, ${notes.unread} unread` : ""}`} aria-expanded={open === "bell"} className={iconBtn}>
              <Bell size={20} strokeWidth={1.8} />
              {!!notes?.unread && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-5 text-white">{notes.unread}</span>}
            </button>
            {open === "bell" && (
              <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white p-2 shadow-xl">
                <p className="px-3 py-2 text-sm font-semibold">Notifications</p>
                <ul className="max-h-96 overflow-auto">
                  {!notes?.items.length && <li className="px-3 py-6 text-center text-sm text-muted">You're all caught up.</li>}
                  {notes?.items.map((n) => (
                    <li key={n.id} className="rounded-xl px-3 py-2.5 hover:bg-panel-2">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-sm text-muted">{n.body}</p>
                      <p className="mt-1 text-xs text-subtle">{fmtDateTime(n.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="relative">
            <button onClick={() => setOpen(open === "user" ? null : "user")} aria-expanded={open === "user"} aria-label="Account menu" className="flex h-10 items-center gap-2 rounded-xl border border-line bg-white pl-3 pr-3.5 text-sm hover:bg-panel-2">
              <Avatar name={name} size={23} />
              <span className="max-w-24 truncate">{name}</span>
            </button>
            {open === "user" && (
              <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-line bg-white p-1.5 shadow-xl">
                {links.map((l) => <Link key={l.href} href={l.href} className="block rounded-lg px-3 py-2 text-sm hover:bg-panel-2 md:hidden">{l.label}</Link>)}
                {!path.startsWith("/admin") && <Link href="/settings" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-panel-2"><Settings size={15} /> Profile & settings</Link>}
                {path.startsWith("/admin") && <Link href="/admin/settings" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-panel-2"><Settings size={15} /> Settings</Link>}
                <button onClick={async () => { await api("/api/auth/logout", { method: "POST" }).catch(() => {}); router.push(path.startsWith("/admin") ? "/admin/login" : "/login"); router.refresh(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger-50"><LogOut size={15} /> Sign out</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
