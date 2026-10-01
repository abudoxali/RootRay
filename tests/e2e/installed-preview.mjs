/**
 * Shared helpers for the v0.3.0 installed-app verification scripts.
 *
 * The embedded preview is a native WebView2 child surface in the same
 * browser process as the RootRay UI, so the single WebView2 remote
 * debugging endpoint exposes BOTH pages: the privileged UI (tauri://)
 * and the unprivileged preview (the dev-server URL). Attaching to the
 * preview page over CDP lets a script drive the real embedded browser —
 * hover, click, keyboard — exactly where a user's project runs.
 */

import assert from "node:assert/strict";
import { execFileSync, execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

export const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "..", "..", "..");
export const EXE = join(process.env.LOCALAPPDATA ?? "", "RootRay", "rootray-desktop.exe");
export const CFG_DIR = join(process.env.APPDATA ?? "", "dev.rootray.app");

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function shot(page, dir, name) {
  try {
    await page.screenshot({ path: join(dir, `${name}.png`) });
  } catch (e) {
    console.warn(`  (screenshot ${name} failed: ${e.message})`);
  }
}

export async function waitText(page, text, timeout = 30_000) {
  await page.locator(`text=${text}`).first().waitFor({ timeout });
}

export function makeShotDir(name) {
  const dir = join(REPO_ROOT, "target", name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Child processes of the installed app, via CIM. */
export function childProcs(pid) {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"ParentProcessId=${pid}\\" | Select-Object -Expand Name"`,
      { encoding: "utf8" },
    );
    return out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Seeds settings.json so the installed app auto-restores `projectDir` and
 * auto-opens the INTERNAL preview. `openBrowserAutomatically:false` stays
 * in the file on purpose — it is the legacy field the migration must not
 * let override the explicit new preference.
 */
export function seedSettings(projectDir) {
  mkdirSync(CFG_DIR, { recursive: true });
  const settings = {
    lastProject: projectDir,
    recentProjects: [projectDir],
    preferredLauncher: null,
    openBrowserAutomatically: false,
    openPreviewAutomatically: true,
  };
  writeFileSync(join(CFG_DIR, "settings.json"), JSON.stringify(settings), {
    encoding: "utf8",
  });
  console.log(`seeded lastProject = ${projectDir}`);
}

/** Launches the installed exe with the WebView2 CDP endpoint enabled. */
export function launchApp(cdpPort) {
  const proc = spawn(EXE, [], {
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${cdpPort}`,
    },
    stdio: "ignore",
  });
  console.log(`launched installed app (pid ${proc.pid})`);
  return proc;
}

/** Connects Playwright to the app's WebView2 browser process. */
export async function attachCdp(cdpPort, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
    } catch {
      await sleep(500);
    }
  }
  assert.fail("could not attach to installed app WebView2 over CDP");
}

/** Every page target the WebView2 browser process exposes. */
export function allPages(cdp) {
  return cdp.contexts().flatMap((ctx) => ctx.pages());
}

/** Finds the privileged RootRay UI page (tauri:// origin). */
export async function attachUI(cdp, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const p of allPages(cdp)) {
      const url = p.url();
      const isUi =
        url.includes("tauri.localhost") ||
        url.startsWith("tauri:") ||
        (await p.title().catch(() => "")) === "RootRay";
      if (!isUi) continue;
      // The installed WebView2 profile persists localStorage between runs —
      // a previous verification can leave panes hidden and poison later DOM
      // assertions. Reset UI prefs once on attach, then reload so the app
      // re-reads the documented defaults. Settings on disk are untouched.
      try {
        await p.evaluate(() => globalThis.localStorage?.clear());
        await p.reload();
      } catch {
        /* page may be mid-navigation; the app still boots with stale prefs */
      }
      return p;
    }
    await sleep(500);
  }
  const seen = allPages(cdp)
    .map((p) => p.url())
    .join(", ");
  assert.fail(`RootRay app page not found over CDP (targets: ${seen})`);
}

/**
 * Finds the embedded preview page — a CDP page target whose URL lives
 * under the dev-server URL. `urlBase` may be exact or a prefix.
 */
export async function attachPreview(cdp, urlBase, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  const normalized = urlBase.endsWith("/") ? urlBase.slice(0, -1) : urlBase;
  while (Date.now() < deadline) {
    for (const p of allPages(cdp)) {
      if (p.url() === normalized || p.url().startsWith(`${normalized}/`)) return p;
    }
    await sleep(500);
  }
  const seen = allPages(cdp)
    .map((p) => p.url())
    .join(", ");
  assert.fail(`embedded preview page for ${urlBase} not found (targets: ${seen})`);
}

/**
 * Adversarial IPC check — project content must hold ZERO Tauri command
 * access. Whatever the page's IPC surface looks like (no injected
 * internals, a rejected invoke, or an invoke that goes nowhere because
 * no IPC channel exists), a privileged command must never resolve.
 */
export async function assertPreviewHasNoIpc(previewPage) {
  const probe = await previewPage.evaluate(async () => {
    const internals = window.__TAURI_INTERNALS__;
    if (!internals || typeof internals.invoke !== "function") return "no-ipc-surface";
    const attempt = (cmd, args) =>
      Promise.race([
        Promise.resolve()
          .then(() => internals.invoke(cmd, args))
          .then(() => "RESOLVED")
          .catch((e) => `denied:${String(e).slice(0, 120)}`),
        new Promise((r) => setTimeout(() => r("no-channel"), 5000)),
      ]);
    return {
      runtime: await attempt("get_runtime_state"),
      browser: await attempt("open_browser", { url: "https://example.com" }),
      fs: await attempt("plugin:fs|read_text_file", { path: "C:/Windows/win.ini" }),
    };
  });
  if (probe === "no-ipc-surface") {
    console.log("  ok  preview page has no Tauri IPC surface at all");
    return;
  }
  for (const [cmd, result] of Object.entries(probe)) {
    assert.notEqual(
      result,
      "RESOLVED",
      `preview webview reached privileged command ${cmd}: ${result}`,
    );
  }
  console.log(`  ok  preview IPC present but every command denied: ${JSON.stringify(probe)}`);
}

/**
 * Resizes the installed app's native window via Win32 SetWindowPos —
 * WebView2 tracks the HWND, so the React layout sees the new size and
 * responsive auto-hides recompute. Assertions that require ALL panes
 * during Split (e.g. `.boxmodel` visible while the editor is open) need
 * a window wider than the 1120px default, where the Inspector is
 * *correctly* auto-hidden.
 */
export async function resizeAppWindow(pid, width = 1600, height = 1000) {
  const ps = [
    `Add-Type -Name U32 -Namespace W -MemberDefinition '[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool SetWindowPos(System.IntPtr h, System.IntPtr a, int x, int y, int cx, int cy, uint f);'`,
    `$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue`,
    `if (-not $p -or $p.MainWindowHandle -eq 0) { exit 3 }`,
    `[W.U32]::SetWindowPos($p.MainWindowHandle, [System.IntPtr]::Zero, 40, 30, ${width}, ${height}, 0x0040) | Out-Null`,
  ].join("; ");
  const deadline = Date.now() + 15_000;
  for (;;) {
    try {
      execFileSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "pipe" });
      return;
    } catch {
      if (Date.now() > deadline) return; // window never appeared — leave default
      await sleep(300);
    }
  }
}

let pixelBrowser = null;

/**
 * Counts bright-neutral and orange pixels in a PNG — replaces the PIL
 * dependency so icon assertions run on machines without Python. Decodes
 * via the bundled Chromium already used to drive the app.
 *   crop:   {x, y, w, h} optional, clamped to the image
 *   orange: [rMin, gMin, gMax, bMax] — defaults to the robot accent band
 * Returns [whiteCount, orangeCount]. Call closePixelBrowser() when done.
 */
export async function pixelSignature(pngPath, crop = null, orange = [200, 60, 160, 80]) {
  pixelBrowser ??= await chromium.launch();
  const page = await pixelBrowser.newPage();
  try {
    const b64 = readFileSync(pngPath).toString("base64");
    return await page.evaluate(
      async ([b64i, c, o]) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64i}`;
        await img.decode();
        const x = c?.x ?? 0;
        const y = c?.y ?? 0;
        const w = Math.min(c?.w ?? img.width, img.width - x);
        const h = Math.min(c?.h ?? img.height, img.height - y);
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        const ctx = cv.getContext("2d");
        ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
        const d = ctx.getImageData(0, 0, w, h).data;
        let white = 0;
        let accent = 0;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          if (r > 120 && g > 120 && b > 120) white++;
          if (r > o[0] && g > o[1] && g < o[2] && b < o[3]) accent++;
        }
        return [white, accent];
      },
      [b64, crop, orange],
    );
  } finally {
    await page.close();
  }
}

export async function closePixelBrowser() {
  await pixelBrowser?.close().catch(() => {});
  pixelBrowser = null;
}

/** Waits until `predicate` holds, polling every `step` ms. */
export async function until(predicate, what, timeoutMs = 15_000, step = 250) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return;
    } catch {
      /* keep polling */
    }
    await sleep(step);
  }
  assert.fail(`timeout waiting for ${what}`);
}

/** Kills the installed app and its whole process tree. */
export async function killApp(appProc) {
  try {
    process.kill(appProc.pid);
  } catch (error) {
    void error;
  }
  await sleep(1000);
  try {
    execFileSync("taskkill", ["/PID", String(appProc.pid), "/T", "/F"], { stdio: "ignore" });
  } catch (error) {
    void error;
  }
}

export { existsSync };
