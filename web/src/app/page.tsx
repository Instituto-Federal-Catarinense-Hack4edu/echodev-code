import Link from "next/link";
import { t } from "@/lib/i18n/pt-BR";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-4xl font-bold">{t.app.name}</h1>
      <p className="text-lg text-muted-foreground">{t.app.tagline}</p>
      <nav className="flex flex-col gap-3 sm:flex-row">
        <Link className="underline underline-offset-4" href="/demo/professor">
          {t.home.demoTeacher}
        </Link>
        <Link className="underline underline-offset-4" href="/demo/estudante">
          {t.home.demoStudent}
        </Link>
      </nav>
    </main>
  );
}
