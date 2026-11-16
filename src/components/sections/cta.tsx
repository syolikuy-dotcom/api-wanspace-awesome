"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Magnetic } from "@/components/magnetic";
import { Reveal } from "@/components/reveal";

export function Cta() {
  return (
    <section className="section">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-line bg-card px-6 py-16 text-center sm:px-12">
          <div aria-hidden className="bg-aurora pointer-events-none absolute left-1/2 top-1/2 size-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full" />
          <h2 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">Ready to build something?</h2>
          <p className="relative mx-auto mt-4 max-w-md text-sm text-muted">Buka playground dan panggil endpoint pertamamu sekarang — tanpa daftar.</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Magnetic>
              <Link href="/playground" className="group inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-medium text-brand-fg">
                Try in playground <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Magnetic>
            <Magnetic>
              <Link href="/docs" className="inline-flex rounded-full border border-line px-6 py-3 text-sm font-medium transition-colors hover:bg-soft">Read the docs</Link>
            </Magnetic>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
