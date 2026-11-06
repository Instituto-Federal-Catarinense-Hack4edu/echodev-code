import { SiteHeader } from "@/components/brand";
import { RoleGate } from "@/components/role-gate";

// RoleGate waits for the Firebase session, which only exists in the browser, so this segment
// never renders on the server and cannot be validated for instant navigation.
export const instant = false;

export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <RoleGate role="professor">{children}</RoleGate>
    </>
  );
}
