import Link from "next/link";

export default function NotFound() {
  return (
    <section className="section grid min-h-[80svh] place-items-center text-center">
      <div>
        <p className="font-mono text-6xl font-semibold tracking-tight">404</p>
        <p className="mt-4 text-muted">This page doesn’t exist. Maybe you want an endpoint?</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/docs" className="rounded-full bg-brand px-6 py-3 text-sm font-medium text-brand-fg">Browse docs</Link>
          <Link href="/playground" className="rounded-full border border-line px-6 py-3 text-sm font-medium hover:bg-soft">Open playground</Link>
        </div>
      </div>
    </section>
  );
}
