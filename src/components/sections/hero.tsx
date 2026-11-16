"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Terminal } from "lucide-react";
import { Magnetic } from "@/components/magnetic";
import { SplitText } from "@/components/split-text";
import { JsonView } from "@/components/json-view";
import { Marquee } from "@/components/sections/marquee";
import { site } from "@/config/site";

const DEMOS = [
  {
    cmd: "curl api.wanspace.biz.id/api/tools/weather?city=Jakarta",
    out: `{\n  "status": true,\n  "code": 200,\n  "category": "tools",\n  "endpoint": "weather",\n  "result": {\n    "location": { "name": "Jakarta" },\n    "current": { "temperature": 31.2, "condition": "Partly cloudy" }\n  },\n  "meta": { "latency": 84 }\n}`,
  },
  {
    cmd: "curl api.wanspace.biz.id/api/ai/translate?text=Hello&to=id",
    out: `{\n  "status": true,\n  "code": 200,\n  "category": "ai",\n  "endpoint": "translate",\n  "result": {\n    "translated": "Halo",\n    "from": "en",\n    "to": "id"\n  },\n  "meta": { "latency": 112 }\n}`,
  },
  {
    cmd: "curl api.wanspace.biz.id/api/info/gempa",
    out: `{\n  "status": true,\n  "code": 200,\n  "category": "info",\n  "endpoint": "gempa",\n  "result": [\n    { "magnitude": 4.8, "region": "Pusat gempa di laut …", "source": "BMKG" }\n  ],\n  "meta": { "latency": 96 }\n}`,
  },
];

function useTyped(text: string, active: boolean) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduce) return setN(text.length);
    setN(0);
    if (!active) return;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setN(i);
      if (i >= text.length) clearInterval(t);
    }, 24);
    return () => clearInterval(t);
  }, [text, active, reduce]);
  return text.slice(0, n);
}

function DemoTerminal() {
  const [i, setI] = useState(0);
  const demo = DEMOS[i];
  const typed = useTyped(demo.cmd, true);
  const done = typed.length === demo.cmd.length;

  useEffect(() => {
    const t = setTimeout(() => setI((v) => (v + 1) % DEMOS.length), 6200);
    return () => clearTimeout(t);
  }, [i]);

  return (
    <div className="w-full max-w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0d] text-zinc-200 shadow-float" aria-label="Example request and response">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="size-2.5 rounded-full bg-red-400/80" />
        <span className="size-2.5 rounded-full bg-amber-400/80" />
        <span className="size-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-2 truncate font-mono text-[11px] text-zinc-500">wanspace-api ~ terminal</span>
      </div>
      <div className="h-[22rem] overflow-hidden p-4 font-mono text-[12px] leading-relaxed sm:text-[13px]">
        <p className="break-all">
          <span className="text-emerald-400">$</span> {typed}
          {!done && <span className="ml-0.5 inline-block h-[1.1em] w-1.5 translate-y-[0.2em] bg-zinc-300 animate-blink" />}
        </p>
        <AnimatePresence mode="wait">
          {done && (
            <motion.pre key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="mt-3 overflow-x-auto whitespace-pre text-zinc-300">
              <JsonView text={demo.out} />
            </motion.pre>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function Hero({ endpoints, categoryNames }: { endpoints: number; categoryNames: string[] }) {
  return (
    <section id="home" className="relative overflow-hidden pb-10 pt-32 sm:pt-40">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="bg-dots absolute inset-0" />
        <div className="bg-aurora absolute -left-24 top-10 size-[28rem] animate-drift rounded-full" />
        <div className="bg-aurora absolute -right-24 top-40 size-[24rem] animate-drift-slow rounded-full" />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="min-w-0">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.6 }} className="inline-flex items-center gap-2 rounded-full border border-line bg-card/80 px-3.5 py-1.5 text-xs font-medium text-muted backdrop-blur">
            <span className="size-1.5 rounded-full bg-ok" />
            {endpoints}+ endpoints · No API key
          </motion.div>

          <h1 className="mt-6 text-[2.5rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            <SplitText text="Free REST API" trigger="mount" delay={0.3} />
            <br />
            <span className="text-muted">
              <SplitText text="for every project." trigger="mount" delay={0.5} />
            </span>
          </h1>

          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.7 }} className="mt-6 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            AI, anime, berita, tools, media, games, Islamic &amp; lebih banyak lagi — satu base URL, JSON konsisten, tanpa API key, tanpa daftar. Dilindungi rate limit &amp; auto-block, berjalan serverless di Vercel.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.7 }} className="mt-8 flex flex-wrap items-center gap-3">
            <Magnetic>
              <Link href="/docs" className="group inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-medium text-brand-fg shadow-soft transition-transform">
                Explore endpoints
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Magnetic>
            <Magnetic>
              <Link href="/playground" className="inline-flex items-center gap-2 rounded-full border border-line bg-card/70 px-6 py-3 text-sm font-medium backdrop-blur transition-colors hover:bg-soft">
                <Terminal size={16} />
                Open playground
              </Link>
            </Magnetic>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-5 font-mono text-xs text-muted">
            base url → <span className="text-foreground">{site.url.replace(/^https?:\/\//, "")}/api</span>
          </motion.p>
        </div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="min-w-0">
          <DemoTerminal />
        </motion.div>
      </div>

      <div className="relative mt-14">
        <Marquee items={categoryNames} variant="pill" />
      </div>
    </section>
  );
}
