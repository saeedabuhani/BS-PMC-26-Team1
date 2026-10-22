// Builds the static, no-server demo of ANTE into ./demo-dist (published on GitHub Pages, branch gh-pages).
//
//   npm i playwright && npx playwright install chromium     (once)
//   node scripts/build_demo.mjs                       (served from the site root)
//   DEMO_BASE=/BS-PMC-26-Team1 node scripts/build_demo.mjs   (GitHub Pages project site)
//
// What it does: starts the REAL Flask app on a throw-away SQLite database, seeds it with scripts/seed_demo.py (admin, 2 lecturers, 12 students with attempts),
// signs in as a student, a lecturer and the admin with a headless browser, and saves every reachable
// screen as a static HTML file. Answers and sandbox results are recorded from the real app once, at build
// time. In the deployed demo nothing executes: scripts/demo_runtime.js (copied to demo-dist/demo.js)
// answers the forms and the "Run" button from those recorded fixtures.
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require(process.env.PLAYWRIGHT_PATH || "playwright");
}
const { chromium } = playwright;

const root = resolve(import.meta.dirname, "..");
const out = join(root, "demo-dist");
const PORT = 5055;
const DEMO_BASE = (process.env.DEMO_BASE || "").replace(/\/$/, ""); // "" or e.g. "/BS-PMC-26-Team1"
const BASE = `http://127.0.0.1:${PORT}`;
const work = join(tmpdir(), "ante-demo-build");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const dbFile = join(work, "demo.db").replace(/\\/g, "/");
const python =
  process.env.PYTHON || (existsSync(join(root, ".venv", "Scripts", "python.exe")) ? join(root, ".venv", "Scripts", "python.exe") : existsSync(join(root, ".venv", "bin", "python")) ? join(root, ".venv", "bin", "python") : "python");
const env = { ...process.env, DATABASE_URL: `sqlite:///${dbFile}`, SECRET_KEY: "demo-build-only", USE_SQLSERVER: "0", PYTHONUTF8: "1" };

// ---- 1. seed + start the real app
const seed = spawnSync(python, ["scripts/seed_demo.py"], { cwd: root, env, encoding: "utf8" });
if (seed.status !== 0) throw new Error("seeding failed: " + seed.stderr + seed.stdout);
rmSync(join(root, "DEMO_USERS.md"), { force: true }); // the seeder writes its credentials list here; not needed
const server = spawn(python, ["-c", `from app import create_app; create_app().run(port=${PORT})`], { cwd: root, env, stdio: "ignore" });
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(BASE + "/login")).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

