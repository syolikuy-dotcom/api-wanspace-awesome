"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";

const FAQ = [
  ["Apakah benar-benar gratis dan tanpa API key?", "Ya. Semua endpoint bisa dipanggil dengan HTTP GET biasa tanpa autentikasi."],
  ["Berapa batas pemakaiannya?", "Ada rate limit per IP untuk menjaga kestabilan. Header X-RateLimit-Remaining dan Retry-After memberi tahu sisa kuota. Respons ter-cache di CDN tidak mengurangi kuota."],
  ["Dari mana datanya?", "Dari sumber publik pihak ketiga (mis. Jikan, Open-Meteo, BMKG, RSS portal berita) dan perhitungan lokal. Jika satu sumber gangguan, endpoint tertentu otomatis memakai sumber cadangan."],
  ["Kenapa ada endpoint yang kadang error?", "Sumber gratis bisa lambat atau membatasi trafik. Halaman Status menampilkan kondisi tiap endpoint secara live sehingga kamu tahu mana yang sehat."],
  ["Bisakah dipakai untuk bot atau aplikasi komersial?", "Boleh selama mematuhi fair use dan ketentuan sumber data masing-masing. Untuk trafik besar, deploy instance milikmu sendiri."],
] as const;

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="section">
      <SectionHeading label="FAQ" title="Questions, answered." />
      <div className="mt-12 max-w-3xl divide-y divide-line border-y border-line">
        {FAQ.map(([q, a], i) => {
          const isOpen = open === i;
          return (
            <Reveal key={q} delay={i * 0.04}>
              <button type="button" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 py-5 text-left">
                <span className="text-[15px] font-medium">{q}</span>
                <ChevronDown size={18} className={`shrink-0 text-muted transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                    <p className="pb-5 pr-8 text-sm leading-relaxed text-muted">{a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
