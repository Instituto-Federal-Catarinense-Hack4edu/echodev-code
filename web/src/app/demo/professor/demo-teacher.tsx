"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { TeacherConsole } from "@/components/teacher-console";
import { buttonVariants } from "@/components/ui/button";
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
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:py-8">
      <PageHeader
        title={t.teacher.demoTitle}
        actions={
          <Link href="/demo/estudante" target="_blank" className={buttonVariants({ variant: "outline" })}>
            <ExternalLink aria-hidden />
            {t.teacher.openStudentDemo}
          </Link>
        }
      />
      <TeacherConsole transport={transport} onReady={onReady} />
    </main>
  );
}
