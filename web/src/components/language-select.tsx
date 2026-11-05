"use client";

import { Languages } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { LangSchema, type Lang } from "@/lib/terms/schemas";

const OPTIONS: Lang[] = ["pt", "es", "en"];

export function LanguageSelect({ value, onChange }: { value: Lang; onChange: (lang: Lang) => void }) {
  const t = useT();
  return (
    <label className="inline-flex min-h-11 items-center gap-1 text-sm">
      <Languages aria-hidden className="size-4" />
      <span className="sr-only">{t.student.language}</span>
      <select
        value={value}
        onChange={(e) => {
          const lang = LangSchema.safeParse(e.target.value).data;
          if (lang) onChange(lang);
        }}
        className="rounded-md border bg-background px-2 py-1"
      >
        {OPTIONS.map((l) => (
          <option key={l} value={l}>
            {t.termSheet.langs[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
