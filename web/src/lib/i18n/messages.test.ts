import { describe, expect, it } from "vitest";
import { messagesFor, uiLangOf } from "./messages";

describe("messagesFor", () => {
  it("uses Spanish for student strings and Portuguese for the rest", () => {
    const es = messagesFor("es");
    expect(es.student.waiting).toBe("Esperando a que el profesor empiece a hablar…");
    expect(es.student.backToLive(2)).toBe("Volver al vivo (2 nuevas)");
    expect(es.teacher.start).toBe(messagesFor("pt").teacher.start);
  });

  it("keeps nested Portuguese keys that Spanish does not override", () => {
    expect(messagesFor("es").termSheet.langs.es).toBe("Español");
  });

  it("shows English readers the Portuguese screens", () => {
    expect(uiLangOf("en")).toBe("pt");
    expect(messagesFor("en")).toBe(messagesFor("pt"));
  });
});
