"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadSummaryPdf, type SummaryPdfData } from "@/lib/pdf/summary-pdf";
import { useT } from "@/lib/i18n/context";

export function PdfButton({ data, label }: { data: SummaryPdfData; label: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(false);
          try {
            await downloadSummaryPdf(data);
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download aria-hidden />
        {busy ? t.pdf.generating : label}
      </Button>
      {error && <p className="text-sm text-destructive">{t.pdf.error}</p>}
    </div>
  );
}
