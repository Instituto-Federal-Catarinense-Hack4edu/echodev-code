import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps relative paths with query", () => {
    expect(safeNext("/aula/ABC234?x=1")).toBe("/aula/ABC234?x=1");
  });
  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNext("https://evil.test")).toBe("/");
    expect(safeNext("//evil.test")).toBe("/");
    expect(safeNext("/\\evil.test")).toBe("/");
    expect(safeNext(null, "/professor")).toBe("/professor");
  });
});
