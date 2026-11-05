import Link from "next/link";
import { BrandLogo, SiteHeader } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n/pt-BR";
import { HomeRedirect } from "./home-redirect";
import { JoinForm } from "./join-form";

export default function Home() {
  return (
    <>
      <HomeRedirect />
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 p-6">
        <div className="space-y-4">
          <h1>
            <span className="sr-only">{t.app.name}</span>
            <BrandLogo priority className="h-16 sm:h-20" />
          </h1>
          <p className="text-lg text-muted-foreground">{t.app.tagline}</p>
        </div>

        <section className="space-y-2 rounded-xl border p-4">
          <JoinForm />
          <p className="text-sm text-muted-foreground">{t.home.studentHint}</p>
        </section>

        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-lg font-semibold">{t.home.teacherArea}</h2>
          <p className="text-sm text-muted-foreground">{t.home.teacherHint}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/entrar?next=/professor" className={buttonVariants()}>
              {t.home.teacherLogin}
            </Link>
            <Link href="/entrar?next=/professor&modo=criar" className={buttonVariants({ variant: "outline" })}>
              {t.home.createAccount}
            </Link>
          </div>
        </section>

        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer py-2 font-medium">{t.home.demoTitle}</summary>
          <p className="text-muted-foreground">{t.home.demoHint}</p>
          <nav className="mt-2 flex flex-col gap-1">
            <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/demo/professor">
              {t.home.demoTeacher}
            </Link>
            <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/demo/estudante">
              {t.home.demoStudent}
            </Link>
          </nav>
        </details>
      </main>
    </>
  );
}
