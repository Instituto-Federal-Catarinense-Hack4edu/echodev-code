"use client";

import Link from "next/link";
import { t } from "@/lib/i18n/pt-BR";
import { cn } from "@/lib/utils";

function Toggle(props: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      title={props.hint}
      onClick={() => props.onChange(!props.checked)}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm",
        props.checked && "border-primary bg-primary text-primary-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn("inline-block size-3 rounded-full border", props.checked ? "bg-primary-foreground" : "bg-transparent")}
      />
      {props.label}
    </button>
  );
}

export function PrefsToggles(props: {
  calm: boolean;
  literal: boolean;
  onCalm: (v: boolean) => void;
  onLiteral: (v: boolean) => void;
  accountLink?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={t.prefs.settings} role="group">
      <Toggle label={t.prefs.calm} hint={t.prefs.calmHint} checked={props.calm} onChange={props.onCalm} />
      <Toggle label={t.prefs.literal} hint={t.prefs.literalHint} checked={props.literal} onChange={props.onLiteral} />
      {props.accountLink && (
        <Link href="/conta" className="inline-flex min-h-11 items-center px-2 text-sm underline underline-offset-4">
          {t.prefs.account}
        </Link>
      )}
    </div>
  );
}
