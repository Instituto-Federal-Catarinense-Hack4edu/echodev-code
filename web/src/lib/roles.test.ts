import { describe, expect, it } from "vitest";
import { areaOf, destinationFor, roleHome } from "./roles";

describe("roles", () => {
  it("knows each area", () => {
    expect(areaOf("/professor/aulas/1")).toBe("professor");
    expect(areaOf("/aula/ABC234")).toBe("estudante");
    expect(areaOf("/aluno")).toBe("estudante");
    expect(areaOf("/conta")).toBeNull();
    expect(areaOf("/aulas")).toBeNull();
  });

  it("sends each role to its own area after login", () => {
    expect(destinationFor("professor", "/")).toBe("/professor");
    expect(destinationFor("estudante", "/")).toBe("/aluno");
    expect(destinationFor("estudante", "/professor")).toBe("/aluno");
    expect(destinationFor("professor", "/aula/ABC234")).toBe("/professor");
    expect(destinationFor("estudante", "/aula/ABC234")).toBe("/aula/ABC234");
    expect(destinationFor("professor", "/conta")).toBe("/conta");
    expect(roleHome("professor")).toBe("/professor");
  });
});
