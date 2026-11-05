import Image from "next/image";
import Link from "next/link";
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
      className={cn("h-8 w-auto", className)}
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
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        <Link href="/" aria-label={t.brand.home} className="mr-auto inline-flex min-h-11 items-center">
          <BrandLogo />
        </Link>
        {children}
        {showUser && <UserMenu />}
      </div>
    </header>
  );
}
