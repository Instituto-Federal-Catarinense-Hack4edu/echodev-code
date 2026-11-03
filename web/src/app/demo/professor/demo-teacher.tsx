"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TeacherConsole } from "@/components/teacher-console";
import { LocalTransport } from "@/lib/realtime/local";
import type { UtteranceMessage } from "@/lib/realtime/schemas";
import { t } from "@/lib/i18n/pt-BR";

export const DEMO_LESSON_ID = "demo";

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
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold">{t.teacher.demoTitle}</h1>
        <Link
          href="/demo/estudante"
          target="_blank"
          className="inline-flex min-h-11 items-center underline underline-offset-4"
        >
          {t.teacher.openStudentDemo}
        </Link>
      </header>
      <p className="text-sm text-muted-foreground">{t.home.demoHint}</p>
      <TeacherConsole transport={transport} onReady={onReady} />
    </main>
  );
}
