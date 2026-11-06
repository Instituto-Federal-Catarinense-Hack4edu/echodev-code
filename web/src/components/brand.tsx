import Image from "next/image";
import { Suspense } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { t } from "@/lib/i18n/pt-BR";
import { cn } from "@/lib/utils";

export function BrandLogo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/echodev-logo.png"
      alt={t.app.name}
      width={1895}
      height={400}
      priority={priority}
      // The logo has dark ink; lift it a little on the dark theme.
      className={cn("h-8 w-auto dark:invert dark:hue-rotate-180", className)}
    />
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/echodev-mark.png"
      alt=""
      aria-hidden
      width={256}
      height={256}
      className={cn("size-7 shrink-0", className)}
    />
  );
}

export function SiteHeader({ children, showUser = true }: { children?: React.ReactNode; showUser?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-4 py-2 sm:gap-3">
        <Link
          href="/"
          aria-label={t.brand.home}
          className="mr-auto inline-flex min-h-11 items-center rounded-lg transition-opacity hover:opacity-80"
        >
          <BrandLogo className="h-7 sm:h-8" />
        </Link>
        {children}
        <ThemeToggle />
        {showUser && (
          // UserMenu reads the URL (active link): stream it so pages can still prerender.
          <Suspense fallback={<span className="inline-block h-11 w-24 animate-pulse rounded-xl bg-muted" aria-hidden />}>
            <UserMenu />
          </Suspense>
        )}
      </div>
    </header>
  );
}

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t", className)}>
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2 font-medium text-foreground">
          <BrandMark className="size-5" />
          {t.app.name}
        </span>
      </div>
    </footer>
  );
}
