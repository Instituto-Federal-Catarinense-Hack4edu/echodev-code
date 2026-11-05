import { Suspense } from "react";
import { t } from "@/lib/i18n/pt-BR";
import { LessonDashboard } from "./lesson-dashboard";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-muted-foreground">{t.common.loading}</p>}>
      <LessonDashboard />
    </Suspense>
  );
}
