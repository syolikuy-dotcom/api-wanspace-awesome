import type { Metadata } from "next";
import { StatusBoard } from "@/components/status-board";
import { Reveal } from "@/components/reveal";
import { getCategorySummary } from "@/lib/api/registry";

export const metadata: Metadata = { title: "Status", description: "Kesehatan real-time setiap endpoint Wanspace API." };

export default function StatusPage() {
  const categories = getCategorySummary().map((c) => ({ id: c.id, name: c.name, icon: c.icon }));
  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-24 pt-32 sm:px-8 sm:pt-40">
      <Reveal>
        <p className="label">Status</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">System status</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">Health check langsung ke setiap endpoint dan sumber datanya, dikirim real-time lewat Server-Sent Events.</p>
      </Reveal>
      <div className="mt-10">
        <StatusBoard categories={categories} />
      </div>
    </div>
  );
}
