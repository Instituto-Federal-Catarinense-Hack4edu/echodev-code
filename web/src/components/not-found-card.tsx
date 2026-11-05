import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { MessageCard } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n/pt-BR";

/** Teacher screens: lesson missing or owned by someone else. */
export function NotFoundCard() {
  return (
    <MessageCard
      icon={SearchX}
      title={t.lessons.notFound}
      action={
        <Link href="/professor" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft aria-hidden />
          {t.review.back}
        </Link>
      }
    />
  );
}
