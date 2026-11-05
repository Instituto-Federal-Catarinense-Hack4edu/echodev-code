import { Suspense } from "react";
import { RoleGate } from "@/components/role-gate";
import { LoadingState } from "@/components/states";
import { t } from "@/lib/i18n/pt-BR";
import { StudentLesson } from "./student-lesson";

export default function Page() {
  return (
    <Suspense fallback={<LoadingState text={t.common.loading} />}>
      <RoleGate role="estudante">
        <StudentLesson />
      </RoleGate>
    </Suspense>
  );
}
