"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import { Spotlight } from "@/components/spotlight";

export type CategoryCard = { id: string; name: string; description: string; icon: string; count: number };

export function Categories({ categories }: { categories: CategoryCard[] }) {
  return (
    <section className="section">
      <SectionHeading label="Categories" title="Pick a category, ship faster." description="Setiap kategori berisi endpoint yang siap pakai dan terus bertambah." />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c, i) => (
          <Reveal key={c.id} delay={(i % 3) * 0.06}>
            <Link href={`/docs?cat=${c.id}`} className="group block h-full">
              <Spotlight className="h-full rounded-2xl border border-line bg-card p-6 transition-colors group-hover:border-foreground/30">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-soft">
                    <CategoryIcon name={c.icon} size={20} strokeWidth={1.8} />
                  </span>
                  <ArrowUpRight size={18} className="text-muted transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>
                <h3 className="mt-5 flex items-center gap-2 text-lg font-semibold">
                  {c.name}
                  <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] font-medium text-muted">{c.count}</span>
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{c.description}</p>
              </Spotlight>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
