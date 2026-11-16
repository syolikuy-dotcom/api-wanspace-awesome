import { cn } from "@/lib/utils";

export type DotState = "operational" | "degraded" | "down" | "unknown";

const color: Record<DotState, string> = { operational: "bg-ok", degraded: "bg-warn", down: "bg-bad", unknown: "bg-muted" };

export function StatusDot({ state, pulse, className }: { state: DotState; pulse?: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2.5 shrink-0", className)} aria-hidden>
      {pulse && <span className={cn("absolute inset-0 rounded-full animate-ping2", color[state])} />}
      <span className={cn("relative inline-block size-full rounded-full", color[state])} />
    </span>
  );
}
