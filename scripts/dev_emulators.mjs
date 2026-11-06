// Local development without touching the real project: Firebase emulators (Auth + Firestore),
// test users, the Python API and the web app, all wired to the emulators.
// Usage: npm run dev:emulators   (needs the Firebase CLI: npm install -g firebase-tools)
import { spawn } from "node:child_process";
import { connect } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EMULATOR_ENV = {
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
};
const children = [];

function start(name, cmd, args, env = {}) {
  const child = spawn(cmd, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  const prefix = `[${name}] `;
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (buf) => {
      for (const line of String(buf).split(/\r?\n/)) if (line.trim()) console.log(prefix + line);
    });
  }
  children.push(child);
  return child;
}

function waitPort(port, timeoutMs = 120_000) {
  const until = Date.now() + timeoutMs;
  return new Promise((ok, fail) => {
    const tryOnce = () => {
      const s = connect(port, "127.0.0.1");
      s.once("connect", () => {
        s.destroy();
        ok();
      });
      s.once("error", () => {
        s.destroy();
        if (Date.now() > until) fail(new Error(`porta ${port} não abriu`));
        else setTimeout(tryOnce, 500);
      });
    };
    tryOnce();
  });
}

function stopAll() {
  for (const c of children) if (!c.killed) c.kill();
}
process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});

start("emuladores", "firebase", ["emulators:start", "--only", "auth,firestore"]);
await Promise.all([waitPort(8080), waitPort(9099)]);

const py = join(root, "scripts", "py.mjs");
const seed = start("seed", "node", [py, join("scripts", "seed_dev_users.py"), "--emulators"]);
await new Promise((ok) => seed.on("exit", ok));

start("api", "node", [py, "--cwd", "api", "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"], {
  ...EMULATOR_ENV,
  FIREBASE_CREDENTIALS_FILE: "",
});
start("web", "npm", ["--prefix", "web", "run", "dev"], { NEXT_PUBLIC_FIREBASE_EMULATORS: "true" });
console.log("\nEmuladores em http://127.0.0.1:4000 · site em http://localhost:3000 · API em http://localhost:8000");
