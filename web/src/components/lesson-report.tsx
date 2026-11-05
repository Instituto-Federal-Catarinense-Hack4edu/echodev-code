import { AlertTriangle, BookX, Gauge, MousePointerClick } from "lucide-react";
import { SectionTitle } from "@/components/page-header";
import type { LessonReportData } from "@/lib/api/types";
import { getTerm } from "@/lib/terms/pack";
import { t } from "@/lib/i18n/pt-BR";
import { cn } from "@/lib/utils";

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
  // Keep the threshold line inside the chart even when the lesson was slow.
  const scale = Math.max(1, FAST_WPM * 1.15, ...(report?.pace.map((p) => p.wpm) ?? [1]));
  const maxTaps = Math.max(1, ...terms.map((r) => r.taps));
  return (
    <div className="space-y-5">
      {report && (
        <>
          <section className="surface space-y-4 p-5 sm:p-6" aria-labelledby="pace-h">
            <SectionTitle icon={Gauge} id="pace-h">
              {t.report.pace}
            </SectionTitle>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-sm bg-primary" />
                {t.report.legendOk}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-sm bg-warning-strong" />
                {t.report.legendFast(FAST_WPM)}
              </span>
            </div>
            <div className="nice-scroll overflow-x-auto pb-1">
              <div className="relative h-48 min-w-full" style={{ width: `max(100%, ${report.pace.length * 2.25}rem)` }}>
                <div
                  aria-hidden
                  className="absolute inset-x-0 border-t-2 border-dashed border-warning-strong"
                  style={{ bottom: `calc(${(FAST_WPM / scale) * 100}% * 0.86 + 1.25rem)` }}
                >
                  <span className="absolute -top-5 right-0 rounded bg-warning-soft px-1.5 text-[0.7rem] font-semibold text-warning">
                    {FAST_WPM}
                  </span>
                </div>
                <ol className="absolute inset-0 flex items-end gap-1.5">
                  {report.pace.map((p) => {
                    const fast = p.wpm > FAST_WPM;
                    return (
                      <li key={p.minute} className="group flex h-full min-w-6 flex-1 flex-col items-center justify-end gap-1">
                        <span className="text-[0.7rem] font-semibold tabular-nums opacity-0 transition-opacity group-hover:opacity-100">
                          {p.wpm}
                        </span>
                        <span
                          role="img"
                          aria-label={t.report.paceRow(p.minute, p.wpm)}
                          title={t.report.paceRow(p.minute, p.wpm)}
                          className={cn(
                            "w-full rounded-t-md transition-opacity group-hover:opacity-80",
                            fast ? "bg-warning-strong" : "bg-primary",
                          )}
                          style={{ height: `${Math.max(2, Math.round((p.wpm / scale) * 86))}%` }}
                        />
                        <span aria-hidden className="h-4 text-[0.7rem] text-muted-foreground tabular-nums">
                          {t.report.minuteShort(p.minute + 1)}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <section className="surface space-y-3 p-5" aria-labelledby="fast-h">
              <SectionTitle icon={AlertTriangle} id="fast-h">
                {t.report.fastest}
              </SectionTitle>
              <p className="text-sm text-muted-foreground">{t.report.fastHint}</p>
              {report.fastest.length ? (
                <ul className="flex flex-wrap gap-2">
                  {report.fastest.map((p) => (
                    <li
                      key={p.minute}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-sm font-medium",
                        p.wpm > FAST_WPM ? "bg-warning-soft text-warning" : "bg-muted",
                      )}
                    >
                      {t.report.paceRow(p.minute, p.wpm)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t.report.none}</p>
              )}
            </section>

            <section className="surface space-y-3 p-5" aria-labelledby="undef-h">
              <SectionTitle icon={BookX} id="undef-h">
                {t.report.undefined}
              </SectionTitle>
              <p className="text-sm text-muted-foreground">{t.report.undefinedHint}</p>
              {report.undefined_terms.length ? (
                <ul className="flex flex-wrap gap-2">
                  {report.undefined_terms.map((id) => (
                    <li key={id} className="term-highlight cursor-default px-2.5 py-1 font-mono text-sm no-underline">
                      {termName(id)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t.report.none}</p>
              )}
            </section>
          </div>
        </>
      )}

      <section className="surface space-y-4 p-5 sm:p-6" aria-labelledby="terms-h">
        <SectionTitle icon={MousePointerClick} id="terms-h">
          {t.report.terms}
        </SectionTitle>
        {terms.length === 0 ? (
          <p className="text-muted-foreground">{t.report.noTerms}</p>
        ) : (
          <div className="nice-scroll -mx-2 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b text-xs tracking-wide text-muted-foreground uppercase">
                  <th scope="col" className="px-2 py-2.5 font-semibold">{t.report.termCols.term}</th>
                  <th scope="col" className="px-2 font-semibold">{t.report.termCols.taps}</th>
                  <th scope="col" className="px-2 text-right font-semibold">{t.report.termCols.students}</th>
                  <th scope="col" className="px-2 text-right font-semibold">{t.report.termCols.doubts}</th>
                  <th scope="col" className="px-2 text-right font-semibold">{t.report.termCols.helped}</th>
                  <th scope="col" className="px-2 text-right font-semibold">{t.report.termCols.notHelped}</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((r) => (
                  <tr key={r.term_id} className="border-b last:border-0 hover:bg-muted/50">
                    <th scope="row" className="px-2 py-3 font-mono font-semibold">
                      {termName(r.term_id)}
                    </th>
                    <td className="px-2">
                      <span className="flex items-center gap-2">
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <span
                            className="block h-full rounded-full bg-primary"
                            style={{ width: `${Math.round((r.taps / maxTaps) * 100)}%` }}
                          />
                        </span>
                        <span className="w-8 text-right font-semibold tabular-nums">{r.taps}</span>
                      </span>
                    </td>
                    <td className="px-2 text-right tabular-nums">{r.students}</td>
                    <td className={cn("px-2 text-right tabular-nums", r.doubts > 0 && "font-semibold text-warning")}>
                      {r.doubts}
                    </td>
                    <td className="px-2 text-right text-success tabular-nums">{r.helped}</td>
                    <td className="px-2 text-right tabular-nums">{r.not_helped}</td>
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
