import type { LessonReportData } from "@/lib/api/types";
import { getTerm } from "@/lib/terms/pack";
import { t } from "@/lib/i18n/pt-BR";

export interface TermRow {
  term_id: string;
  taps: number;
  students: number;
  doubts: number;
  helped: number;
  not_helped: number;
}

/** Above this pace captions get hard to follow. */
const FAST_WPM = 160;
const termName = (id: string) => getTerm(id)?.canonical ?? id;

export function LessonReport({ report, terms }: { report: LessonReportData | null; terms: TermRow[] }) {
  const maxWpm = Math.max(1, ...(report?.pace.map((p) => p.wpm) ?? [1]));
  return (
    <div className="space-y-8">
      {report && (
        <>
          <section className="space-y-2">
            <h3 className="text-lg font-semibold">{t.report.pace}</h3>
            <ol className="space-y-1">
              {report.pace.map((p) => (
                <li key={p.minute} className="flex items-center gap-3 text-sm">
                  <span className="w-20 shrink-0 font-mono">{p.minute + 1} min</span>
                  <span
                    aria-label={t.report.paceRow(p.minute, p.wpm)}
                    role="img"
                    className={`h-4 rounded ${p.wpm > FAST_WPM ? "bg-amber-600" : "bg-primary"}`}
                    style={{ width: `${Math.round((p.wpm / maxWpm) * 100)}%` }}
                  />
                  <span className="w-16 shrink-0 text-right font-mono">{p.wpm}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="space-y-2">
            <h3 className="text-lg font-semibold">{t.report.fastest}</h3>
            <p className="text-sm text-muted-foreground">{t.report.fastHint}</p>
            <ul className="list-disc pl-6">
              {report.fastest.map((p) => (
                <li key={p.minute}>{t.report.paceRow(p.minute, p.wpm)}</li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-lg font-semibold">{t.report.undefined}</h3>
            <p className="text-sm text-muted-foreground">{t.report.undefinedHint}</p>
            <p>{report.undefined_terms.length ? report.undefined_terms.map(termName).join(", ") : t.report.none}</p>
          </section>
        </>
      )}

      <section className="space-y-2">
        <h3 className="text-lg font-semibold">{t.report.terms}</h3>
        {terms.length === 0 ? (
          <p>{t.report.noTerms}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2">{t.report.termCols.term}</th>
                  <th>{t.report.termCols.taps}</th>
                  <th>{t.report.termCols.students}</th>
                  <th>{t.report.termCols.doubts}</th>
                  <th>{t.report.termCols.helped}</th>
                  <th>{t.report.termCols.notHelped}</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((r) => (
                  <tr key={r.term_id} className="border-b">
                    <td className="py-2 font-mono">{termName(r.term_id)}</td>
                    <td>{r.taps}</td>
                    <td>{r.students}</td>
                    <td>{r.doubts}</td>
                    <td>{r.helped}</td>
                    <td>{r.not_helped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
