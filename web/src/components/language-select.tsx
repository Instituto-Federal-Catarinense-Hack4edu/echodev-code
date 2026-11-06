"use client";

import { ChevronDown, Languages } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { LangSchema, type Lang } from "@/lib/terms/schemas";

const OPTIONS: Lang[] = ["pt", "es", "en"];

export function LanguageSelect({ value, onChange }: { value: Lang; onChange: (lang: Lang) => void }) {
  const t = useT();
  return (
    <label className="relative inline-flex min-h-11 items-center text-sm">
      <Languages aria-hidden className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
      <span className="sr-only">{t.student.language}</span>
      <select
        value={value}
        onChange={(e) => {
          const lang = LangSchema.safeParse(e.target.value).data;
          if (lang) onChange(lang);
        }}
        className="h-11 cursor-pointer appearance-none rounded-xl border border-input bg-card pr-8 pl-9 font-medium shadow-xs transition-colors hover:border-foreground/25"
      >
        {OPTIONS.map((l) => (
          <option key={l} value={l}>
            {t.termSheet.langs[l]}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 size-4 text-muted-foreground" />
    </label>
  );
}
