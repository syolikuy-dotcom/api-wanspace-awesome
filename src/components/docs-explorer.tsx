"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Play, Search, X } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/utils";
import { site } from "@/config/site";
import type { CatalogEndpoint } from "@/lib/api/types";

type Cat = { id: string; name: string; icon: string; count: number };

function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "ok" | "warn" }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase", tone === "ok" ? "bg-ok/15 text-ok" : tone === "warn" ? "bg-warn/15 text-warn" : "bg-soft text-muted")}>{children}</span>
  );
}

function EndpointCard({ e, open, onToggle, origin }: { e: CatalogEndpoint; open: boolean; onToggle: () => void; origin: string }) {
  const full = `${origin}${e.example}`;
  const curl = `curl "${full}"`;
  const js = `const res = await fetch("${full}");\nconst data = await res.json();`;
  const tryCmd = `get ${e.example}`;

  return (
    <li id={`ep-${e.id.replace("/", "-")}`} className="scroll-mt-28 overflow-hidden rounded-2xl border border-line bg-card">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-soft/60 sm:px-5">
        <Badge tone="ok">GET</Badge>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[13px] font-medium">{e.path.replace("/api", "")}</span>
          <span className="mt-0.5 block truncate text-xs text-muted">{e.title}</span>
        </span>
        {e.output !== "json" && <Badge tone="warn">{e.output}</Badge>}
        <ChevronDown size={16} className={cn("shrink-0 text-muted transition-transform duration-300", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <div className="space-y-5 border-t border-line px-4 py-5 sm:px-5">
              <p className="text-sm leading-relaxed text-muted">{e.description}</p>

              {e.params.length > 0 ? (
                <div className="thin-scroll overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[34rem] text-left text-[12.5px]">
                    <thead className="bg-soft text-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Parameter</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">Default</th>
                        <th className="px-3 py-2 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {e.params.map((p) => (
                        <tr key={p.name} className="align-top">
                          <td className="px-3 py-2.5 font-mono font-semibold">
                            {p.name}
                            {p.required && <span className="ml-1 text-bad" title="required">*</span>}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-muted">{p.type}</td>
                          <td className="px-3 py-2.5 font-mono text-muted">{p.default !== undefined ? String(p.default) : "—"}</td>
                          <td className="px-3 py-2.5 text-muted">
                            {p.description}
                            {p.values && <span className="mt-1 block font-mono text-[11px]">{p.values.join(" | ")}</span>}
                            {p.hint && <span className="mt-1 block text-[11px]">{p.hint}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-muted">No parameters.</p>
              )}

              <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0b0b0d] text-zinc-200">
                <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
                  <span className="font-mono text-[11px] text-zinc-500">example</span>
                  <div className="flex items-center gap-1">
                    <CopyButton text={curl} label="cURL" dark />
                    <CopyButton text={js} label="fetch" dark />
                    <CopyButton text={full} label="URL" dark />
                  </div>
                </div>
                <pre className="thin-scroll overflow-x-auto p-3.5 font-mono text-[12px] leading-relaxed">
                  <code>{curl}</code>
                </pre>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href={`/playground?run=${encodeURIComponent(tryCmd)}`} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-xs font-medium text-brand-fg">
                  <Play size={12} fill="currentColor" /> Try in playground
                </Link>
                <a href={e.example} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border border-line px-4 py-2 text-xs font-medium transition-colors hover:bg-soft">
                  Open raw response
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export function DocsExplorer({ catalog, categories }: { catalog: CatalogEndpoint[]; categories: Cat[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [open, setOpen] = useState<string | null>(sp.get("ep"));
  const [origin, setOrigin] = useState<string>(site.url);
  const cat = sp.get("cat") ?? "all";
  const epParam = sp.get("ep");
  const scrolled = useRef<string | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    if (!epParam) return;
    setOpen(epParam);
    if (scrolled.current === epParam) return;
    scrolled.current = epParam;
    const t = setTimeout(() => document.getElementById(`ep-${epParam.replace("/", "-")}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 350);
    return () => clearTimeout(t);
  }, [epParam]);

  const setCat = (id: string) => {
    const p = new URLSearchParams(sp.toString());
    p.delete("ep");
    if (id === "all") p.delete("cat");
    else p.set("cat", id);
    router.replace(`/docs${p.toString() ? `?${p}` : ""}`, { scroll: false });
  };

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return catalog.filter((e) => (cat === "all" || e.category === cat) && (!needle || `${e.id} ${e.title} ${e.description} ${e.tags.join(" ")}`.toLowerCase().includes(needle)));
  }, [catalog, cat, q]);

  const grouped = useMemo(() => {
    const m = new Map<string, CatalogEndpoint[]>();
    for (const e of list) m.set(e.category, [...(m.get(e.category) ?? []), e]);
    return categories.filter((c) => m.has(c.id)).map((c) => ({ cat: c, items: m.get(c.id)! }));
  }, [list, categories]);

  return (
    <div>
      <div className="sticky top-20 z-30 -mx-5 border-b border-line bg-background/85 px-5 py-3 backdrop-blur-xl sm:-mx-8 sm:px-8">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${catalog.length} endpoints…`} aria-label="Search endpoints" className="h-11 w-full rounded-full border border-line bg-card pl-11 pr-10 text-base outline-none transition-colors placeholder:text-muted focus:border-foreground/40 sm:text-sm" />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-soft">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-0.5">
          {[{ id: "all", name: "All", icon: "", count: catalog.length }, ...categories].map((c) => (
            <button key={c.id} type="button" onClick={() => setCat(c.id)} aria-pressed={cat === c.id} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors", cat === c.id ? "border-foreground bg-brand text-brand-fg" : "border-line text-muted hover:bg-soft hover:text-foreground")}>
              {c.icon && <CategoryIcon name={c.icon} size={13} />}
              {c.name}
              <span className="font-mono text-[10px] opacity-70">{c.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 space-y-10">
        {grouped.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
            <p className="font-medium">No endpoints match “{q}”.</p>
            <p className="mt-1 text-sm text-muted">Try a different keyword or clear the filter.</p>
          </div>
        )}
        {grouped.map(({ cat: c, items }) => (
          <section key={c.id} aria-labelledby={`cat-${c.id}`}>
            <h2 id={`cat-${c.id}`} className="mb-4 flex items-center gap-2.5 text-lg font-semibold">
              <CategoryIcon name={c.icon} size={18} strokeWidth={1.8} />
              {c.name}
              <span className="font-mono text-xs font-normal text-muted">{items.length}</span>
            </h2>
            <ul className="space-y-2.5">
              {items.map((e) => (
                <EndpointCard key={e.id} e={e} origin={origin} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
