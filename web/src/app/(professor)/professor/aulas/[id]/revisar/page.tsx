import { Suspense } from "react";
import { LoadingState } from "@/components/states";
import { t } from "@/lib/i18n/pt-BR";
import { TeacherReview } from "./teacher-review";

export default function Page() {
  return (
    <Suspense fallback={<LoadingState text={t.common.loading} />}>
      <TeacherReview />
    </Suspense>
  );
}
