import type { Metadata } from "next";
import { t } from "@/lib/i18n/pt-BR";
import { Account } from "./account";

export const metadata: Metadata = { title: `${t.account.title} · ${t.app.name}` };

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-bold">{t.account.title}</h1>
      <Account />
    </main>
  );
}
