// Exports FastAPI's openapi.json and generates web/src/lib/api/schema.d.ts.
// With --check, fails if the committed file is out of date.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const target = join(root, "web", "src", "lib", "api", "schema.d.ts");
const openapi = join(root, "api", "openapi.json");

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("node", [join(root, "scripts", "py.mjs"), "--cwd", "api", "-m", "app.export_openapi", openapi]);

const out = check ? join(mkdtempSync(join(tmpdir(), "echodev-")), "schema.d.ts") : target;
run("npx", ["openapi-typescript", openapi, "-o", out], { cwd: join(root, "web") });

if (check) {
  const fresh = readFileSync(out, "utf8").replace(/\r\n/g, "\n");
  const current = existsSync(target) ? readFileSync(target, "utf8").replace(/\r\n/g, "\n") : "";
  if (fresh !== current) {
    console.error("web/src/lib/api/schema.d.ts está desatualizado. Rode `npm run gen:api-types`.");
    process.exit(1);
  }
  console.log("Tipos da API em dia.");
}
