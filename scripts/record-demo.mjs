/**
 * Records the real RootRay demo: drives the installed app through
 * Open → Run → Inspect → click-to-source → Quick Edit → save → HMR
 * while scripts/capture-loop.ps1 PrintWindows the app window into
 * numbered PNG frames, then ffmpeg encodes docs/media/demo.gif.
 *
 * PrintWindow renders the DWM-composited window, so this captures the
 * native WebView2 preview surface AND works when the window is occluded
 * — DOM screenshots cannot do either.
 *
 * Requirements: RootRay installed, ffmpeg on PATH, fixture deps
 * installed in fixtures/vite-react-inspector.
 *
 * Usage (repo root):
 *   node scripts/record-demo.mjs
 */

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  attachCdp,
  attachPreview,
  attachUI,
  EXE,
  killApp,
  launchApp,
  REPO_ROOT,
  resizeAppWindow,
  seedSettings,
  sleep,
  waitText,
} from "../tests/e2e/installed-preview.mjs";

const FIXTURE = join(REPO_ROOT, "fixtures", "vite-react-inspector");
const OUT = join(REPO_ROOT, "target", "demo-recording");
const FRAMES = join(OUT, "frames");
const STOP = join(OUT, "stop.flag");
const GIF = join(REPO_ROOT, "docs", "media", "demo.gif");
const CAP_PS1 = join(REPO_ROOT, "scripts", "capture-loop.ps1");
const CDP_PORT = 9251;
const CAPTURE_FPS = 6;

const EDIT_TARGET = join(FIXTURE, "src", "components", "ActionButton.tsx");
const ORIGINAL = readFileSync(EDIT_TARGET, "utf8");
const EDITED = ORIGINAL.replace("Count is {count}", "Count is now {count}");

function ffmpeg(args) {
  return new Promise((res, rej) => {
    let err = "";
    const p = spawn("ffmpeg", ["-hide_banner", "-y", ...args]);
    p.stderr.on("data", (d) => (err += d));
    p.on("exit", (c) =>
      c === 0 ? res() : rej(new Error(`ffmpeg ${c}: ${err.slice(-400)}`)),
    );
  });
}

async function main() {
  if (!existsSync(EXE)) throw new Error(`installed exe missing: ${EXE}`);
  if (!existsSync(join(FIXTURE, "node_modules", "vite")))
    throw new Error("fixture deps missing — npm install in fixtures/vite-react-inspector");

  rmSync(FRAMES, { recursive: true, force: true });
  rmSync(STOP, { force: true });
  mkdirSync(FRAMES, { recursive: true });

  seedSettings(FIXTURE);
  const appProc = launchApp(CDP_PORT);
  await resizeAppWindow(appProc.pid, 1366, 850);

  const t0 = Date.now();
  const mark = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
  let cdp;
  let capture = null;
  let captureExit = null;

  const startCapture = () => {
    capture = spawn(
      "powershell",
      [
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", CAP_PS1,
        "-ProcId", appProc.pid,
        "-OutDir", FRAMES,
        "-StopFile", STOP,
        "-Fps", CAPTURE_FPS,
        "-MaxSeconds", 180,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    capture.out = "";
    capture.stdout.on("data", (d) => (capture.out += d));
    capture.stderr.on("data", (d) => (capture.out += d));
    captureExit = new Promise((res) => capture.once("exit", res));
  };

  try {
    cdp = await attachCdp(CDP_PORT);
    const appPage = await attachUI(cdp);
    await waitText(appPage, "fixture-vite-react-inspector", 60_000);
    mark("analyzed");
    startCapture(); // window exists — PrintWindow has a real handle
    await sleep(3000); // hold on Home so the loop captures it

    await appPage.locator("button", { hasText: "Run Project" }).click();
    mark("Run clicked");
    await appPage.locator(".url-chip").waitFor({ timeout: 120_000 });
    const appUrl = (await appPage.locator(".url-chip").innerText()).trim();
    mark(`url chip: ${appUrl}`);
    const devPage = await attachPreview(cdp, appUrl);
    await waitText(devPage, "Inspector fixture", 30_000);
    await appPage.locator(".preview-phase-ready").waitFor({ timeout: 30_000 });
    mark("preview ready");
    await sleep(2500); // preview visible

    const button = devPage.locator("button", { hasText: "Count is" }).first();
    await appPage.locator("button", { hasText: "Inspect UI" }).click();
    mark("inspect mode on");
    await waitText(appPage, "Inspecting", 15_000);
    await sleep(800);
    await button.hover();
    await devPage.locator(".rr-box").waitFor({ timeout: 15_000 });
    await sleep(1500); // overlay readable
    await button.click();
    await appPage.locator(".selection").waitFor({ timeout: 15_000 });
    await appPage.locator(".qeditor").waitFor({ timeout: 15_000 });
    await appPage.locator(".cm-rootray-marked-line").waitFor({ timeout: 10_000 });
    mark("source open in quick edit");
    await sleep(2500); // source beside preview

    await appPage.locator(".cm-content").click();
    await appPage.keyboard.press("ControlOrMeta+a");
    await appPage.keyboard.insertText(EDITED);
    await sleep(1000);
    await appPage.locator(".qe-foot button", { hasText: "Save" }).click();
    await waitText(appPage, "Saved", 15_000);
    mark("saved");
    await devPage
      .locator("button", { hasText: "Count is now 0" })
      .first()
      .waitFor({ timeout: 30_000 });
    mark("HMR applied");
    await sleep(2500); // HMR result visible
  } finally {
    writeFileSync(STOP, "stop"); // tell the capture loop to finish
    writeFileSync(EDIT_TARGET, ORIGINAL, "utf8");
    if (capture && capture.exitCode === null) await captureExit;
    console.log((capture?.out ?? "").trim());
    await cdp?.close().catch(() => { });
    await killApp(appProc);
  }

  const frames = readdirSync(FRAMES).filter((f) => f.endsWith(".png"));
  if (frames.length < 10)
    throw new Error(`too few frames captured (${frames.length})`);

  // Frames are captured at CAPTURE_FPS pacing inside the loop, so use
  // that as the input rate — playback then matches real elapsed time.
  const inputFps = CAPTURE_FPS;

  // Two-pass GIF: palette then encode, 860px wide.
  const palette = join(OUT, "palette.png");
  const src = join(FRAMES, "f%04d.png");
  await ffmpeg([
    "-framerate", String(inputFps), "-i", src,
    "-vf", "scale=860:-1:flags=lanczos,palettegen=stats_mode=diff",
    palette,
  ]);
  await ffmpeg([
    "-framerate", String(inputFps), "-i", src,
    "-i", palette,
    "-lavfi",
    "scale=860:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=4",
    "-loop", "0",
    GIF,
  ]);
  console.log(`demo.gif written to ${GIF} (${frames.length} frames, ${duration.toFixed(1)}s)`);
}

main().catch((e) => {
  console.error(`record-demo failed: ${e.message}`);
  process.exit(1);
});
