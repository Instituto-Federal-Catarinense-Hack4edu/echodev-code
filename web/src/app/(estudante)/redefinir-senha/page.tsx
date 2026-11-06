import type { Metadata } from "next";
import { SiteHeader } from "@/components/brand";
import { t } from "@/lib/i18n/pt-BR";
import { ResetPassword } from "./reset-password";

export const metadata: Metadata = { title: `${t.auth.resetTitle} · ${t.app.name}` };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="bg-glow flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        <div className="surface w-full max-w-md space-y-6 p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">{t.auth.resetTitle}</h1>
          <ResetPassword />
        </div>
      </main>
    </>
  );
}
