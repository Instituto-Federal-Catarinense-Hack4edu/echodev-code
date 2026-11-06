import { cn } from "@/lib/utils";

export type PillTone = "live" | "ok" | "warn" | "error" | "idle" | "busy";

const TONE: Record<PillTone, { pill: string; dot: string }> = {
  live: { pill: "bg-live/10 text-live", dot: "bg-live live-dot text-live" },
  ok: { pill: "bg-success-soft text-success", dot: "bg-success" },
  warn: { pill: "bg-warning-soft text-warning", dot: "bg-warning motion-safe:animate-pulse" },
  error: { pill: "bg-danger-soft text-destructive", dot: "bg-destructive" },
  idle: { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/70" },
  busy: { pill: "bg-primary-soft text-primary-soft-foreground", dot: "bg-primary motion-safe:animate-pulse" },
};

/** Colored dot + short label. Color is never the only signal: the label always says the state. */
export function StatusPill({
  tone,
  children,
  className,
  live,
}: {
  tone: PillTone;
  children: React.ReactNode;
  className?: string;
  /** Announce changes to screen readers. */
  live?: boolean;
}) {
  const s = TONE[tone];
  return (
    <span
      aria-live={live ? "polite" : undefined}
      className={cn(
        "inline-flex min-h-7 items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap",
        s.pill,
        className,
      )}
    >
      <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", s.dot)} />
      {children}
    </span>
  );
}

export function StatusDot({ tone, className }: { tone: PillTone; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-full", TONE[tone].dot, className)} />;
}
