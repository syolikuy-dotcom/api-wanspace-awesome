"use client";

import { Activity, Braces, KeyRound, Layers, ShieldCheck, Terminal, Zap, Lock } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { Spotlight } from "@/components/spotlight";
import { Tilt } from "@/components/tilt";
import { SectionHeading } from "@/components/section-heading";

const FEATURES = [
  { icon: KeyRound, title: "No API key", text: "Cukup HTTP GET. Tanpa daftar, tanpa token, tanpa konfigurasi." },
  { icon: Braces, title: "Konsisten", text: "Format JSON seragam: status, code, result, meta — mudah diparse di bahasa apa pun." },
  { icon: Layers, title: "Sumber cadangan", text: "Endpoint kritis punya sumber fallback otomatis jika sumber utama bermasalah." },
  { icon: Zap, title: "Edge cache", text: "Respons di-cache di CDN Vercel sehingga cepat dan hemat kuota sumber data." },
  { icon: ShieldCheck, title: "Anti-abuse", text: "Rate limit per IP, burst control, auto-block pelanggar, dan filter scanner." },
  { icon: Lock, title: "Anti-SSRF & leak", text: "Target URL dicek (IP privat diblokir), error disanitasi, tak ada upstream/secret bocor." },
  { icon: Terminal, title: "Terminal playground", text: "Coba semua endpoint langsung di browser dengan terminal interaktif." },
  { icon: Activity, title: "Status real-time", text: "Health check live per endpoint lewat Server-Sent Events, tanpa refresh." },
];

export function Features() {
  return (
    <section className="section">
      <SectionHeading label="Why Wanspace" title="Built for developers, hardened for production." description="Semua yang kamu butuhkan untuk mulai — dan perlindungan yang membuat layanan tetap stabil untuk semua orang." />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={(i % 4) * 0.06}>
            <Tilt max={5} className="h-full">
              <Spotlight className="h-full rounded-2xl border border-line bg-card p-6">
                <f.icon size={20} strokeWidth={1.8} />
                <h3 className="mt-5 text-[15px] font-semibold">{f.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{f.text}</p>
              </Spotlight>
            </Tilt>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
