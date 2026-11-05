export type Role = "professor" | "estudante";

export function roleHome(role: Role): string {
  return role === "professor" ? "/professor" : "/aluno";
}

export function areaOf(path: string): Role | null {
  if (/^\/professor(\/|$|\?)/.test(path)) return "professor";
  if (/^\/(aluno|aula)(\/|$|\?)/.test(path)) return "estudante";
  return null;
}

export function destinationFor(role: Role, next: string): string {
  if (next === "/" || next === "") return roleHome(role);
  const area = areaOf(next);
  return area && area !== role ? roleHome(role) : next;
}
