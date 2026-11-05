"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CODE_LENGTH, CODE_RE, normalizeCode } from "@/lib/lesson-code";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export function JoinForm() {
  const t = useT();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [going, setGoing] = useState(false);
  const valid = CODE_RE.test(code);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        setGoing(true);
        router.push(`/aula/${code}`);
      }}
    >
      <Label id="join-title" htmlFor="code" className="text-lg font-semibold">
        <KeyRound aria-hidden className="size-5 text-primary" />
        {t.home.joinTitle}
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Input
            id="code"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={8}
            placeholder={t.home.joinPlaceholder}
            aria-describedby="code-count"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            className={cn(
              "h-13 pr-20 font-mono text-xl font-semibold tracking-[0.35em] placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-normal md:text-xl",
              valid && "border-success ring-3 ring-success/15",
            )}
          />
          <span
            id="code-count"
            aria-live="polite"
            className={cn(
              "pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-xs tabular-nums",
              valid ? "text-success" : "text-muted-foreground",
            )}
          >
            <span className="sr-only">{t.home.joinCount(Math.min(code.length, CODE_LENGTH), CODE_LENGTH)}</span>
            <span aria-hidden>
              {Math.min(code.length, CODE_LENGTH)}/{CODE_LENGTH}
            </span>
          </span>
        </div>
        <Button type="submit" size="lg" disabled={!valid || going} className="h-13 sm:px-6">
          {t.home.joinButton}
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </form>
  );
}
