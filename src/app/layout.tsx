import type { Metadata, Viewport } from "next";
import { Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Preloader } from "@/components/preloader";
import { ScrollProgress } from "@/components/scroll-progress";
import { BackToTop } from "@/components/back-to-top";
import { CommandPalette } from "@/components/command-palette";
import { getCatalog, getCategorySummary } from "@/lib/api/registry";
import { site } from "@/config/site";

const poppins = Poppins({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-poppins", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} — ${site.tagline}`, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  keywords: ["free api", "rest api", "no api key", "api indonesia", "anime api", "news api", "vercel"],
  openGraph: { type: "website", title: `${site.name} — ${site.tagline}`, description: site.description, siteName: site.name, url: site.url },
  twitter: { card: "summary_large_image", title: `${site.name} — ${site.tagline}`, description: site.description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const catalog = getCatalog();
  const palette = catalog.map((e) => ({ id: e.id, title: e.title, path: e.path, category: e.category, tags: e.tags }));
  const cats = getCategorySummary().length;

  return (
    <html lang="id" suppressHydrationWarning className={`${poppins.variable} ${mono.variable}`}>
      <body>
        <noscript>
          <style>{"#preloader{display:none!important}"}</style>
        </noscript>
        <Providers>
          <Preloader />
          <ScrollProgress />
          <Navbar />
          <main className="min-h-[100svh]">{children}</main>
          <Footer endpoints={catalog.length} categories={cats} />
          <BackToTop />
          <CommandPalette items={palette} />
        </Providers>
      </body>
    </html>
  );
}
