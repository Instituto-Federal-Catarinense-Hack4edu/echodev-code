import Link from "next/link";
import { t } from "@/lib/i18n/pt-BR";
import { JoinForm } from "./join-form";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 p-6">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold">{t.app.name}</h1>
        <p className="text-lg text-muted-foreground">{t.app.tagline}</p>
      </div>
      <JoinForm />
      <nav className="flex flex-col gap-1">
        <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/professor">
          {t.home.teacherArea}
        </Link>
        <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/demo/professor">
          {t.home.demoTeacher}
        </Link>
        <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/demo/estudante">
          {t.home.demoStudent}
        </Link>
      </nav>
    </main>
  );
}
