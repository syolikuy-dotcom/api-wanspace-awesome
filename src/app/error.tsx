"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="section grid min-h-[80svh] place-items-center text-center">
      <div>
        <p className="text-2xl font-semibold">Something went wrong</p>
        <p className="mt-3 text-sm text-muted">An unexpected error occurred. Please try again.</p>
        <button type="button" onClick={reset} className="mt-8 rounded-full bg-brand px-6 py-3 text-sm font-medium text-brand-fg">Try again</button>
      </div>
    </section>
  );
}
