import { Hero } from "@/components/sections/hero";
import { Stats } from "@/components/sections/stats";
import { Features } from "@/components/sections/features";
import { Categories } from "@/components/sections/categories";
import { QuickStart } from "@/components/sections/quickstart";
import { Security } from "@/components/sections/security";
import { Faq } from "@/components/sections/faq";
import { Cta } from "@/components/sections/cta";
import { getCategorySummary, endpoints } from "@/lib/api/registry";
import { fairUse } from "@/config/site";

export default function Home() {
  const cats = getCategorySummary();
  return (
    <>
      <Hero endpoints={endpoints.length} categoryNames={cats.map((c) => `${c.name} · ${c.count}`)} />
      <Stats endpoints={endpoints.length} categories={cats.length} />
      <Features />
      <Categories categories={cats} />
      <QuickStart />
      <Security perMin={fairUse.perMin} burst={fairUse.burst} />
      <Faq />
      <Cta />
    </>
  );
}
