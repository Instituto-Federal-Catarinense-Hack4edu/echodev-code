import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden className={cn("size-5 animate-spin text-primary", className)} />;
}

/** Centered loading message for whole screens or panels. */
export function LoadingState({ text, className }: { text: string; className?: string }) {
  return (
    <div role="status" className={cn("flex flex-1 items-center justify-center gap-3 p-10 text-muted-foreground", className)}>
      <Spinner />
      <span>{text}</span>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card/60 px-6 py-10 text-center",
        className,
      )}
    >
      <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
        <Icon aria-hidden className="size-7" />
      </span>
      <p className="text-base font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Centered card for whole-screen messages (not found, wrong role, join errors). */
export function MessageCard({
  icon: Icon,
  title,
  children,
  action,
  tone = "neutral",
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "neutral" | "warning";
}) {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-20">
      <div className="surface w-full max-w-lg space-y-4 p-6 text-center sm:p-8">
        <span
          className={cn(
            "mx-auto grid size-14 place-items-center rounded-2xl",
            tone === "warning" ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary-soft-foreground",
          )}
        >
          <Icon aria-hidden className="size-7" />
        </span>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {children && <div className="text-muted-foreground">{children}</div>}
        {action && <div className="flex flex-wrap justify-center gap-2 pt-2">{action}</div>}
      </div>
    </main>
  );
}

type Tone = "info" | "success" | "warning" | "error";

const TONES: Record<Tone, { icon: LucideIcon; className: string }> = {
  info: { icon: Info, className: "border-border bg-muted/60 text-foreground [&_svg]:text-muted-foreground" },
  success: { icon: CheckCircle2, className: "border-success/25 bg-success-soft text-foreground [&_svg]:text-success" },
  warning: { icon: AlertTriangle, className: "border-warning/30 bg-warning-soft text-foreground [&_svg]:text-warning" },
  error: { icon: XCircle, className: "border-destructive/30 bg-danger-soft text-destructive [&_svg]:text-destructive" },
};

/** Inline message box. Errors are announced right away; the rest politely. */
export function Notice({
  tone = "info",
  children,
  className,
  icon,
  live = true,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  icon?: LucideIcon;
  live?: boolean;
}) {
  const { icon: DefaultIcon, className: toneClass } = TONES[tone];
  const Icon = icon ?? DefaultIcon;
  return (
    <div
      role={live ? (tone === "error" ? "alert" : "status") : undefined}
      className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed", toneClass, className)}
    >
      <Icon aria-hidden className="mt-0.5 size-4.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
