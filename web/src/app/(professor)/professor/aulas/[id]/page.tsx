import { Suspense } from "react";
import { LoadingState } from "@/components/states";
import { t } from "@/lib/i18n/pt-BR";
import { LessonDashboard } from "./lesson-dashboard";

export default function Page() {
  return (
    <Suspense fallback={<LoadingState text={t.common.loading} />}>
      <LessonDashboard />
    </Suspense>
  );
}
