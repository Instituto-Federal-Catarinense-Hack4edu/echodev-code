import type { Metadata } from "next";
import { t } from "@/lib/i18n/pt-BR";
import { NewLessonForm } from "./new-lesson-form";

export const metadata: Metadata = { title: `${t.lessons.new} · ${t.app.name}` };

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-bold">{t.lessons.new}</h1>
      <NewLessonForm />
    </main>
  );
}
