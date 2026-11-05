import { SiteHeader } from "@/components/brand";
import { RoleGate } from "@/components/role-gate";

export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <RoleGate role="professor">{children}</RoleGate>
    </>
  );
}
