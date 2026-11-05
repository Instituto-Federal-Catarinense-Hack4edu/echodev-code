"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, WifiOff } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { TeacherConsole } from "@/components/teacher-console";
import { buttonVariants } from "@/components/ui/button";
import { LocalTransport } from "@/lib/realtime/local";
import type { UtteranceMessage } from "@/lib/realtime/schemas";
import { t } from "@/lib/i18n/pt-BR";

export const DEMO_LESSON_ID = "demo";

const STEPS = [t.teacher.demoSteps.open, t.teacher.demoSteps.start, t.teacher.demoSteps.tap];

export function DemoTeacher() {
  const [transport, setTransport] = useState<LocalTransport | null>(null);

  useEffect(() => {
    const tr = new LocalTransport(DEMO_LESSON_ID);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- BroadcastChannel only exists in the browser
    setTransport(tr);
    return () => tr.close();
  }, []);

  const onReady = useCallback(
    (api: { historySince: (afterSeq: number) => UtteranceMessage[] }) => {
      transport?.serveHistory(api.historySince);
    },
    [transport],
  );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:py-8">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <WifiOff aria-hidden className="size-3.5" />
            {t.home.demoTitle}
          </span>
        }
        title={t.teacher.demoTitle}
        description={t.home.demoHint}
        actions={
          <Link href="/demo/estudante" target="_blank" className={buttonVariants({ variant: "outline" })}>
            <ExternalLink aria-hidden />
            {t.teacher.openStudentDemo}
          </Link>
        }
      >
        <ol aria-label={t.teacher.demoSteps.title} className="grid gap-2 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-3 rounded-xl border bg-card/70 px-3.5 py-3 text-sm">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </PageHeader>
      <TeacherConsole transport={transport} onReady={onReady} />
    </main>
  );
}
