// Runs the api/.venv Python on any OS: node scripts/py.mjs [--cwd api] <args...>
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [
  join(root, "api", ".venv", "Scripts", "python.exe"),
  join(root, "api", ".venv", "bin", "python"),
];
const python = candidates.find((p) => existsSync(p));
if (!python) {
  console.error("Ambiente virtual não encontrado em api/.venv. Veja o README (seção 'API Python').");
  process.exit(1);
}

let args = process.argv.slice(2);
let cwd = root;
if (args[0] === "--cwd") {
  cwd = join(root, args[1]);
  args = args.slice(2);
}

const result = spawnSync(python, args, { cwd, stdio: "inherit" });
process.exit(result.status ?? 1);
