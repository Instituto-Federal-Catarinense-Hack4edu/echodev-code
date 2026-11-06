import type { jsPDF as JsPDF } from "jspdf";
import type { QuizItem, Resumo, TermoGlossario } from "@/lib/api/types";
import { normalize } from "@/lib/terms/matcher";
import { getTerm, matcherFor } from "@/lib/terms/pack";
import { messagesFor } from "@/lib/i18n/messages";
import type { Lang } from "@/lib/terms/schemas";

export interface SummaryPdfData {
  lessonTitle: string;
  date: Date;
  resumo: Resumo;
  /** Teacher copy only: quiz with answer key. */
  quiz?: QuizItem[] | null;
  /** Terms the AI explained for this lesson (approved ones for students). */
  glossario?: TermoGlossario[] | null;
  lang?: Lang;
}

export interface PdfLogo {
  dataUrl: string;
  width: number;
  height: number;
}

const LOGO_URL = "/brand/echodev-logo-640.png";
const LOGO_HEIGHT_PT = 30;

/**
 * The 14 standard PDF fonts only cover WinAnsi (Latin-1 + a few symbols). Portuguese and Spanish
 * accents are fine; arrows, ellipses, smart quotes etc. are mapped to plain equivalents.
 */
export function toPdfText(s: string): string {
  return s
    .replace(/[→⇒]/g, "->")
    .replace(/[←⇐]/g, "<-")
    .replace(/…/g, "...")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\t/g, "  ")
    .replace(/[^\n\x20-\x7E -ÿ]/g, "");
}

export function pdfFileName(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `resumo-${slug || "aula"}.pdf`;
}

const termKey = (s: string) => normalize(s).replace(/[^a-z0-9]/g, "");

/**
 * Key terms explained by the dictionary or, for new terms, by the lesson's AI glossary; AI terms
 * that are not among the key terms are listed after them.
 */
export function glossary(
  keyTerms: string[],
  lang: Lang = "pt",
  aiTerms: TermoGlossario[] = [],
): { term: string; short: string | null }[] {
  const m = matcherFor();
  const byKey = new Map(aiTerms.map((g) => [termKey(g.termo), g]));
  const used = new Set<string>();
  const fromAi = (g: TermoGlossario) => ({
    term: lang === "es" ? g.nome_es : g.termo,
    short: (lang === "es" ? g.es.curta : lang === "en" && g.en_curta ? g.en_curta : g.pt.curta) || null,
  });
  const listed = keyTerms
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => {
      const ai = byKey.get(termKey(k));
      if (ai) {
        used.add(termKey(ai.termo));
        return fromAi(ai);
      }
      const span = m.match(k).terms[0];
      const term = span ? getTerm(span.termId) : undefined;
      const short = term ? (term.explanations[lang]?.short ?? term.explanations.pt.short) : null;
      return { term: term?.canonical ?? k, short };
    });
  return [...listed, ...aiTerms.filter((g) => !used.has(termKey(g.termo))).map(fromAi)];
}

const MARGIN = 56;
const PAGE_BOTTOM_GAP = 64;

/** Builds the PDF document (pure: takes the jsPDF class so it can run in tests). */
export function buildSummaryPdf(JsPDFCtor: typeof JsPDF, data: SummaryPdfData, logo?: PdfLogo | null): JsPDF {
  const t = messagesFor(data.lang ?? "pt");
  const doc = new JsPDFCtor({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const maxW = width - MARGIN * 2;
  let y = MARGIN;

  const ensure = (needed: number) => {
    if (y + needed > height - PAGE_BOTTOM_GAP) {
      doc.addPage();
      y = MARGIN;
    }
  };
  const write = (
    text: string,
    opts: { size?: number; bold?: boolean; mono?: boolean; indent?: number; gap?: number; color?: number } = {},
  ) => {
    const size = opts.size ?? 11;
    const indent = opts.indent ?? 0;
    doc.setFont(opts.mono ? "courier" : "helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(opts.color ?? 20);
    const lines: string[] = doc.splitTextToSize(toPdfText(text), maxW - indent);
    const lineH = size * 1.35;
    for (const line of lines) {
      ensure(lineH);
      doc.text(line, MARGIN + indent, y);
      y += lineH;
    }
    y += opts.gap ?? 4;
  };

  if (logo) {
    const w = (logo.width / logo.height) * LOGO_HEIGHT_PT;
    doc.addImage(logo.dataUrl, "PNG", MARGIN, y - 10, w, LOGO_HEIGHT_PT, "echodev-logo", "FAST");
    y += LOGO_HEIGHT_PT + 6;
    write(t.pdf.subtitle, { size: 10, color: 90, gap: 10 });
  } else {
    write(t.pdf.header, { size: 10, color: 90, gap: 10 });
  }
  write(data.lessonTitle, { size: 18, bold: true, gap: 2 });
  write(t.pdf.date(data.date), { size: 10, color: 90, gap: 14 });

  write(data.resumo.titulo, { size: 14, bold: true, gap: 6 });
  for (const topic of data.resumo.topicos) write(`-  ${topic}`, { indent: 8, gap: 6 });

  const terms = glossary(data.resumo.termos_chave ?? [], data.lang, data.glossario ?? []);
  if (terms.length) {
    y += 8;
    write(t.pdf.glossary, { size: 13, bold: true, gap: 6 });
    for (const g of terms) {
      write(g.term, { bold: true, gap: 0 });
      write(g.short ?? t.pdf.noDefinition, { indent: 12, gap: 6, color: g.short ? 20 : 110 });
    }
  }

  if (data.quiz?.length) {
    y += 8;
    write(t.pdf.quiz, { size: 13, bold: true, gap: 6 });
    data.quiz.forEach((q, i) => {
      ensure(60);
      write(`${i + 1}. ${q.pergunta}`, { bold: true, gap: 2 });
      if (q.codigo) write(q.codigo, { mono: true, size: 10, indent: 12, gap: 4 });
      q.opcoes.forEach((o, j) => write(`${String.fromCharCode(65 + j)}) ${o}`, { indent: 12, gap: 1 }));
      y += 6;
    });
    y += 6;
    write(t.pdf.answerKey, { size: 13, bold: true, gap: 6 });
    data.quiz.forEach((q, i) =>
      write(`${i + 1}. ${String.fromCharCode(65 + q.correta)} - ${q.explicacao}`, { indent: 8, gap: 4 }),
    );
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(toPdfText(t.pdf.footer), MARGIN, height - 32);
    doc.text(t.pdf.page(p, pages), width - MARGIN, height - 32, { align: "right" });
  }
  return doc;
}

/** Browser download (jsPDF is loaded only when the button is clicked). */
export async function downloadSummaryPdf(data: SummaryPdfData): Promise<void> {
  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), loadLogo()]);
  buildSummaryPdf(jsPDF, data, logo).save(pdfFileName(data.lessonTitle));
}

async function loadLogo(): Promise<PdfLogo | null> {
  try {
    const blob = await fetch(LOGO_URL).then((r) => (r.ok ? r.blob() : Promise.reject(r.status)));
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    });
    return { dataUrl, ...size };
  } catch {
    return null;
  }
}
