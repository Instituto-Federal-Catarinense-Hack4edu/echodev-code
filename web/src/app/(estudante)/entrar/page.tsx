import type { Metadata } from "next";
import { SiteHeader } from "@/components/brand";
import { t } from "@/lib/i18n/pt-BR";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: `${t.auth.title} · ${t.app.name}` };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 space-y-6 p-6">
        <h1 className="text-2xl font-bold">{t.auth.title}</h1>
        <LoginForm />
      </main>
    </>
  );
}
