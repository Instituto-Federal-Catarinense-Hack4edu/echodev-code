import type { Metadata } from "next";
import { t } from "@/lib/i18n/pt-BR";
import { LessonsList } from "./lessons-list";

export const metadata: Metadata = { title: `${t.lessons.title} · ${t.app.name}` };

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-bold">{t.lessons.title}</h1>
      <LessonsList />
    </main>
  );
}
