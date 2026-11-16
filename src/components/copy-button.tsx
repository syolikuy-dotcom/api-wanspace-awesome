"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";

export function CopyButton({ text, label = "Copy", className, dark }: { text: string; label?: string; className?: string; dark?: boolean }) {
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      toast("Couldn't copy — select the text manually.", "error");
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
        dark ? "text-zinc-400 hover:bg-white/10 hover:text-white" : "text-muted hover:bg-soft hover:text-foreground",
        className,
      )}
    >
      {done ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
      <span>{done ? "Copied" : label}</span>
    </button>
  );
}
