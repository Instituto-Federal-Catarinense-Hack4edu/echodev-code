import { Suspense } from "react";
import { SiteHeader } from "@/components/brand";
import { RoleGate } from "@/components/role-gate";
import { LoadingState } from "@/components/states";
import { t } from "@/lib/i18n/pt-BR";
import { StudentReview } from "./student-review";

// RoleGate waits for the Firebase session, which only exists in the browser, so this segment
// never renders on the server and cannot be validated for instant navigation.
export const instant = false;

export default function Page() {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<LoadingState text={t.common.loading} />}>
        <RoleGate role="estudante">
          <StudentReview />
        </RoleGate>
      </Suspense>
    </>
  );
}
