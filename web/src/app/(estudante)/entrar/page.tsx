import type { Metadata } from "next";
import { BookOpenText, Captions, ClipboardCheck } from "lucide-react";
import { BrandMark, SiteHeader } from "@/components/brand";
import { t } from "@/lib/i18n/pt-BR";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: `${t.auth.title} · ${t.app.name}` };

const POINTS = [
  { icon: Captions, ...t.home.features.captions },
  { icon: BookOpenText, ...t.home.features.terms },
  { icon: ClipboardCheck, ...t.home.features.materials },
];

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="bg-glow flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-14">
        <div className="surface grid w-full max-w-4xl overflow-hidden md:grid-cols-[1fr_1.1fr]">
          <aside className="relative hidden flex-col justify-between gap-10 bg-primary p-8 text-primary-foreground md:flex">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-2xl"
            />
            <div className="relative space-y-4">
              <span className="grid size-12 place-items-center rounded-2xl bg-white/95 shadow-sm">
                <BrandMark className="size-8" />
              </span>
              <p className="text-2xl leading-snug font-bold tracking-tight">{t.app.tagline}</p>
            </div>
            <ul className="relative space-y-4">
              {POINTS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15">
                    <Icon aria-hidden className="size-4.5" />
                  </span>
                  <span className="text-sm">
                    <span className="block font-semibold">{title}</span>
                    <span className="opacity-85">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </aside>
          <div className="space-y-6 p-6 sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight">{t.auth.title}</h1>
            <LoginForm />
          </div>
        </div>
      </main>
    </>
  );
}
