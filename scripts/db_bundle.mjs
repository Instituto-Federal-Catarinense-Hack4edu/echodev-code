// Concatenates supabase/migrations/*.sql (sorted) into supabase/bundle.sql.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const parts = [
  "-- EchoDev: bundle gerado por `npm run db:bundle`. Não edite à mão.",
  "-- Cole este arquivo inteiro no SQL Editor do Supabase.",
  "",
];
for (const f of files) {
  parts.push(`-- ===== ${f} =====`, readFileSync(join(dir, f), "utf8").trimEnd(), "");
}
writeFileSync(join(root, "supabase", "bundle.sql"), parts.join("\n"));
console.log(`supabase/bundle.sql gerado com ${files.length} migração(ões).`);
