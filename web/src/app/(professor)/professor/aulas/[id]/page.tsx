import { Suspense } from "react";
import { LoadingState } from "@/components/states";
import { t } from "@/lib/i18n/pt-BR";
import { LessonDashboard } from "./lesson-dashboard";

// The teacher area lives behind RoleGate (Firebase session exists only in the browser), so it
// never renders on the server and cannot be validated for instant navigation.
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<LoadingState text={t.common.loading} />}>
      <LessonDashboard />
    </Suspense>
  );
}
