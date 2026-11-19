// Runs EchoDev for a real lesson from this computer: production build of the site on
// port 3000, the API on port 8000, and the API served by the site under /py, so a single
// public address (for example a Cloudflare tunnel) is enough for teacher and students.
// Usage: npm run aula   (add --skip-build to reuse the last build; PORT=3001 for another port)
import { spawn } from "node:child_process";

const port = process.env.PORT || "3000";
const env = { ...process.env, NEXT_PUBLIC_API_URL: "/py", API_PROXY_TARGET: "http://127.0.0.1:8000" };

function run(command, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, stdio: "inherit", env, ...options });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} -> ${code}`))));
  });
}

if (!process.argv.includes("--skip-build")) await run("npm --prefix web run build");

console.log(`\nEchoDev: site em http://localhost:${port} (API em /py). Deixe esta janela aberta.\n`);
await run(
  `npx concurrently -k -n web,api -c cyan,magenta "npm --prefix web run start -- --port ${port}" ` +
    '"node scripts/py.mjs --cwd api -m uvicorn app.main:app --host 127.0.0.1 --port 8000"',
);
