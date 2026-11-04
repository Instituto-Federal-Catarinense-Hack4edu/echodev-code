import type { Metadata } from "next";
import { SiteHeader } from "@/components/brand";
import { t } from "@/lib/i18n/pt-BR";
import { DemoTeacher } from "./demo-teacher";

export const metadata: Metadata = { title: `${t.teacher.demoTitle} · ${t.app.name}` };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <DemoTeacher />
    </>
  );
}
