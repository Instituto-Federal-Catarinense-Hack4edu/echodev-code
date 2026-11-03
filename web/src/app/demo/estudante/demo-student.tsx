"use client";

import { useEffect, useState } from "react";
import { PrefsToggles } from "@/components/prefs-toggles";
import { StudentView } from "@/components/student-view";
import { useCalmMode } from "@/lib/use-calm-mode";
import { LocalTransport } from "@/lib/realtime/local";
import { useLocalPrefs } from "@/lib/use-local-prefs";
import { useDebugFlag } from "@/lib/use-debug-flag";
import { t } from "@/lib/i18n/pt-BR";

const DEMO_LESSON_ID = "demo";

export function DemoStudent() {
  const [transport, setTransport] = useState<LocalTransport | null>(null);
  const [prefs, setPrefs] = useLocalPrefs();
  const debug = useDebugFlag();
  useCalmMode(prefs.calm);

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
      literalMode={prefs.literal}
      onDepthChange={(depth) => setPrefs({ depth })}
      onLangChange={(lang) => setPrefs({ lang })}
      debug={debug}
      headerExtra={
        <PrefsToggles
          calm={prefs.calm}
          literal={prefs.literal}
          onCalm={(calm) => setPrefs({ calm })}
          onLiteral={(literal) => setPrefs({ literal })}
        />
      }
    />
  );
}
