import type { Metadata } from "next";
import { Suspense } from "react";
import { DocsExplorer } from "@/components/docs-explorer";
import { getCatalog, getCategorySummary } from "@/lib/api/registry";
import { Reveal } from "@/components/reveal";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Documentation", description: "Daftar lengkap endpoint, parameter, dan contoh pemakaian Wanspace API." };

export default function DocsPage() {
  const catalog = getCatalog();
  const categories = getCategorySummary().map((c) => ({ id: c.id, name: c.name, icon: c.icon, count: c.count }));

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-24 pt-32 sm:px-8 sm:pt-40">
      <Reveal>
        <p className="label">Documentation</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">API reference</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Base URL <code className="rounded-md bg-soft px-1.5 py-0.5 font-mono text-[13px] text-foreground">{site.url}/api</code>. Semua endpoint memakai <b>GET</b>, tanpa API key, dan mengembalikan JSON (atau gambar/SVG untuk endpoint tertentu).
        </p>
      </Reveal>

      <Reveal delay={0.08} className="mt-8">
        <div className="thin-scroll overflow-x-auto rounded-2xl border border-white/10 bg-[#0b0b0d] p-4 font-mono text-[12px] leading-relaxed text-zinc-300">
          <pre>{`// success\n{ "status": true,  "code": 200, "category": "…", "endpoint": "…", "result": …, "meta": { "latency": 87, "requestId": "…" } }\n\n// error\n{ "status": false, "code": 400, "error": { "type": "missing_parameter", "message": "…" }, "meta": { … } }`}</pre>
        </div>
      </Reveal>

      <div className="mt-10">
        <Suspense fallback={<div className="skeleton h-40 rounded-2xl" />}>
          <DocsExplorer catalog={catalog} categories={categories} />
        </Suspense>
      </div>
    </div>
  );
}
