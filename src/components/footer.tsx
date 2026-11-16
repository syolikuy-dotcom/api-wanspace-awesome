import Link from "next/link";
import { navLinks, site } from "@/config/site";

export function Footer({ endpoints, categories }: { endpoints: number; categories: number }) {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="min-w-0">
          <p className="font-mono text-lg font-semibold">
            {site.short}
            <span className="text-muted">.api</span>
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            {endpoints} free REST endpoints across {categories} categories. No API key, no signup — just fetch.
          </p>
        </div>
        <div>
          <p className="label">Explore</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {navLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-muted transition-colors hover:text-foreground">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="label">Connect</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <a href={site.instagram} target="_blank" rel="noopener noreferrer" className="text-muted transition-colors hover:text-foreground">
                Instagram @wtf.w4n_
              </a>
            </li>
            <li>
              <a href="/api" className="text-muted transition-colors hover:text-foreground">
                API index (JSON)
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-muted sm:px-8">© {new Date().getFullYear()} {site.name}. Data is provided by third-party sources — see their terms for reuse.</p>
      </div>
    </footer>
  );
}
