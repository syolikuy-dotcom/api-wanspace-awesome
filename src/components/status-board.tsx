"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { StatusDot, type DotState } from "@/components/status-dot";
import { useLiveStatus, type LiveMode } from "@/hooks/use-live-status";
import { cn } from "@/lib/utils";
import type { HistoryPoint, State } from "@/lib/api/health";

type Cat = { id: string; name: string; icon: string };

const OVERALL: Record<State, { title: string; tone: string; dot: DotState }> = {
  operational: { title: "All systems operational", tone: "text-ok", dot: "operational" },
  degraded: { title: "Partial degradation", tone: "text-warn", dot: "degraded" },
  down: { title: "Major outage", tone: "text-bad", dot: "down" },
};

const MODE: Record<LiveMode, { label: string; dot: DotState }> = {
  live: { label: "Live", dot: "operational" },
  polling: { label: "Polling", dot: "degraded" },
  connecting: { label: "Connecting", dot: "unknown" },
  offline: { label: "Offline", dot: "down" },
};

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const w = 100;
  const h = 28;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - (v / max) * (h - 2) - 1}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function UptimeBars({ history }: { history: HistoryPoint[] }) {
  const slots = 60;
  const padded: (HistoryPoint | null)[] = [...Array(Math.max(0, slots - history.length)).fill(null), ...history.slice(-slots)];
  return (
    <div className="flex h-9 items-end gap-[3px]" role="img" aria-label="Recent health checks">
      {padded.map((p, i) => (
        <span
          key={i}
          title={p ? `${new Date(p.t).toLocaleTimeString()} — ${p.ok} ok, ${p.deg} degraded, ${p.down} down` : "no data"}
          className={cn("h-full min-w-0 flex-1 rounded-[3px]", !p ? "bg-line" : p.down > 0 ? "bg-bad" : p.deg > 0 ? "bg-warn" : "bg-ok")}
        />
      ))}
    </div>
  );
}

export function StatusBoard({ categories }: { categories: Cat[] }) {
  const live = useLiveStatus("sse");
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const snap = live.snapshot;

  const availability = useMemo(() => {
    if (!live.history.length) return null;
    const sum = live.history.reduce((a, p) => a + (p.ok + p.deg + p.down === 0 ? 1 : (p.ok + p.deg) / (p.ok + p.deg + p.down)), 0);
    return (sum / live.history.length) * 100;
  }, [live.history]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (snap?.endpoints ?? []).filter((e) => (cat === "all" || e.category === cat) && (!needle || `${e.id} ${e.title}`.toLowerCase().includes(needle)));
  }, [snap, cat, q]);

  const grouped = useMemo(() => categories.map((c) => ({ c, items: rows.filter((r) => r.category === c.id) })).filter((g) => g.items.length), [rows, categories]);
  const overall = snap ? OVERALL[snap.overall] : null;
  const mode = MODE[live.mode];
  const m = live.metrics;

  return (
    <div className="space-y-8">
      {/* banner */}
      <div className="overflow-hidden rounded-3xl border border-line bg-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {overall ? (
              <p className={cn("flex items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl", overall.tone)}>
                <StatusDot state={overall.dot} pulse className="size-3" />
                {overall.title}
              </p>
            ) : (
              <p className="flex items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                <span className="inline-block size-4 animate-spin rounded-full border-2 border-line border-t-foreground" />
                Checking systems…
              </p>
            )}
            <p className="mt-2 text-sm text-muted">
              {snap ? `Last check ${new Date(snap.checkedAt).toLocaleTimeString()} · refreshes every minute` : "Running the first health check — this can take up to ~20 seconds."}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-medium">
            <StatusDot state={mode.dot} pulse={live.mode === "live"} />
            {mode.label}
          </span>
        </div>
        <div className="mt-6">
          <UptimeBars history={live.history} />
          <div className="mt-2 flex justify-between text-[11px] text-muted">
            <span>older</span>
            <span>{availability === null ? "collecting history…" : `${availability.toFixed(2)}% availability (last ${live.history.length} checks)`}</span>
            <span>now</span>
          </div>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Operational", value: snap?.summary.operational, tone: "text-ok" },
          { label: "Degraded", value: snap?.summary.degraded, tone: "text-warn" },
          { label: "Down", value: snap?.summary.down, tone: "text-bad" },
          { label: "Avg latency", value: snap?.summary.avgLatency, suffix: " ms", tone: "" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-card p-5">
            <p className={cn("text-3xl font-semibold tracking-tight", s.tone)}>
              {s.value === undefined ? <span className="skeleton inline-block h-8 w-14 rounded-lg align-middle" /> : <>{s.value}{s.suffix ?? ""}</>}
            </p>
            <p className="label mt-2">{s.label}</p>
          </div>
        ))}
        <div className="col-span-2 min-w-0 rounded-2xl border border-line bg-card p-5 lg:col-span-1">
          <p className="text-3xl font-semibold tracking-tight">{m ? m.lastMinute.toLocaleString() : <span className="skeleton inline-block h-8 w-14 rounded-lg align-middle" />}</p>
          <p className="label mt-2">Requests / min</p>
          <div className="mt-2 text-foreground/70">{m && <Sparkline values={m.series} />}</div>
          {m && <p className="mt-1 text-[10px] text-muted">{m.total.toLocaleString()} total · {m.store === "redis" ? "global" : "this instance"}</p>}
        </div>
      </div>

      {/* filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter endpoints…" aria-label="Filter endpoints" className="h-10 w-full rounded-full border border-line bg-card pl-10 pr-4 text-base outline-none focus:border-foreground/40 sm:text-sm" />
        </div>
        <div className="no-scrollbar flex min-w-0 gap-2 overflow-x-auto">
          {[{ id: "all", name: "All", icon: "" }, ...categories].map((c) => (
            <button key={c.id} type="button" onClick={() => setCat(c.id)} aria-pressed={cat === c.id} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors", cat === c.id ? "border-foreground bg-brand text-brand-fg" : "border-line text-muted hover:bg-soft hover:text-foreground")}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* list */}
      {!snap ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.length === 0 && <p className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-sm text-muted">No endpoints match your filter.</p>}
          {grouped.map(({ c, items }) => (
            <section key={c.id}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <CategoryIcon name={c.icon} size={15} strokeWidth={1.8} /> {c.name}
                <span className="font-mono text-xs font-normal text-muted">{items.filter((i) => i.state === "operational").length}/{items.length}</span>
              </h2>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
                {items.map((e) => (
                  <motion.li key={e.id} layout="position" className="flex items-center gap-3 px-4 py-3">
                    <StatusDot state={e.state} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{e.title}</span>
                      <span className="block truncate font-mono text-[11px] text-muted">/api/{e.id}{e.note ? ` · ${e.note}` : ""}</span>
                    </span>
                    <span className={cn("shrink-0 font-mono text-xs", e.state === "operational" ? "text-muted" : e.state === "degraded" ? "text-warn" : "text-bad")}>
                      {e.latency !== null ? `${e.latency} ms` : "down"}
                    </span>
                  </motion.li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
