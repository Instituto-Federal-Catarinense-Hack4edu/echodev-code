import { Suspense } from "react";
import { RoleGate } from "@/components/role-gate";
import { LoadingState } from "@/components/states";
import { t } from "@/lib/i18n/pt-BR";
import { StudentLesson } from "./student-lesson";

// RoleGate waits for the Firebase session, which only exists in the browser, so this segment
// never renders on the server and cannot be validated for instant navigation.
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<LoadingState text={t.common.loading} />}>
      <RoleGate role="estudante">
        <StudentLesson />
      </RoleGate>
    </Suspense>
  );
}
