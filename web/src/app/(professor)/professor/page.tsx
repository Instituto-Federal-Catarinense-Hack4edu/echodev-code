import type { Metadata } from "next";
import { t } from "@/lib/i18n/pt-BR";
import { LessonsList } from "./lessons-list";

export const metadata: Metadata = { title: `${t.lessons.title} · ${t.app.name}` };

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-10">
      <LessonsList />
    </main>
  );
}
