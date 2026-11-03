"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CODE_RE, normalizeCode } from "@/lib/lesson-code";
import { t } from "@/lib/i18n/pt-BR";

export function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const valid = CODE_RE.test(code);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) router.push(`/aula/${code}`);
      }}
    >
      <Label htmlFor="code" className="text-lg font-semibold">
        {t.home.joinTitle}
      </Label>
      <div className="flex gap-2">
        <Input
          id="code"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={8}
          placeholder={t.home.joinPlaceholder}
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value))}
          className="h-11 font-mono text-lg tracking-widest"
        />
        <Button type="submit" disabled={!valid}>
          {t.home.joinButton}
        </Button>
      </div>
    </form>
  );
}
