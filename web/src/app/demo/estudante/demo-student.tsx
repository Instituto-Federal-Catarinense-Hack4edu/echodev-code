"use client";

import { useEffect, useState } from "react";
import { StudentView } from "@/components/student-view";
import { LocalTransport } from "@/lib/realtime/local";
import { useLocalPrefs } from "@/lib/use-local-prefs";
import { useDebugFlag } from "@/lib/use-debug-flag";
import { t } from "@/lib/i18n/pt-BR";

const DEMO_LESSON_ID = "demo";

export function DemoStudent() {
  const [transport, setTransport] = useState<LocalTransport | null>(null);
  const [prefs, setPrefs] = useLocalPrefs();
  const debug = useDebugFlag();

  useEffect(() => {
    const tr = new LocalTransport(DEMO_LESSON_ID);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- BroadcastChannel only exists in the browser
    setTransport(tr);
    return () => tr.close();
  }, []);

  return (
    <StudentView
      transport={transport}
      fetchSince={transport?.fetchSince ?? null}
      title={t.student.demoTitle}
      depth={prefs.depth}
      lang={prefs.lang}
      onDepthChange={(depth) => setPrefs({ depth })}
      onLangChange={(lang) => setPrefs({ lang })}
      debug={debug}
    />
  );
}
