"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu, Search, X } from "lucide-react";
import { navLinks, site } from "@/config/site";
import { emit, OPEN_PALETTE } from "@/lib/events";
import { ThemeToggle } from "@/components/theme-toggle";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 24));
  useEffect(() => setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform)), []);
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4">
      <nav
        aria-label="Main"
        className={`mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center rounded-full border border-line/70 bg-background/75 px-4 backdrop-blur-xl transition-all duration-300 md:grid-cols-[1fr_auto_1fr] ${scrolled ? "py-2 shadow-float" : "py-2.5 shadow-soft"}`}
      >
        <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label={`${site.name} home`}>
          <Image src="/icon-192.png" alt="" width={28} height={28} className="size-7 rounded-full object-cover" priority />
          <span className="truncate font-mono text-[15px] font-semibold tracking-tight">
            {site.short}
            <span className="text-muted">.api</span>
          </span>
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <li key={l.href} className="relative">
              <Link href={l.href} aria-current={isActive(l.href) ? "page" : undefined} className={`text-[13px] transition-colors ${isActive(l.href) ? "font-semibold text-foreground" : "text-muted hover:text-foreground"}`}>
                {l.label}
              </Link>
              {isActive(l.href) && <motion.span layoutId="nav-dot" className="absolute -bottom-2 left-1/2 -ml-0.5 size-1 rounded-full bg-foreground" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-end gap-1">
          <button type="button" onClick={() => emit(OPEN_PALETTE)} aria-label="Search endpoints" className="flex h-9 items-center gap-2 rounded-full px-2.5 text-muted transition-colors hover:bg-soft hover:text-foreground">
            <Search size={16} />
            <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[10px] font-medium lg:inline">{isMac ? "⌘ K" : "Ctrl K"}</kbd>
          </button>
          <ThemeToggle />
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"} className="grid size-9 place-items-center rounded-full text-muted hover:bg-soft hover:text-foreground md:hidden">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.ul initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }} transition={{ duration: 0.2 }} className="mx-auto mt-2 max-w-6xl origin-top overflow-hidden rounded-3xl border border-line/70 bg-background/95 p-2 shadow-float backdrop-blur-xl md:hidden">
            {navLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={`block rounded-2xl px-4 py-3 text-sm ${isActive(l.href) ? "bg-soft font-semibold" : "text-muted"}`}>
                  {l.label}
                </Link>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </header>
  );
}
