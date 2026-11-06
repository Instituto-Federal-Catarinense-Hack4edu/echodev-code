"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/context";
import { THEME_KEY } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const t = useT();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t.common.theme}
      title={t.common.theme}
      className={cn("rounded-full text-muted-foreground hover:text-foreground", className)}
      onClick={() => {
        const dark = document.documentElement.classList.toggle("dark");
        try {
          localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
        } catch {
          /* storage unavailable: the choice lasts until reload */
        }
      }}
    >
      {/* Icons swap with CSS, so the server and client render the same markup. */}
      <Moon aria-hidden className="size-5 dark:hidden" />
      <Sun aria-hidden className="hidden size-5 dark:block" />
    </Button>
  );
}
