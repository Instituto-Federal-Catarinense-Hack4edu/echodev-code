import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { t } from "@/lib/i18n/pt-BR";
import { NewLessonForm } from "./new-lesson-form";

// The teacher area lives behind RoleGate (Firebase session exists only in the browser), so it
// never renders on the server and cannot be validated for instant navigation.
export const instant = false;

export const metadata: Metadata = { title: `${t.lessons.new} · ${t.app.name}` };

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8 sm:py-10">
      <PageHeader
        back={{ href: "/professor", label: t.lessons.title }}
        title={t.lessons.new}
        description={t.lessons.newIntro}
      />
      <NewLessonForm />
    </main>
  );
}
