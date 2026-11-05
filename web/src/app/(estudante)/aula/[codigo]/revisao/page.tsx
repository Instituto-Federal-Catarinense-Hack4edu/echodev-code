import { Suspense } from "react";
import { SiteHeader } from "@/components/brand";
import { RoleGate } from "@/components/role-gate";
import { LoadingState } from "@/components/states";
import { t } from "@/lib/i18n/pt-BR";
import { StudentReview } from "./student-review";

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
