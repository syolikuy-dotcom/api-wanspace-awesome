"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, Search } from "lucide-react";
import { navLinks } from "@/config/site";
import { OPEN_PALETTE } from "@/lib/events";
import { lockScroll } from "@/lib/lenis";
import { cn } from "@/lib/utils";

export type PaletteItem = { id: string; title: string; path: string; category: string; tags: string[] };
type Row = { key: string; label: string; hint: string; href: string };

export function CommandPalette({ items }: { items: PaletteItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const rows = useMemo<Row[]>(() => {
    const needle = q.trim().toLowerCase();
    const pages: Row[] = navLinks.map((l) => ({ key: `p:${l.href}`, label: l.label, hint: "Page", href: l.href }));
    const eps: Row[] = items.map((e) => ({ key: e.id, label: e.title, hint: e.path.replace("/api/", ""), href: `/docs?ep=${encodeURIComponent(e.id)}` }));
    if (!needle) return [...pages, ...eps.slice(0, 8)];
    const hay = (r: Row, extra = "") => `${r.label} ${r.hint} ${extra}`.toLowerCase();
    const tagMap = new Map(items.map((e) => [e.id, e.tags.join(" ")]));
    return [...pages, ...eps].filter((r) => hay(r, tagMap.get(r.key) ?? "").includes(needle)).slice(0, 30);
  }, [q, items]);

  const close = () => setOpen(false);
  const go = (r: Row | undefined) => {
    if (!r) return;
    close();
    router.push(r.href);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    lockScroll(true);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      lockScroll(false);
    };
  }, [open]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(rows.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(rows[active]);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[96] flex items-start justify-center px-4 pt-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          <button type="button" aria-label="Close search" onClick={close} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div role="dialog" aria-modal="true" aria-label="Search endpoints" initial={{ y: -12, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: -12, scale: 0.97 }} transition={{ type: "spring", stiffness: 360, damping: 30 }} className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-card shadow-float" onKeyDown={onKeyDown}>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={16} className="shrink-0 text-muted" />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search endpoints, e.g. weather, anime, gempa…" aria-label="Search" className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted sm:text-sm" />
              <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted sm:inline">ESC</kbd>
            </div>
            <ul ref={listRef} data-lenis-prevent className="thin-scroll max-h-[50vh] overflow-y-auto overscroll-contain p-2">
              {rows.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">No results for “{q}”.</li>}
              {rows.map((r, i) => (
                <li key={r.key} data-i={i}>
                  <button type="button" onMouseMove={() => setActive(i)} onClick={() => go(r)} className={cn("flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm", i === active ? "bg-soft" : "")}>
                    <span className="min-w-0 truncate font-medium">{r.label}</span>
                    <span className="flex shrink-0 items-center gap-2 font-mono text-[11px] text-muted">
                      <span className="max-w-[10rem] truncate">{r.hint}</span>
                      {i === active && <CornerDownLeft size={12} />}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
