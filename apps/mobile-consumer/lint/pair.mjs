// pnpm pair <route> — the phone app and the web app on the same screen, side
// by side: phone left, web right, with a sidecar that says what was compared.
// Docs › Apps › A2 §11. `pnpm pair --help` is the manual.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

import { device, EAS, exitWith, PairError, readSession, ROOT, SESSION_FILE } from "./device.mjs";
import { PAIR_STATES, stubAnswer } from "../src/lib/pair-state.ts";

const HELP = `pnpm pair <route> [--width 390|440] [--state ${PAIR_STATES.join("|")}] [--out dir] [--web url]

The three commands:
  pnpm sim [--width 390|440]   start the phone (an Expo Simulators session; it stops after 15 idle minutes)
  pnpm pair <route>                capture the pair
  pnpm pair --judge <pair.png>     print the judge's prompt for that pair, to hand to a fresh agent

A pair is <out>/<route>-<state>-<width>.png (phone left, web right), the two
halves as .phone.png and .web.png, and a .json sidecar: the phone's build and
update, the web's /api/version, width, scale, location and capture times.
Both sides are the same test guest at the same pinned location, drawn at the
same scale with motion stopped, and compared inside the phone's safe areas;
the web's own home-indicator strip is cropped.

  --width  390 (iPhone, the default), 440 (large iPhone; Expo has no 430 phone). Android is
           not captured yet: Expo's emulators have no 360 phone. The
           running session must be that phone: pnpm sim --width <n>.
  --state  main, or a forced one: loading, empty, error, long. The phone takes
           it from the link (only a build with EXPO_PUBLIC_PAIR_STATES has
           that link; the store build does not). The web gets the same change
           to the answers its browser receives; what its server renders stays real.
  --out    where the files go (default: pairs/, which git ignores).
  --web    another web origin than https://mesita.ai, for a wave that changes
           the web: that PR's preview address, share link included.

Errors go to stderr as TYPE: what happened, then the command that fixes it:
  NO SIM SESSION, NO REUSABLE BUILD, WRONG WIDTH, WRONG STATE, SIGN-IN FAILED,
  WEB COOKIE MINT FAILED, ROUTE NOT FOUND.
`;

// The routes a pair can name, as the phone and the web each call them. A wave
// adds its screens here; :id is a place's id.
const ROUTES = [
  { key: "/", phone: "/", web: "/home/places" },
  { key: "/search", phone: "/search", web: "/search" },
  { key: "/pay", phone: "/pay", web: "/pay" },
  { key: "/bookings", phone: "/bookings", web: "/me/reservations" },
  { key: "/me", phone: "/me", web: "/me" },
  { key: "/me/profile", phone: "/me/profile", web: "/me/profile" },
  {
    key: "/me/notifications",
    phone: "/me/notifications",
    web: "/me/notifications",
  },
  { key: "/me/plan", phone: "/me/plan", web: "/me/plan" },
  { key: "/me/settings", phone: "/me/settings", web: "/me/settings" },
  { key: "/me/tickets", phone: "/me/tickets", web: "/me/tickets" },
  { key: "/place/:id", phone: "/place/:id", web: "/place/:id" },
  {
    key: "/place/:id/offers",
    phone: "/place/:id/offers",
    web: "/place/:id/offers",
  },
];

const APP_ID = "com.mesita.consumer";
const SCALE = 2;
// Distrito Tec, Monterrey: where both apps start a guest who chose nothing.
// The phone's GPS is set to it; the web gets no GPS, so it stays on it.
const LOCATION = { latitude: 25.6514, longitude: -100.2895 };
const WEB = "https://mesita.ai";
const PHONE_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function parse(argv) {
  const opts = { width: 390, state: "main", out: "pairs", web: WEB };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i].replace(/^--/, "");
    if (argv[i] === "--help" || argv[i] === "-h") opts.help = true;
    else if (argv[i] === "--judge") opts.judge = argv[++i];
    else if (argv[i].startsWith("--") && name in opts) opts[name] = argv[++i];
    else rest.push(argv[i]);
  }
  opts.width = Number(opts.width);
  opts.route = rest[0];
  return opts;
}

