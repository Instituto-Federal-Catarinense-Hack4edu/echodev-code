import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Title block shared by the inner pages: optional back link, eyebrow, description and actions. */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  back,
  className,
  children,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={cn("space-y-3", className)}>
      {back && (
        <Link
          href={back.href}
          className="group inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4 transition-transform group-hover:-translate-x-0.5" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="mr-auto min-w-0 space-y-1.5">
          {eyebrow && (
            <div className="text-xs font-semibold tracking-wider text-primary uppercase">{eyebrow}</div>
          )}
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {description && <div className="max-w-2xl text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/** Section heading with an icon chip, used inside cards. */
export function SectionTitle({
  icon: Icon,
  children,
  id,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
  id?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {Icon && (
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground">
          <Icon aria-hidden className="size-4.5" />
        </span>
      )}
      <h2 id={id} className="mr-auto text-base font-semibold">
        {children}
      </h2>
      {action}
    </div>
  );
}
