"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

/** Copies `value` to the clipboard and confirms for 2 s. Hidden when the clipboard is unavailable. */
export function CopyButton({
  value,
  label,
  showText = false,
  className,
  variant = "ghost",
}: {
  value: string;
  label?: string;
  showText?: boolean;
  className?: string;
  variant?: "ghost" | "outline" | "secondary";
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability check after mount
    setAvailable(typeof navigator !== "undefined" && !!navigator.clipboard);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!available) return null;
  const text = copied ? t.common.copied : (label ?? t.common.copy);

  return (
    <Button
      type="button"
      variant={variant}
      size={showText ? "default" : "icon"}
      aria-label={showText ? undefined : text}
      title={showText ? undefined : text}
      className={cn(copied && "text-success", className)}
      onClick={() => {
        void navigator.clipboard
          .writeText(value)
          .then(() => setCopied(true))
          .catch(() => undefined);
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {showText && <span>{text}</span>}
      <span className="sr-only" aria-live="polite">
        {copied ? t.common.copied : ""}
      </span>
    </Button>
  );
}