const ACCOUNTS = {
  s: { email: "noa.avrahami@ante.local", password: "Demo#12345", home: "/", label: "student" },
  l: { email: "ravid.cohen@ante.local", password: "Demo#12345", home: "/lecturer/dashboard", label: "lecturer" },
  a: { email: "admin@ante.local", password: "Admin#12345", home: "/admin/dashboard", label: "admin" },
};
const SKIP = [/^\/logout/, /\/delete/, /\/download/, /\.csv/, /\/deactivate/, /\/activate/, /\/reset-password/, /\/toggle/, /\/bulk/, /random=1/, /^\/demo$/, /^\/flow\//, /^\/forgot/, /^\/register/, /^\/login/, /track=/];
const keyOf = (pathAndQuery) => pathAndQuery.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "home";
const fileOf = (role, pathAndQuery) => `${role}/${keyOf(pathAndQuery)}.html`;

const browser = await chromium.launch();
const manifest = { pages: { s: [], l: [], a: [] }, exercise: {}, run: {} };
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

function scrub(html) {
  return html
    .replace(/name="csrf_token" value="[^"]*"/g, 'name="csrf_token" value="demo"')
    .replace(new RegExp(BASE.replace(/[.]/g, "\\."), "g"), "")
    .replace(/(["'(])\/static\//g, `$1${DEMO_BASE}/static/`)
    .replace("</body>", `<script src="${DEMO_BASE}/demo.js"></script></body>`);
}

async function login(role) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Monaco is loaded from a CDN: keep it out while saving, so the saved HTML holds the pristine, empty editor container
  await ctx.route("**/cdn.jsdelivr.net/**", (route) => route.abort());
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill("input[name=email]", ACCOUNTS[role].email);
  await page.fill("input[name=password]", ACCOUNTS[role].password);
  await page.click("button[type=submit]");
  await page.waitForLoadState("networkidle");
  return { ctx, page };
}

// ---- 2. record answers and sandbox results as the student (real app, real sandbox, once)
{
  const { ctx, page } = await login("s");
  await page.goto(BASE + "/intro");
  await page.goto(BASE + "/pipeline");
  const token = async (q) => {
    await page.goto(BASE + `/exercise?q=${q}`);
    return page.$eval("input[name=csrf_token]", (e) => e.value);
  };
  const post = async (q, form, name) => {
    const csrf = await token(q);
    const res = await ctx.request.post(BASE + `/exercise?q=${q}`, { form: { csrf_token: csrf, action: "submit", ...form } });
    const file = `s/exercise_q_${q}__${name}.html`;
    mkdirSync(join(out, "s"), { recursive: true });
    writeFileSync(join(out, file), scrub(await res.text()));
  };
  const mcq = { 0: ["Build", "Deploy"], 2: ["Automated release without manual approval", "Faster automated tests"], 3: ["To ensure changes don't break existing features", "To increase build time"] };
  for (const [q, [good, bad]] of Object.entries(mcq)) {
    manifest.exercise[q] = { type: "mcq", correct: good };
    await post(q, { answer: bad }, "wrong");
  }
  manifest.exercise[1] = { type: "code", correctPattern: "return\\s+a\\s*\\+\\s*b" };
  await post(1, { code_answer: "def solve(a, b):\n    pass" }, "wrong");
  const runVia = async (code) => {
    const res = await ctx.request.post(BASE + "/exercise/run", { data: { code, question_id: 2 }, headers: { "Content-Type": "application/json" } });
    return (await res.json()).output;
  };
  manifest.run.correct = await runVia("def solve(a, b):\n    return a + b");
  manifest.run.wrong = await runVia("def solve(a, b):\n    pass");
  manifest.run.blocked = await runVia("import os\ndef solve(a, b):\n    return os.system('echo hi')");
  // correct answers last, so the saved student dashboards show finished progress
  for (const [q, [good]] of Object.entries(mcq)) await post(q, { answer: good }, "correct");
  await post(1, { code_answer: "def solve(a, b):\n    return a + b" }, "correct");
  await ctx.close();
}

// ---- 3. crawl every reachable screen per role
for (const role of ["s", "l", "a"]) {
  const { ctx, page } = await login(role);
  const queue = [ACCOUNTS[role].home, "/learning-path", "/progress", "/exercise", "/exercise?q=1", "/exercise?q=2", "/exercise?q=3", "/intro", "/pipeline", "/certificate", "/lecturer/questions/new", "/admin/modules/new"].filter(
    (p) => (role === "s" ? !/lecturer|admin/.test(p) : role === "l" ? !/^\/admin/.test(p) : !/^\/lecturer/.test(p)),
  );
  const seen = new Set();
  while (queue.length && seen.size < 90) {
    const target = queue.shift();
    if (seen.has(target)) continue;
    seen.add(target);
    const res = await page.goto(BASE + target, { waitUntil: "networkidle" }).catch(() => null);
    if (!res || res.status() >= 400) continue;
    const finalPath = new URL(page.url()).pathname + new URL(page.url()).search;
    if (/^\/(login|logout)/.test(finalPath)) continue;
    mkdirSync(join(out, role), { recursive: true });
    const html = scrub(await page.content());
    writeFileSync(join(out, fileOf(role, finalPath)), html);
    if (finalPath === ACCOUNTS[role].home) writeFileSync(join(out, `${role}/home.html`), html);
    manifest.pages[role].push(finalPath);
    if (finalPath !== target) manifest.pages[role].push(target);
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
    for (const h of hrefs) {
      if (!h || !h.startsWith("/") || h.startsWith("//") || h.startsWith("/static")) continue;
      if (SKIP.some((re) => re.test(h))) continue;
      if (role === "s" && /^\/(lecturer|admin)/.test(h)) continue;
      if (role === "l" && /^\/admin/.test(h)) continue;
      if (role === "a" && /^\/lecturer/.test(h)) continue;
      if (!seen.has(h)) queue.push(h);
    }
  }
  // the student's "home" is "/" which redirects: make sure it exists under both names
  await ctx.close();
}
manifest.pages.s = [...new Set(manifest.pages.s)];
manifest.pages.l = [...new Set(manifest.pages.l)];
manifest.pages.a = [...new Set(manifest.pages.a)];

// ---- 4. static assets, role chooser, runtime
cpSync(join(root, "app", "static"), join(out, "static"), { recursive: true });
cpSync(join(root, "scripts", "demo_runtime.js"), join(out, "demo.js"));
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest));
// the login screen, as a real screenshot-able page
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  writeFileSync(join(out, "login-real.html"), scrub(await page.content()));
  await ctx.close();
}
const indexHtml = readFileSync(join(root, "scripts", "demo_index.html"), "utf8").replace(/__BASE__/g, DEMO_BASE);
writeFileSync(join(out, "index.html"), indexHtml);
writeFileSync(join(out, "404.html"), indexHtml);
writeFileSync(join(out, ".nojekyll"), "");

await browser.close();
server.kill();
console.log("pages:", Object.fromEntries(Object.entries(manifest.pages).map(([k, v]) => [k, v.length])));
console.log("Demo written to", out);
