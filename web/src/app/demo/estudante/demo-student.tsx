"use client";

import { useEffect, useState } from "react";
import { LanguageSelect } from "@/components/language-select";
import { StudentView } from "@/components/student-view";
import { StudentI18n, useT } from "@/lib/i18n/context";
import { setStudentLang, useStudentLang } from "@/lib/i18n/student-lang";
import { LocalTransport } from "@/lib/realtime/local";
import { useLocalPrefs } from "@/lib/use-local-prefs";
import { useDebugFlag } from "@/lib/use-debug-flag";

const DEMO_LESSON_ID = "demo";

export function DemoStudent() {
  return (
    <StudentI18n>
      <DemoStudentView />
    </StudentI18n>
  );
}

function DemoStudentView() {
  const t = useT();
  const [transport, setTransport] = useState<LocalTransport | null>(null);
  const [prefs, setPrefs] = useLocalPrefs();
  const lang = useStudentLang();
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
      lang={lang}
      onDepthChange={(depth) => setPrefs({ depth })}
      onLangChange={setStudentLang}
      debug={debug}
      headerExtra={<LanguageSelect value={lang} onChange={setStudentLang} />}
    />
  );
}
