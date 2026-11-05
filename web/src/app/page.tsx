import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  Captions,
  ClipboardCheck,
  EyeOff,
  MicOff,
  Presentation,
  Smartphone,
  Timer,
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

const PRIVACY: { icon: LucideIcon; text: string }[] = [
  { icon: MicOff, text: t.home.privacy.audio },
  { icon: Timer, text: t.home.privacy.expiry },
  { icon: EyeOff, text: t.home.privacy.aggregate },
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

            <div className="space-y-4 lg:sticky lg:top-24">
              <HomePreview />
              <ul aria-label={t.home.privacyTitle} className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {PRIVACY.map(({ icon: Icon, text }) => (
                  <li
                    key={text}
                    className="flex items-center gap-2 rounded-xl border bg-card/70 px-3 py-2.5 text-sm font-medium"
                  >
                    <Icon aria-hidden className="size-4 shrink-0 text-success" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pt-2 pb-12">
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

        <section className="mx-auto w-full max-w-6xl px-4 pb-16" aria-labelledby="demo-h">
          <div className="surface bg-dots overflow-hidden p-6 sm:p-8">
            <div className="max-w-2xl space-y-2">
              <h2 id="demo-h" className="text-2xl font-bold tracking-tight">
                {t.home.demoTitle}
              </h2>
              <p className="text-muted-foreground">{t.home.demoHint}</p>
            </div>
            <nav className="mt-6 grid gap-3 sm:grid-cols-2">
              <DemoLink href="/demo/professor" icon={Presentation} title={t.home.demoTeacher} hint={t.home.demoTeacherHint} />
              <DemoLink href="/demo/estudante" icon={Smartphone} title={t.home.demoStudent} hint={t.home.demoStudentHint} />
            </nav>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function DemoLink({ href, icon: Icon, title, hint }: { href: string; icon: LucideIcon; title: string; hint: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-lift)]"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground">
        <Icon aria-hidden className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
      <ArrowRight aria-hidden className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
    </Link>
  );
}