function findRoute(route) {
  const listed = `Routes: ${ROUTES.map((r) => r.key).join("  ")}`;
  for (const row of ROUTES) {
    const pattern = new RegExp(`^${row.key.replace(":id", "([^/?#]+)")}/?$`);
    const hit = pattern.exec(route ?? "");
    if (hit) {
      const fill = (path) => path.replace(":id", hit[1] ?? "");
      return { phone: fill(row.phone), web: fill(row.web) };
    }
  }
  throw new PairError(
    "ROUTE NOT FOUND",
    `${route ?? "(no route)"} is not a route pair knows. ${listed}`,
    "pnpm pair /",
  );
}

// ── The test guest ──────────────────────────────────────────────────
// The number and its code live in Expo's preview environment. This process
// starts itself again inside `eas env:exec`, and never prints either.

function withTestGuest() {
  if (process.env.MAESTRO_TEST_PHONE && process.env.MAESTRO_TEST_CODE) return;
  const fix = "pnpm dlx eas-cli@27.11.0 env:list preview";
  if (process.env.PAIR_INNER) {
    throw new PairError(
      "SIGN-IN FAILED",
      "MAESTRO_TEST_PHONE and MAESTRO_TEST_CODE are not in Expo's preview environment.",
      fix,
    );
  }
  // eas splits its command on spaces, so the arguments travel in the environment.
  const again = [process.execPath, ...process.execArgv, process.argv[1]].join(" ");
  const run = spawnSync("pnpm", [...EAS, "env:exec", "preview", again, "--non-interactive"], {
    cwd: ROOT,
    stdio: ["ignore", "inherit", "inherit"],
    env: {
      ...process.env,
      PAIR_INNER: JSON.stringify(process.argv.slice(2)),
    },
    timeout: 10 * 60 * 1000,
  });
  process.exit(run.status ?? 1);
}

// ── The phone ───────────────────────────────────────────────────────

function capturePhone(session, opts, route, file) {
  const fix = `pnpm sim --width ${opts.width}`;
  if (!session) throw new PairError("NO SIM SESSION", "No simulator session was started here.", fix);
  if (session.width !== opts.width) {
    throw new PairError("WRONG WIDTH", `The running phone is ${session.width} wide, not ${opts.width}.`, fix);
  }
  const { latitude, longitude } = LOCATION;
  device(["settings", "location", "set", String(latitude), String(longitude)]);

  const signIn = () => {
    const replay = () =>
      device(
        ["replay", ".maestro/pair/sign-in.yaml", "--maestro", "--platform", session.platform, "--timeout", "200000"],
        {
          seconds: 220,
          env: {
            AD_VAR_MAESTRO_TEST_PHONE: process.env.MAESTRO_TEST_PHONE,
            AD_VAR_MAESTRO_TEST_CODE: process.env.MAESTRO_TEST_CODE,
          },
        },
      );
    // A phone that has just started is slow and can stop halfway: once more, from a clean app.
    let flow = replay();
    if (!flow.ok) {
      device(["settings", "clear-app-state", APP_ID]);
      device(["settings", "permission", "grant", "location", "--app", APP_ID]);
      flow = replay();
    }
    if (!flow.ok) {
      // The driver's own error line, which never holds what was typed, with every number masked.
      const why = (/Error \([A-Z_]+\): [^\n]*/.exec(flow.out)?.[0] ?? "").replace(/\d{4,}/g, "…").slice(0, 240);
      throw new PairError(
        "SIGN-IN FAILED",
        `The test guest did not reach Home. ${why} The code may have lapsed: Supabase › Auth › Phone › Test phone numbers.`,
        "pnpm pair /",
      );
    }
    session.signedIn = true;
    writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
  };
  const state = opts.state === "main" ? "" : `${route.phone.includes("?") ? "&" : "?"}pairState=${opts.state}`;
  const open = () => {
    const opened = device(["open", APP_ID, `mesita:/${route.phone}${state}`, "--platform", session.platform]);
    if (!opened.ok) throw new PairError("NO SIM SESSION", "The phone did not open the link.", fix);
    // iPhone asks before it opens a test link, a moment after the link is sent.
    for (let i = 0; session.platform === "ios" && i < 3; i++) {
      if (/Open in/.test(device(["alert", "get"]).out)) {
        device(["alert", "accept"]);
        break;
      }
    }
    // What a signed-out guest sees: the Sign tab, Welcome, or the sign-in page.
    return !/\[button\] "Sign"|"Just browse"|"Text me the code"/.test(device(["snapshot", "-i"]).out);
  };

  if (!session.signedIn) signIn();
  if (!open()) {
    // The session ended since the last pair (a day passed, or the app was reset).
    signIn();
    if (!open())
      throw new PairError("SIGN-IN FAILED", "The phone shows a signed-out screen after signing in.", "pnpm pair /");
  }

  // Motion is stopped by waiting it out: two captures in a row must be equal.
  const shoot = (path) =>
    device(["screenshot", path, ...(session.platform === "ios" ? ["--pixel-density", String(SCALE)] : [])]);
  const probe = `${file}.probe.png`;
  let stable = false;
  for (let i = 0; i < 6 && !stable; i++) {
    if (!shoot(i % 2 ? probe : file).ok) throw new PairError("NO SIM SESSION", "The phone gave no screenshot.", fix);
    stable = i > 0 && readFileSync(file).equals(readFileSync(probe));
  }
  if (existsSync(probe)) {
    if (!stable) writeFileSync(file, readFileSync(probe));
    rmSync(probe);
  }
  return { capturedAt: new Date().toISOString(), stable };
}

