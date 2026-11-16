import type { Metadata } from "next";
import { Suspense } from "react";
import { Terminal } from "@/components/terminal";
import { Reveal } from "@/components/reveal";
import { getCatalog, getCategorySummary } from "@/lib/api/registry";

export const metadata: Metadata = { title: "Playground", description: "Terminal interaktif untuk mencoba semua endpoint Wanspace API langsung di browser." };

export default function PlaygroundPage() {
  const catalog = getCatalog();
  const categories = getCategorySummary().map((c) => ({ id: c.id, name: c.name, count: c.count }));

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-24 pt-32 sm:px-8 sm:pt-40">
      <Reveal>
        <p className="label">Playground</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Terminal</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Coba endpoint seperti di command line. Contoh: <code className="rounded-md bg-soft px-1.5 py-0.5 font-mono text-[13px] text-foreground">get tools/weather city=Jakarta</code>
        </p>
      </Reveal>
      <Reveal delay={0.1} className="mt-8">
        <Suspense fallback={<div className="skeleton h-[34rem] rounded-2xl" />}>
          <Terminal catalog={catalog} categories={categories} />
        </Suspense>
      </Reveal>
    </div>
  );
}
