"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/context";

export type Purpose = "termos_uso" | "tratamento_dados" | "doacao_lexico" | "doacao_sinais";
export const REQUIRED_PURPOSES: Purpose[] = ["termos_uso", "tratamento_dados"];
export const OPTIONAL_PURPOSES: Purpose[] = ["doacao_lexico", "doacao_sinais"];

interface Props {
  purposes: Purpose[];
  onDone: (granted: Purpose[]) => Promise<void>;
}

export function ConsentFlow({ purposes, onDone }: Props) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState(false);
  const [granted, setGranted] = useState<Purpose[]>([]);
  const [saving, setSaving] = useState(false);
  const purpose = purposes[index];
  const required = REQUIRED_PURPOSES.includes(purpose);
  const text = t.consent.purposes[purpose];

  async function advance(agree: boolean) {
    const nextGranted = agree ? [...granted, purpose] : granted;
    setGranted(nextGranted);
    setChecked(false);
    if (index + 1 < purposes.length) {
      setIndex(index + 1);
      return;
    }
    setSaving(true);
    try {
      await onDone(nextGranted);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-5 p-6">
      <p className="text-sm text-muted-foreground">{t.consent.step(index + 1, purposes.length)}</p>
      <h1 className="text-2xl font-bold">{t.consent.title}</h1>
      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-lg font-semibold">{text.title}</h2>
        <p>{text.body}</p>
        <p className="text-sm italic text-muted-foreground">{t.consent.placeholder}</p>
        <p className="text-sm font-medium">{required ? t.consent.required : t.consent.optional}</p>
      </section>
      <div className="flex min-h-11 items-center gap-3">
        <Checkbox
          id={`consent-${purpose}`}
          checked={checked}
          onCheckedChange={(v) => setChecked(v === true)}
          className="size-6"
        />
        <Label htmlFor={`consent-${purpose}`} className="text-base">
          {t.consent.agree}
        </Label>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => advance(true)} disabled={!checked || saving}>
          {t.consent.continue}
        </Button>
        {!required && (
          <Button variant="outline" onClick={() => advance(false)} disabled={saving}>
            {t.consent.skip}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{t.consent.minors}</p>
    </main>
  );
}
