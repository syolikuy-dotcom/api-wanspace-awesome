"use client";

import { Counter } from "@/components/counter";
import { Reveal } from "@/components/reveal";
import { useLiveStatus } from "@/hooks/use-live-status";

export function Stats({ endpoints, categories }: { endpoints: number; categories: number }) {
  const live = useLiveStatus("poll", 30000);
  const s = live.snapshot?.summary;
  const availability = s ? ((s.total - s.down) / s.total) * 100 : null;

  const items = [
    { label: "Endpoints", node: <Counter value={endpoints} /> },
    { label: "Categories", node: <Counter value={categories} /> },
    { label: "API keys needed", node: <span>0</span> },
    { label: "Live availability", node: availability === null ? <span className="skeleton inline-block h-9 w-24 rounded-lg align-middle" /> : <Counter key={availability.toFixed(1)} value={availability} decimals={1} suffix="%" /> },
  ];

  return (
    <section className="section !py-12">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-line bg-line lg:grid-cols-4">
        {items.map((it, i) => (
          <Reveal key={it.label} delay={i * 0.06} className="bg-card p-6 sm:p-8">
            <p className="text-3xl font-semibold tracking-tight sm:text-4xl">{it.node}</p>
            <p className="label mt-2">{it.label}</p>
          </Reveal>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted">
        {s ? `Avg latency ${s.avgLatency} ms · ${s.operational}/${s.total} endpoints operational · checked ${new Date(live.snapshot!.checkedAt).toLocaleTimeString()}` : "Running live health check…"}
      </p>
    </section>
  );
}
