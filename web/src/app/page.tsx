import Link from "next/link";
import {
  BookOpenText,
  Captions,
  ClipboardCheck,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { BrandMark, SiteFooter, SiteHeader } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n/pt-BR";
import { HomePreview } from "./home-preview";
import { HomeRedirect } from "./home-redirect";
import { JoinForm } from "./join-form";

const FEATURES: { icon: LucideIcon; key: keyof typeof t.home.features }[] = [
  { icon: Captions, key: "captions" },
  { icon: BookOpenText, key: "terms" },
  { icon: ClipboardCheck, key: "materials" },
];

export default function Home() {
  return (
    <>
      <HomeRedirect />
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-glow relative">
          <div className="mx-auto grid w-full max-w-6xl items-start gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:py-16">
            <div className="space-y-8">
              <div className="space-y-5">
                <span className="inline-flex items-center gap-2 rounded-full border bg-card/80 py-1 pr-3 pl-1 text-xs font-semibold text-muted-foreground shadow-xs">
                  <BrandMark className="size-6" />
                  {t.home.eyebrow}
                </span>
                <h1 className="text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl lg:text-[3.25rem]">
                  <span className="sr-only">{t.app.name}: </span>
                  {t.app.tagline}
                </h1>
                <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">{t.home.heroLead}</p>
              </div>

              <section className="surface space-y-3 p-5 sm:p-6" aria-labelledby="join-title">
                <JoinForm />
                <p className="text-sm text-muted-foreground">{t.home.studentHint}</p>
              </section>

              <section className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-dashed p-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                  <Presentation aria-hidden className="size-5" />
                </span>
                <div className="mr-auto min-w-0 flex-1 basis-56">
                  <h2 className="font-semibold">{t.home.teacherArea}</h2>
                  <p className="text-sm text-muted-foreground">{t.home.teacherHint}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href="/entrar?next=/professor" className={buttonVariants()}>
                    {t.home.teacherLogin}
                  </Link>
                  <Link
                    href="/entrar?next=/professor&modo=criar"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    {t.home.createAccount}
                  </Link>
                </div>
              </section>
            </div>

            <div className="lg:sticky lg:top-24">
              <HomePreview />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pt-2 pb-16">
          <ul className="grid gap-4 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, key }) => (
              <li key={key} className="surface space-y-3 p-6 transition-shadow hover:shadow-[var(--shadow-lift)]">
                <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h2 className="text-lg font-semibold">{t.home.features[key].title}</h2>
                <p className="text-muted-foreground">{t.home.features[key].body}</p>
              </li>
            ))}
          </ul>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}

