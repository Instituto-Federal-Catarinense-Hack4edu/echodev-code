import { StudentI18n } from "@/lib/i18n/context";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentI18n>{children}</StudentI18n>;
}
