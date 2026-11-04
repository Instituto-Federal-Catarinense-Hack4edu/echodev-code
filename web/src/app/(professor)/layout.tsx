import Link from "next/link";
import { SiteHeader } from "@/components/brand";
import { t } from "@/lib/i18n/pt-BR";

export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader>
        <nav className="flex items-center gap-4 text-sm">
          <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/professor">
            {t.lessons.title}
          </Link>
          <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/conta">
            {t.student.account}
          </Link>
        </nav>
      </SiteHeader>
      {children}
    </>
  );
}
