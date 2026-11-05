"use client";

import { useState } from "react";
import { ArrowRight, Baby, FileText, HeartHandshake, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/states";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export type Purpose = "termos_uso" | "tratamento_dados" | "doacao_lexico" | "doacao_sinais";
export const REQUIRED_PURPOSES: Purpose[] = ["termos_uso", "tratamento_dados"];
export const OPTIONAL_PURPOSES: Purpose[] = ["doacao_lexico", "doacao_sinais"];

export const PURPOSE_ICONS: Record<Purpose, LucideIcon> = {
  termos_uso: FileText,
  tratamento_dados: ShieldCheck,
  doacao_lexico: Sparkles,
  doacao_sinais: HeartHandshake,
};

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
  const Icon = PURPOSE_ICONS[purpose];

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
    <main className="bg-glow flex-1 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-xl space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-muted-foreground">{t.consent.step(index + 1, purposes.length)}</span>
          </div>
          <div className="flex gap-1.5" aria-hidden>
            {purposes.map((p, i) => (
              <span
                key={p}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i < index ? "bg-primary" : i === index ? "bg-primary/50" : "bg-foreground/10",
                )}
              />
            ))}
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.consent.title}</h1>
        </div>

        <section key={purpose} className="surface animate-rise space-y-5 p-5 sm:p-7" aria-labelledby="consent-h">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
              <Icon aria-hidden className="size-6" />
            </span>
            <div className="min-w-0 space-y-1.5">
              <Badge variant={required ? "soft" : "secondary"}>
                {required ? t.consent.required : t.consent.optional}
              </Badge>
              <h2 id="consent-h" className="text-lg font-semibold">
                {text.title}
              </h2>
            </div>
          </div>
          <p className="leading-relaxed">{text.body}</p>
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground italic">{t.consent.placeholder}</p>

          <Label
            htmlFor={`consent-${purpose}`}
            className={cn(
              "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-base transition-colors",
              checked ? "border-primary bg-primary-soft/50" : "border-border hover:border-foreground/25",
            )}
          >
            <Checkbox
              id={`consent-${purpose}`}
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
              className="size-6"
            />
            {t.consent.agree}
          </Label>

          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={() => advance(true)} disabled={!checked || saving}>
              {saving ? <Spinner className="text-current" /> : null}
              {t.consent.continue}
              {!saving && <ArrowRight aria-hidden />}
            </Button>
            {!required && (
              <Button size="lg" variant="outline" onClick={() => advance(false)} disabled={saving}>
                {t.consent.skip}
              </Button>
            )}
          </div>
        </section>

        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Baby aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t.consent.minors}
        </p>
      </div>
    </main>
  );
}
