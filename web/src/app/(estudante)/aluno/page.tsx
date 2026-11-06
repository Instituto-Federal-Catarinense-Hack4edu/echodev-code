import type { Metadata } from "next";
import { SiteHeader } from "@/components/brand";
import { RoleGate } from "@/components/role-gate";
import { t } from "@/lib/i18n/pt-BR";
import { StudentHome } from "./student-home";

// RoleGate waits for the Firebase session, which only exists in the browser, so this segment
// never renders on the server and cannot be validated for instant navigation.
export const instant = false;

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
