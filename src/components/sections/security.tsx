"use client";

import { Check } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";

export function Security({ perMin, burst }: { perMin: number; burst: number }) {
  const rows = [
    ["Rate limit", `${perMin} poin/menit & ${burst} poin/10 detik per IP (endpoint berat bernilai lebih tinggi)`],
    ["Auto-block", "Pelanggar berulang diblokir sementara secara otomatis"],
    ["Anti-SSRF", "IP privat/localhost, port non-standar, dan redirect berbahaya ditolak"],
    ["Anti-leak", "Tanpa API key di sisi klien, URL upstream & stack trace tidak pernah dikirim"],
    ["Input ketat", "Setiap parameter divalidasi tipe, panjang & pola; hanya GET yang diizinkan"],
    ["Privasi", "IP di-hash (tidak disimpan mentah); tidak ada cookie pelacak"],
  ];
  return (
    <section className="section">
      <SectionHeading label="Fair use & security" title="Free for everyone — protected from abuse." description="Batas ini menjaga layanan tetap cepat dan gratis. Respons selalu menyertakan header X-RateLimit-* dan Retry-After." />
      <ul className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-2">
        {rows.map(([t, d], i) => (
          <Reveal key={t} delay={(i % 2) * 0.06} className="bg-card">
            <li className="flex gap-4 p-6">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-ok/15 text-ok">
                <Check size={14} strokeWidth={2.5} />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{t}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{d}</p>
              </div>
            </li>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
