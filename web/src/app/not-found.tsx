import Link from "next/link";
import { House, SearchX } from "lucide-react";
import { SiteHeader } from "@/components/brand";
import { MessageCard } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n/pt-BR";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <MessageCard
        icon={SearchX}
        title={t.common.notFoundTitle}
        action={
          <Link href="/" className={buttonVariants()}>
            <House aria-hidden />
            {t.common.goHome}
          </Link>
        }
      >
        {t.common.notFoundBody}
      </MessageCard>
    </>
  );
}
