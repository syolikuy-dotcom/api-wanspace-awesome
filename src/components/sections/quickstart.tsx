"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CopyButton } from "@/components/copy-button";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import { site } from "@/config/site";

const B = site.url;
const SNIPPETS: { id: string; label: string; code: string }[] = [
  { id: "curl", label: "cURL", code: `curl "${B}/api/tools/weather?city=Jakarta"\n\ncurl "${B}/api/ai/translate?text=Hello&to=id"\n\ncurl "${B}/api/info/gempa"` },
  { id: "js", label: "JavaScript", code: `const res = await fetch("${B}/api/ai/translate?text=Hello&to=id");\nconst data = await res.json();\n\nif (data.status) console.log(data.result.translated);\nelse console.error(data.error.message);` },
  { id: "py", label: "Python", code: `import requests\n\nres = requests.get(\n    "${B}/api/ai/translate",\n    params={"text": "Hello", "to": "id"},\n    timeout=15,\n)\ndata = res.json()\nprint(data["result"]["translated"] if data["status"] else data["error"])` },
  { id: "php", label: "PHP", code: `<?php\n$url = "${B}/api/ai/translate?" . http_build_query(["text" => "Hello", "to" => "id"]);\n$data = json_decode(file_get_contents($url), true);\n\necho $data["status"] ? $data["result"]["translated"] : $data["error"]["message"];` },
];

const STEPS = [
  ["Pick an endpoint", "Jelajahi dokumentasi atau tekan Ctrl/⌘ K untuk mencari."],
  ["Send a GET request", "Tanpa API key. Parameter lewat query string."],
  ["Get clean JSON", "Respons konsisten dengan status, result & meta."],
];

export function QuickStart() {
  const [tab, setTab] = useState(SNIPPETS[0].id);
  const active = SNIPPETS.find((s) => s.id === tab) ?? SNIPPETS[0];

  return (
    <section className="section">
      <SectionHeading label="Quick start" title="From zero to response in 30 seconds." />
      <div className="mt-12 grid items-start gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <ol className="space-y-6">
          {STEPS.map(([t, d], i) => (
            <Reveal key={t} delay={i * 0.08}>
              <li className="flex gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line font-mono text-sm font-semibold">{i + 1}</span>
                <div className="min-w-0">
                  <p className="font-semibold">{t}</p>
                  <p className="mt-1 text-sm text-muted">{d}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal>
          <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0d] text-zinc-200 shadow-float">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
              <div role="tablist" aria-label="Language" className="no-scrollbar flex gap-1 overflow-x-auto">
                {SNIPPETS.map((s) => (
                  <button key={s.id} role="tab" aria-selected={tab === s.id} type="button" onClick={() => setTab(s.id)} className={`relative shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${tab === s.id ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
                    {tab === s.id && <motion.span layoutId="qs-tab" className="absolute inset-0 rounded-lg bg-white/10" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                    <span className="relative">{s.label}</span>
                  </button>
                ))}
              </div>
              <CopyButton text={active.code} dark />
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.pre key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="thin-scroll min-h-[13rem] overflow-x-auto p-5 font-mono text-[12px] leading-relaxed sm:text-[13px]">
                <code>{active.code}</code>
              </motion.pre>
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
