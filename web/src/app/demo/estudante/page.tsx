import type { Metadata } from "next";
import { t } from "@/lib/i18n/pt-BR";
import { DemoStudent } from "./demo-student";

export const metadata: Metadata = { title: `${t.student.demoTitle} · ${t.app.name}` };

export default function Page() {
  return <DemoStudent />;
}
