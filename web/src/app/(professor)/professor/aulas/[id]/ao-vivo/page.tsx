import { Suspense } from "react";
import { LoadingState } from "@/components/states";
import { t } from "@/lib/i18n/pt-BR";
import { TeacherLive } from "./teacher-live";

export default function Page() {
  return (
    <Suspense fallback={<LoadingState text={t.common.loading} />}>
      <TeacherLive />
    </Suspense>
  );
}
