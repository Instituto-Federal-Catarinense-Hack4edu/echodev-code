import type { Metadata } from "next";
import { SiteHeader } from "@/components/brand";
import { PageHeader } from "@/components/page-header";
import { t } from "@/lib/i18n/pt-BR";
import { Account } from "./account";

export const metadata: Metadata = { title: `${t.account.title} · ${t.app.name}` };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8 sm:py-10">
        <PageHeader title={t.account.title} />
        <Account />
      </main>
    </>
  );
}
