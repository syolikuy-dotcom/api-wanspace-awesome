"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Copy, Trash2 } from "lucide-react";
import { JsonView } from "@/components/json-view";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";
import type { CatalogEndpoint } from "@/lib/api/types";

type Cat = { id: string; name: string; count: number };
type Tone = "muted" | "ok" | "err" | "warn" | "plain";
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type Line =
  | { id: number; t: "cmd"; text: string }
  | { id: number; t: "text"; text: string; tone: Tone }
  | { id: number; t: "json"; text: string; meta: string }
  | { id: number; t: "image"; src: string; meta: string }
  | { id: number; t: "list"; rows: { left: string; right: string; run?: string }[] }
  | { id: number; t: "busy"; text: string };

type NewLine = DistributiveOmit<Line, "id">;

const COMMANDS = ["help", "ls", "info", "get", "curl", "status", "history", "clear", "theme", "docs", "echo", "whoami"] as const;
const MAX_JSON_CHARS = 40_000;
const QUICK = ["help", "ls", "get tools/weather city=Jakarta", "get info/gempa", "get fun/joke", "status"];

/** Pecah argumen dengan dukungan tanda kutip: get tools/hash text="halo dunia" */
function tokenize(input: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (const m of input.matchAll(re)) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

function expandKv(tok: string): string {
  const eq = tok.indexOf("=");
  if (eq <= 0) return tok;
  return `${encodeURIComponent(tok.slice(0, eq))}=${encodeURIComponent(tok.slice(eq + 1))}`;
}

const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

export function Terminal({ catalog, categories }: { catalog: CatalogEndpoint[]; categories: Cat[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const { setTheme } = useTheme();
  const { toast } = useToast();

  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);

  const idRef = useRef(0);
  const histRef = useRef<string[]>([]);
  const histIdx = useRef(-1);
  const draftRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const urlsRef = useRef<string[]>([]);
  const lastJson = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoRan = useRef(false);
  const mounted = useRef(true);

  const byId = useMemo(() => new Map(catalog.map((e) => [e.id, e])), [catalog]);
  const nextId = () => ++idRef.current;

  const push = useCallback((l: NewLine | (NewLine)[]) => {
    const arr = Array.isArray(l) ? l : [l];
    setLines((cur) => [...cur, ...arr.map((x) => ({ ...x, id: ++idRef.current }) as Line)]);
  }, []);
  const say = useCallback((text: string, tone: Tone = "plain") => push({ t: "text", text, tone }), [push]);

  /* ───── scroll & fokus ───── */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
  }, [lines]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  /* ───── HTTP ───── */
  const request = useCallback(
    async (path: string) => {
      if (!path.startsWith("/api/")) return say("Playground hanya memanggil endpoint di API ini (path harus diawali /api/).", "err");
      const busyId = nextId();
      setLines((c) => [...c, { id: busyId, t: "busy", text: `GET ${path}` }]);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setRunning(true);
      const timer = setTimeout(() => ctrl.abort(), 35_000);
      const started = performance.now();
      const done = (replacement: NewLine[]) =>
        setLines((c) => c.flatMap((l) => (l.id === busyId ? replacement.map((r) => ({ ...r, id: nextId() }) as Line) : [l])));

      try {
        const res = await fetch(path, { signal: ctrl.signal, headers: { Accept: "application/json, image/*;q=0.8" } });
        const ms = Math.round(performance.now() - started);
        const ct = res.headers.get("content-type") ?? "";
        const remaining = res.headers.get("x-ratelimit-remaining");
        const cache = res.headers.get("x-vercel-cache");
        const metaBase = `${res.status} ${res.statusText || ""}`.trim();

        if (ct.startsWith("image/")) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          urlsRef.current.push(url);
          const meta = `${metaBase} · ${ms} ms · ${ct.split(";")[0]} · ${fmtBytes(blob.size)}${remaining ? ` · remaining ${remaining}` : ""}`;
          return done([{ t: "image", src: url, meta }]);
        }

        const raw = await res.text();
        const meta = `${metaBase} · ${ms} ms · ${fmtBytes(raw.length)}${cache ? ` · cache ${cache}` : ""}${remaining ? ` · remaining ${remaining}` : ""}`;
        let pretty = raw;
        if (ct.includes("json")) {
          try {
            pretty = JSON.stringify(JSON.parse(raw), null, 2);
          } catch {
            /* biarkan mentah */
          }
        }
        lastJson.current = pretty;
        const clipped = pretty.length > MAX_JSON_CHARS ? `${pretty.slice(0, MAX_JSON_CHARS)}\n… (output dipotong, ${fmtBytes(pretty.length)} total)` : pretty;
        const out: NewLine[] = [{ t: "json", text: clipped, meta }];
        if (res.status === 429 || res.status === 403) {
          const ra = res.headers.get("retry-after");
          out.push({ t: "text", tone: "warn", text: `Dibatasi. Coba lagi${ra ? ` dalam ${ra} detik` : " nanti"}.` });
        }
        done(out);
      } catch (e) {
        const aborted = (e as Error)?.name === "AbortError";
        done([{ t: "text", tone: "err", text: aborted ? "Request dibatalkan atau timeout." : "Gagal terhubung ke server." }]);
      } finally {
        clearTimeout(timer);
        if (mounted.current) setRunning(false);
        abortRef.current = null;
      }
    },
    [say],
  );

  /* ───── resolusi target `get` ───── */
  const resolve = useCallback(
    (args: string[]): { path?: string; error?: string } => {
      const [target, ...rest] = args;
      if (!target) return { error: "Usage: get <category/endpoint> [param=value …]   atau   get /api/ai/translate?text=hi" };
      const kv = rest.map(expandKv).filter((s) => s.includes("="));
      if (target.startsWith("/")) return { path: kv.length ? `${target}${target.includes("?") ? "&" : "?"}${kv.join("&")}` : target };
      if (/^https?:\/\//i.test(target)) {
        try {
          const u = new URL(target);
          if (u.origin !== window.location.origin) return { error: "Hanya endpoint di domain ini yang bisa dipanggil." };
          return { path: `${u.pathname}${u.search}${kv.length ? `${u.search ? "&" : "?"}${kv.join("&")}` : ""}` };
        } catch {
          return { error: "URL tidak valid." };
        }
      }
      const id = target.replace(/^\/?(api\/)?/, "").toLowerCase();
      const ep = byId.get(id);
      if (!ep) {
        const near = catalog.filter((e) => e.id.includes(id)).slice(0, 5).map((e) => e.id);
        return { error: `Endpoint '${id}' tidak ditemukan.${near.length ? ` Mungkin maksudmu: ${near.join(", ")}` : " Ketik 'ls' untuk melihat daftar."}` };
      }
      return { path: kv.length ? `${ep.path}?${kv.join("&")}` : ep.example };
    },
    [byId, catalog],
  );

  /* ───── eksekusi perintah ───── */
  const exec = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      push({ t: "cmd", text });
      histRef.current = [...histRef.current.filter((h) => h !== text), text].slice(-50);
      histIdx.current = -1;

      const [cmd, ...args] = tokenize(text);
      switch (cmd.toLowerCase()) {
        case "help":
          return push({
            t: "list",
            rows: [
              { left: "ls [category]", right: "daftar kategori / endpoint" },
              { left: "info <endpoint>", right: "parameter & contoh endpoint" },
              { left: "get <endpoint> k=v", right: "panggil endpoint (juga: get /api/…)" },
              { left: "curl <url>", right: "alias get untuk URL / path" },
              { left: "status", right: "ringkasan kesehatan layanan" },
              { left: "history", right: "riwayat perintah" },
              { left: "theme light|dark", right: "ganti tema" },
              { left: "docs", right: "buka dokumentasi" },
              { left: "clear", right: "bersihkan layar (Ctrl+L)" },
              { left: "Tab / ↑ ↓", right: "autocomplete / riwayat" },
            ],
          });
        case "ls": {
          const cat = args[0]?.toLowerCase();
          if (!cat) return push({ t: "list", rows: categories.map((c) => ({ left: c.id, right: `${c.count} endpoints`, run: `ls ${c.id}` })) });
          const items = catalog.filter((e) => e.category === cat);
          if (!items.length) return say(`Kategori '${cat}' tidak ada. Ketik 'ls'.`, "err");
          return push({ t: "list", rows: items.map((e) => ({ left: e.id, right: e.title, run: `info ${e.id}` })) });
        }
        case "info": {
          const ep = byId.get((args[0] ?? "").replace(/^\/?(api\/)?/, "").toLowerCase());
          if (!ep) return say("Usage: info <category/endpoint>", "err");
          push({ t: "text", tone: "ok", text: `${ep.title} — ${ep.path}` });
          say(ep.description, "muted");
          if (ep.params.length)
            push({ t: "list", rows: ep.params.map((p) => ({ left: `${p.name}${p.required ? "*" : ""}`, right: `${p.type}${p.default !== undefined ? ` = ${p.default}` : ""} — ${p.description}` })) });
          return push({ t: "list", rows: [{ left: "contoh", right: `get ${ep.example}`, run: `get ${ep.example}` }] });
        }
        case "get":
        case "curl": {
          const filtered = cmd.toLowerCase() === "curl" ? args.filter((a) => !a.startsWith("-")) : args;
          const r = resolve(filtered);
          if (r.error) return say(r.error, "err");
          return request(r.path!);
        }
        case "status": {
          const busy = nextId();
          setLines((c) => [...c, { id: busy, t: "busy", text: "checking services…" }]);
          try {
            const res = await fetch("/api/status?summary=1", { cache: "no-store" });
            const j = await res.json();
            const s = j?.result?.snapshot?.summary;
            const out: NewLine[] = s
              ? [
                  { t: "text", tone: j.result.snapshot.overall === "operational" ? "ok" : "warn", text: `overall: ${j.result.snapshot.overall}` },
                  { t: "list", rows: [{ left: "operational", right: String(s.operational) }, { left: "degraded", right: String(s.degraded) }, { left: "down", right: String(s.down) }, { left: "avg latency", right: `${s.avgLatency} ms` }, { left: "requests (total)", right: String(j.result.metrics?.total ?? "n/a") }] },
                ]
              : [{ t: "text", tone: "warn", text: "Belum ada hasil health check, coba lagi sebentar." }];
            setLines((c) => c.flatMap((l) => (l.id === busy ? out.map((o) => ({ ...o, id: nextId() }) as Line) : [l])));
          } catch {
            setLines((c) => c.flatMap((l) => (l.id === busy ? [{ id: nextId(), t: "text", tone: "err", text: "Gagal mengambil status." } as Line] : [l])));
          }
          return;
        }
        case "history":
          return histRef.current.length ? push({ t: "list", rows: histRef.current.map((h, i) => ({ left: String(i + 1), right: h, run: h })) }) : say("Belum ada riwayat.", "muted");
        case "clear":
          urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
          urlsRef.current = [];
          return setLines([]);
        case "theme":
          if (args[0] === "light" || args[0] === "dark") {
            setTheme(args[0]);
            return say(`Tema: ${args[0]}`, "ok");
          }
          return say("Usage: theme light|dark", "err");
        case "docs":
          router.push("/docs");
          return say("Membuka dokumentasi…", "muted");
        case "echo":
          return say(args.join(" "));
        case "whoami":
          return say("guest — tanpa API key, tanpa login.", "muted");
        default:
          return say(`command not found: ${cmd}. Ketik 'help'.`, "err");
      }
    },
    [push, say, categories, catalog, byId, resolve, request, router, setTheme],
  );

  /* ───── banner & auto-run ───── */
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    push([
      { t: "text", tone: "ok", text: "Wanspace API Playground" },
      { t: "text", tone: "muted", text: `${catalog.length} endpoints · tanpa API key. Ketik 'help' atau klik contoh di bawah.` },
    ]);
    const run = sp.get("run");
    if (run && run.length < 500) void exec(run);
  }, [catalog.length, exec, push, sp]);

  /* ───── input ───── */
  const submit = () => {
    if (running) return;
    const v = input;
    setInput("");
    draftRef.current = "";
    void exec(v);
  };

  const complete = () => {
    const parts = input.split(/\s+/);
    const last = parts[parts.length - 1] ?? "";
    if (parts.length === 1) {
      const hits = COMMANDS.filter((c) => c.startsWith(last.toLowerCase()));
      if (hits.length === 1) setInput(`${hits[0]} `);
      else if (hits.length > 1) say(hits.join("  "), "muted");
      return;
    }
    if (["get", "info", "curl"].includes(parts[0].toLowerCase()) && parts.length === 2) {
      const needle = last.replace(/^\/?(api\/)?/, "").toLowerCase();
      const hits = catalog.filter((e) => e.id.startsWith(needle)).map((e) => e.id);
      if (hits.length === 1) setInput(`${parts[0]} ${hits[0]} `);
      else if (hits.length > 1) say(hits.slice(0, 24).join("  ") + (hits.length > 24 ? " …" : ""), "muted");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") return submit();
    if (e.key === "Tab") {
      e.preventDefault();
      return complete();
    }
    if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      return void exec("clear");
    }
    if (e.key === "c" && e.ctrlKey && running) {
      e.preventDefault();
      return abortRef.current?.abort();
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const h = histRef.current;
      if (!h.length) return;
      e.preventDefault();
      if (histIdx.current === -1) draftRef.current = input;
      const next = e.key === "ArrowUp" ? (histIdx.current === -1 ? h.length - 1 : Math.max(0, histIdx.current - 1)) : histIdx.current === -1 ? -1 : histIdx.current + 1;
      if (next >= h.length || next === -1) {
        histIdx.current = -1;
        setInput(draftRef.current);
      } else {
        histIdx.current = next;
        setInput(h[next]);
      }
    }
  };

  const tone: Record<Tone, string> = { plain: "text-zinc-200", muted: "text-zinc-500", ok: "text-emerald-400", err: "text-red-400", warn: "text-amber-400" };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0d] text-zinc-200 shadow-float">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full bg-red-400/80" />
          <span className="size-2.5 shrink-0 rounded-full bg-amber-400/80" />
          <span className="size-2.5 shrink-0 rounded-full bg-emerald-400/80" />
          <span className="ml-2 truncate font-mono text-[11px] text-zinc-500">guest@wanspace: ~</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={async () => { if (!lastJson.current) return toast("Belum ada output untuk disalin.", "info"); try { await navigator.clipboard.writeText(lastJson.current); toast("Output terakhir disalin.", "success"); } catch { toast("Gagal menyalin.", "error"); } }} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-white" aria-label="Copy last output">
            <Copy size={13} /> <span className="hidden sm:inline">Copy</span>
          </button>
          <button type="button" onClick={() => void exec("clear")} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-white" aria-label="Clear terminal">
            <Trash2 size={13} /> <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        data-lenis-prevent
        onClick={() => { if (!window.getSelection()?.toString()) inputRef.current?.focus(); }}
        className="thin-scroll h-[min(62vh,34rem)] overflow-y-auto overscroll-contain px-4 py-4 font-mono text-[12.5px] leading-relaxed"
      >
        {lines.map((l) => (
          <motion.div key={l.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="mb-1.5">
            {l.t === "cmd" && (
              <p className="break-all">
                <span className="text-emerald-400">$</span> <span className="text-white">{l.text}</span>
              </p>
            )}
            {l.t === "text" && <p className={cn("whitespace-pre-wrap break-words", tone[l.tone])}>{l.text}</p>}
            {l.t === "busy" && (
              <p className="flex items-center gap-2 text-zinc-400">
                <span className="inline-block size-3 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200" />
                <span className="break-all">{l.text}</span>
              </p>
            )}
            {l.t === "json" && (
              <div>
                <p className="mb-1 text-[11px] text-zinc-500">{l.meta}</p>
                <pre className="thin-scroll max-h-[28rem] overflow-auto whitespace-pre rounded-lg bg-white/[0.03] p-3 text-[12px]" data-lenis-prevent>
                  <JsonView text={l.text} />
                </pre>
              </div>
            )}
            {l.t === "image" && (
              <div>
                <p className="mb-1 text-[11px] text-zinc-500">{l.meta}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.src} alt="API response" className="max-h-80 w-auto max-w-full rounded-lg bg-white/5 object-contain" />
              </div>
            )}
            {l.t === "list" && (
              <ul className="grid gap-x-4 gap-y-0.5 sm:grid-cols-[minmax(0,13rem)_1fr]">
                {l.rows.map((r, i) => (
                  <li key={i} className="contents">
                    {r.run ? (
                      <button type="button" onClick={(e) => { e.stopPropagation(); if (!running) { void exec(r.run!); } }} className="min-w-0 truncate text-left text-sky-300 hover:underline">{r.left}</button>
                    ) : (
                      <span className="min-w-0 break-words text-sky-300">{r.left}</span>
                    )}
                    <span className="min-w-0 break-words pb-1 text-zinc-400 sm:pb-0">{r.right}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ))}

        <label className="mt-1 flex items-center gap-2">
          <span className="shrink-0 text-emerald-400">$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={running}
            autoFocus={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="send"
            maxLength={600}
            aria-label="Terminal input"
            placeholder={running ? "running… (Ctrl+C to cancel)" : "type a command…"}
            className="min-w-0 flex-1 bg-transparent text-[16px] text-white caret-emerald-400 outline-none placeholder:text-zinc-600 sm:text-[12.5px]"
          />
        </label>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-white/10 px-3 py-2.5">
        {QUICK.map((c) => (
          <button key={c} type="button" disabled={running} onClick={() => void exec(c)} className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 font-mono text-[11px] text-zinc-400 transition-colors hover:border-white/30 hover:text-white disabled:opacity-40">
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
