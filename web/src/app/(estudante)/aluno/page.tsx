import type { Metadata } from "next";
import { SiteHeader } from "@/components/brand";
import { RoleGate } from "@/components/role-gate";
import { t } from "@/lib/i18n/pt-BR";
import { StudentHome } from "./student-home";

export const metadata: Metadata = { title: `${t.student_area.title} · ${t.app.name}` };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <RoleGate role="estudante">
        <StudentHome />
      </RoleGate>
    </>
  );
}
