"use client";

import { useEffect, useRef, useState } from "react";
import type { HistoryPoint, Snapshot } from "@/lib/api/health";
import type { Metrics } from "@/lib/security/limiter";

export type LiveMode = "connecting" | "live" | "polling" | "offline";
export interface LiveData {
  snapshot: Snapshot | null;
  history: HistoryPoint[];
  metrics: Metrics | null;
  mode: LiveMode;
  updatedAt: number | null;
}

const initial: LiveData = { snapshot: null, history: [], metrics: null, mode: "connecting", updatedAt: null };

/**
 * Data status real-time. `sse`: Server-Sent Events (auto-reconnect; jatuh ke polling bila gagal berulang).
 * `poll`: polling ringan berkala.
 */
export function useLiveStatus(transport: "sse" | "poll" = "sse", intervalMs = 15000): LiveData {
  const [data, setData] = useState<LiveData>(initial);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let retrySse: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const ctrl = new AbortController();

    const apply = (p: { snapshot?: Snapshot | null; history?: HistoryPoint[]; metrics?: Metrics | null }, mode: LiveMode) => {
      if (!alive.current) return;
      setData((d) => ({
        snapshot: p.snapshot ?? d.snapshot,
        history: p.history ?? d.history,
        metrics: p.metrics ?? d.metrics,
        mode,
        updatedAt: Date.now(),
      }));
    };

    const poll = async () => {
      try {
        const r = await fetch("/api/status", { cache: "no-store", signal: ctrl.signal });
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        apply(j.result ?? {}, "polling");
      } catch {
        if (alive.current && !ctrl.signal.aborted) setData((d) => ({ ...d, mode: "offline" }));
      }
      if (alive.current) pollTimer = setTimeout(poll, intervalMs);
    };

    const startSse = () => {
      if (typeof EventSource === "undefined") return void poll();
      es = new EventSource("/api/stream");
      es.onmessage = (e) => {
        failures = 0;
        try {
          apply(JSON.parse(e.data), "live");
        } catch {
          /* paket rusak → abaikan */
        }
      };
      es.onerror = () => {
        failures++;
        if (failures >= 4) {
          es?.close();
          es = null;
          void poll();
          retrySse = setTimeout(() => {
            if (!alive.current) return;
            if (pollTimer) clearTimeout(pollTimer);
            failures = 0;
            startSse();
          }, 90_000);
        }
      };
    };

    if (transport === "poll") void poll();
    else startSse();

    return () => {
      alive.current = false;
      ctrl.abort();
      es?.close();
      if (pollTimer) clearTimeout(pollTimer);
      if (retrySse) clearTimeout(retrySse);
    };
  }, [transport, intervalMs]);

  return data;
}
