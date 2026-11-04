import { Suspense } from "react";
import { SiteHeader } from "@/components/brand";
import { t } from "@/lib/i18n/pt-BR";
import { StudentReview } from "./student-review";

export default function Page() {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<p className="p-6 text-muted-foreground">{t.common.loading}</p>}>
        <StudentReview />
      </Suspense>
    </>
  );
}
