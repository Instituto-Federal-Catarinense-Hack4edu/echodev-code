import { SiteHeader } from "@/components/brand";

export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
