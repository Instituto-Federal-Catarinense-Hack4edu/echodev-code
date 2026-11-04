import type { Metadata } from "next";
import { SiteHeader } from "@/components/brand";
import { t } from "@/lib/i18n/pt-BR";
import { ResetPassword } from "./reset-password";

export const metadata: Metadata = { title: `${t.auth.resetTitle} · ${t.app.name}` };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 space-y-6 p-6">
        <h1 className="text-2xl font-bold">{t.auth.resetTitle}</h1>
        <ResetPassword />
      </main>
    </>
  );
}