// ── The web ─────────────────────────────────────────────────────────

async function mintWebSession() {
  const { env } = JSON.parse(readFileSync(`${ROOT}eas.json`, "utf8")).build.preview;
  const failed = (why) =>
    new PairError(
      "WEB COOKIE MINT FAILED",
      `${why} The code may have lapsed: Supabase › Auth › Phone › Test phone numbers.`,
      "node scripts/preflight.mjs MAESTRO_TEST_PHONE MAESTRO_TEST_CODE --test-code",
    );
  const post = (path, body) =>
    fetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/${path}`, {
      method: "POST",
      headers: {
        apikey: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
  const phone = process.env.MAESTRO_TEST_PHONE;
  const sent = await post("otp", { phone });
  if (!sent?.ok) throw failed(`Supabase did not take the test number (${sent?.status ?? "no answer"}).`);
  const verified = await post("verify", {
    phone,
    token: process.env.MAESTRO_TEST_CODE,
    type: "sms",
  });
  if (!verified?.ok) throw failed(`Supabase did not take the test code (${verified?.status ?? "no answer"}).`);
  // A second session for the same guest. It is never signed out (that would
  // end the phone's too); it is dropped when this process ends.
  const session = await verified.json();
  const ref = new URL(env.EXPO_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const name = `sb-${ref}-auth-token`;
  const chunks = value.match(/.{1,3180}/g);
  return chunks.length === 1 ? [{ name, value }] : chunks.map((chunk, i) => ({ name: `${name}.${i}`, value: chunk }));
}

async function openBrowser() {
  const { chromium } = await import("playwright-core");
  try {
    return await chromium.launch();
  } catch {
    try {
      return await chromium.launch({ channel: "chrome" });
    } catch {
      throw new PairError(
        "NO BROWSER",
        "Neither Playwright's Chromium nor Google Chrome is on this machine.",
        "pnpm exec playwright-core install chromium",
      );
    }
  }
}

async function captureWeb(browser, session, opts, route, file) {
  const cookies = await mintWebSession();
  const origin = new URL(opts.web).origin;
  const safeHeight = phoneHeight(session) - session.top - session.bottom;
  // Taller than the phone's safe area by the strip that is cropped below.
  const GUESS = 14;
  const viewport = { width: opts.width, height: safeHeight + GUESS };
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
    userAgent: PHONE_AGENT,
    reducedMotion: "reduce",
    timezoneId: "America/Monterrey",
    locale: "en-US",
  });
  try {
    await context.addCookies(cookies.map((c) => ({ ...c, url: origin, sameSite: "Lax" })));
    const page = await context.newPage();
    if (opts.state !== "main") {
      await page.route("**/functions/v1/**", async (call) => {
        if (opts.state === "loading") return;
        if (opts.state === "error") {
          return call.fulfill({
            status: 500,
            json: {
              ok: false,
              code: "pair_state",
              error: "Mesita could not answer.",
            },
          });
        }
        const response = await call.fetch();
        const json = await response.json().catch(() => null);
        return json === null
          ? call.fulfill({ response })
          : call.fulfill({ response, json: stubAnswer(opts.state, json) });
      });
    }
    // A protected preview's share link sets its own cookie first.
    if (new URL(opts.web).search) await page.goto(opts.web, { timeout: 30_000 }).catch(() => null);
    const answer = await page
      .goto(origin + route.web, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      })
      .catch(() => null);
    if (!answer)
      throw new PairError("WEB DID NOT ANSWER", `${origin} gave no page in 30 seconds.`, `pnpm pair ${opts.route}`);
    await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => null);
    const path = new URL(page.url()).pathname;
    if (path === "/" || path.startsWith("/sign") || path.startsWith("/onboard") || path.startsWith("/auth")) {
      throw new PairError(
        "WEB COOKIE MINT FAILED",
        `The web did not take the session: it stopped at ${path}.`,
        "node scripts/preflight.mjs MAESTRO_TEST_PHONE MAESTRO_TEST_CODE --test-code",
      );
    }
    if (answer.status() === 404) {
      throw new PairError("ROUTE NOT FOUND", `The web has no page at ${route.web}.`, "pnpm pair --help");
    }
    await page.addStyleTag({
      content:
        // Motion off, and the QA route badge (not part of any screen) hidden.
        "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" +
        '[data-testid="route-badge"]{display:none!important}',
    });
    await page.evaluate(() => document.fonts.ready);
    await sleep(400);

    // The web draws its own home-indicator strip under the bar; a phone has
    // the real one, outside the safe area. Everything from the strip down goes.
    const stripTop = await page.evaluate(() => {
      const strip = document.querySelector("nav .h-1.w-32.rounded-full");
      return strip
        ? Math.round(strip.getBoundingClientRect().top - parseFloat(getComputedStyle(strip).marginTop))
        : null;
    });
    const strip = stripTop === null ? 0 : viewport.height - stripTop;
    if (strip !== GUESS) {
      // The page is laid out to the viewport: what is left must be the phone's height.
      await page.setViewportSize({
        width: opts.width,
        height: safeHeight + strip,
      });
      await sleep(400);
    }
    await page.screenshot({
      path: file,
      clip: { x: 0, y: 0, width: opts.width, height: safeHeight },
      animations: "disabled",
    });
    const capturedAt = new Date().toISOString();
    const version = await page.evaluate(() =>
      fetch("/api/version")
        .then((r) => r.json())
        .catch(() => null),
    );
    return {
      capturedAt,
      origin,
      path,
      sha: version?.sha ?? null,
      stripCropped: strip,
    };
  } finally {
    await context.close();
  }
}

// ── The pair ────────────────────────────────────────────────────────

/** The phone's height in points: its capture is `width` points wide. */
const phoneHeight = (session) =>
  Math.round((pngSize(session.rawPhone).height * session.width) / pngSize(session.rawPhone).width);

function pngSize(file) {
  const head = readFileSync(file).subarray(16, 24);
  return { width: head.readUInt32BE(0), height: head.readUInt32BE(4) };
}

async function compose(browser, session, opts, files, stamp) {
  const page = await browser.newPage({
    viewport: { width: opts.width * 2 + 72, height: 600 },
    deviceScaleFactor: SCALE,
  });
  const data = (file) => `data:image/png;base64,${readFileSync(file).toString("base64")}`;
  const full = phoneHeight(session);
  const safe = full - session.top - session.bottom;
  await page.setContent(`<!doctype html><body style="margin:0;padding:24px;background:#e5e5e5;font:12px/16px -apple-system,sans-serif;color:#171717">
    <div style="display:flex;gap:24px">
      <div><b>PHONE</b><div id="phone" style="margin-top:8px;width:${opts.width}px;height:${safe}px;overflow:hidden;background:#fff">
        <img src="${data(session.rawPhone)}" style="display:block;width:${opts.width}px;margin-top:-${session.top}px"></div></div>
      <div><b>WEB</b><div style="margin-top:8px;width:${opts.width}px;height:${safe}px;overflow:hidden;background:#fff">
        <img src="${data(files.web)}" style="display:block;width:${opts.width}px"></div></div>
    </div>
    <p style="margin:12px 0 0;max-width:${opts.width * 2 + 24}px;word-break:break-word">${stamp}</p></body>`);
  await page
    .locator("img")
    .last()
    .evaluate((img) => img.decode());
  await page.locator("#phone").screenshot({ path: files.phone });
  await page.screenshot({ path: files.pair, fullPage: true });
  await page.close();
}

function judgePrompt(pair) {
  const base = pair.replace(/\.png$/, "");
  if (!existsSync(`${base}.json`)) {
    throw new PairError("ROUTE NOT FOUND", `${base}.json is not there: ${pair} is not a pair.`, "pnpm pair /");
  }
  const sidecar = JSON.parse(readFileSync(`${base}.json`, "utf8"));
  return readFileSync(new URL("./pair-judge.txt", import.meta.url), "utf8")
    .replaceAll("{phone}", `${base}.phone.png`)
    .replaceAll("{web}", `${base}.web.png`)
    .replaceAll("{sidecar}", `${base}.json`)
    .replaceAll("{route}", sidecar.route)
    .replaceAll("{state}", sidecar.state)
    .replaceAll("{width}", String(sidecar.width));
}

async function main() {
  const opts = parse(process.env.PAIR_INNER ? JSON.parse(process.env.PAIR_INNER) : process.argv.slice(2));
  if (opts.help) return void console.log(HELP);
  if (opts.judge) return void console.log(judgePrompt(opts.judge));
  const route = findRoute(opts.route);
  if (!PAIR_STATES.includes(opts.state)) {
    throw new PairError(
      "ROUTE NOT FOUND",
      `${opts.state} is not a state. States: ${PAIR_STATES.join(" ")}`,
      "pnpm pair --help",
    );
  }
  withTestGuest();

  const started = Date.now();
  const out = isAbsolute(opts.out) ? opts.out : join(ROOT, opts.out);
  mkdirSync(out, { recursive: true });
  const slug = opts.route === "/" ? "home" : opts.route.replace(/^\/|\/$/g, "").replaceAll("/", "-");
  const base = join(out, `${slug}-${opts.state}-${opts.width}`);
  const files = {
    pair: `${base}.png`,
    phone: `${base}.phone.png`,
    web: `${base}.web.png`,
    sidecar: `${base}.json`,
  };

  const session = readSession();
  const raw = `${base}.raw.png`;
  const phone = capturePhone(session, opts, route, raw);
  session.rawPhone = raw;
  if (session.platform === "ios" && pngSize(raw).width !== opts.width * SCALE) {
    throw new PairError(
      "WRONG WIDTH",
      `The phone's screenshot is ${pngSize(raw).width / SCALE} wide, not ${opts.width}.`,
      `pnpm sim --width ${opts.width}`,
    );
  }

  const browser = await openBrowser();
  try {
    const web = await captureWeb(browser, session, opts, route, files.web);
    const commit = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    }).stdout.trim();
    const sidecar = {
      route: opts.route,
      state: opts.state,
      width: opts.width,
      scale: SCALE,
      location: LOCATION,
      phone: {
        platform: session.platform,
        device: session.device,
        route: route.phone,
        build: session.buildId,
        buildCommit: session.buildCommit,
        safeArea: { top: session.top, bottom: session.bottom },
        motionStopped: phone.stable,
        capturedAt: phone.capturedAt,
      },
      web: { ...web, route: route.web },
      toolCommit: commit,
      seconds: Math.round((Date.now() - started) / 1000),
    };
    const stamp = [
      `${opts.route} · ${opts.state} · ${opts.width} @${SCALE}x · ${LOCATION.latitude}, ${LOCATION.longitude}`,
      `phone ${session.device}, build ${session.buildId.slice(0, 8)} (${(session.buildCommit ?? "").slice(0, 8)}), ${phone.capturedAt}`,
      `web ${web.origin}${web.path} @ ${(web.sha ?? "unknown").slice(0, 8)}, ${web.capturedAt}`,
    ].join("<br>");
    await compose(browser, session, opts, files, stamp);
    rmSync(raw);
    writeFileSync(files.sidecar, JSON.stringify(sidecar, null, 2));
    console.log(files.pair);
  } catch (err) {
    if (err instanceof PairError) {
      err.message += ` Kept: the phone's capture, ${raw}. A rerun replaces both images.`;
    }
    throw err;
  } finally {
    await browser.close();
  }
}

main().catch(exitWith);
