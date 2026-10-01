import assert from "node:assert/strict";
import { join } from "node:path";
import {
  attachCdp,
  attachUI,
  childProcs,
  EXE,
  existsSync,
  killApp,
  launchApp,
  REPO_ROOT,
  seedSettings,
  until,
} from "./installed-preview.mjs";

const INVALID_PROJECT = join(REPO_ROOT, "target", "phase02-invalid-project-does-not-exist");
const MISSING_DEPS_PROJECT = join(REPO_ROOT, "fixtures", "nextjs-basic");

async function invalidProject() {
  assert.ok(existsSync(EXE), `installed exe missing: ${EXE}`);
  assert.equal(existsSync(INVALID_PROJECT), false, "invalid-project sentinel unexpectedly exists");
  seedSettings(INVALID_PROJECT);
  const appProc = launchApp(9240);
  let cdp;
  try {
    cdp = await attachCdp(9240);
    const page = await attachUI(cdp);
    await page.getByRole("heading", { name: "Open a workspace" }).waitFor({ timeout: 60_000 });
    const notice = page.locator(".notice");
    await notice.waitFor({ timeout: 30_000 });
    assert.match(await notice.innerText(), /Could not restore last project/i);
    assert.match(
      await notice.innerText(),
      /does not exist|invalid project|not a readable directory|cannot find the file/i,
    );
    await page.locator(".app-shell").waitFor({ timeout: 5_000 });
    assert.equal(await page.locator(".workbench").count(), 0);
    console.log("  ok  invalid project returns to Home with a useful notice and intact shell");
  } finally {
    await cdp?.close().catch(() => undefined);
    await killApp(appProc);
  }
}

async function missingDependencies() {
  assert.ok(existsSync(MISSING_DEPS_PROJECT), "missing-dependencies fixture absent");
  assert.equal(
    existsSync(join(MISSING_DEPS_PROJECT, "node_modules", "next")),
    false,
    "missing-dependencies fixture unexpectedly has Next installed",
  );
  seedSettings(MISSING_DEPS_PROJECT);
  const appProc = launchApp(9241);
  let cdp;
  try {
    cdp = await attachCdp(9241);
    const page = await attachUI(cdp);
    const run = page.getByRole("button", { name: "Run Project" });
    await run.waitFor({ timeout: 60_000 });
    await run.click();
    await until(
      async () =>
        (await page
          .locator(".run-state")
          .textContent()
          .then((text) => text?.trim().toLowerCase())
          .catch(() => "")) === "failed",
      "missing-dependencies run to fail",
      60_000,
    ).catch(async (error) => {
      const state = await page
        .locator(".run-state")
        .textContent()
        .catch(() => null);
      const attention = await page
        .locator(".reasons")
        .allInnerTexts()
        .catch(() => []);
      const notices = await page
        .locator(".notice")
        .allInnerTexts()
        .catch(() => []);
      console.error(
        `diag: state=${state} attention=${JSON.stringify(attention)} notices=${JSON.stringify(notices)}`,
      );
      throw error;
    });
    await page.getByText("Project needs attention").waitFor({ timeout: 10_000 });
    assert.match(
      await page
        .locator(".reasons")
        .allInnerTexts()
        .then((lines) => lines.join("\n")),
      /PROCESS_EXITED|process exited/i,
    );
    const expand = page.getByRole("button", { name: /Expand output/i });
    if (await expand.isVisible()) await expand.click();
    const output = page.locator(".logbox");
    await output.waitFor({ timeout: 10_000 });
    await until(
      async () =>
        /dependencies appear to be missing|'next' is not recognized/i.test(
          await output.innerText(),
        ),
      "missing dependency recovery hint",
      15_000,
    );
    assert.match(await output.innerText(), /npm install|not recognized/i);
    assert.equal(
      await page.locator(".preview-toolbar").count(),
      0,
      "Preview remained after failed start",
    );
    await page.locator(".app-shell").waitFor({ timeout: 5_000 });
    const stop = page.getByRole("button", { name: "Stop", exact: true });
    assert.equal(await stop.isDisabled(), true, "Stop should be disabled when no process remains");
    const restart = page.getByRole("button", { name: "Restart", exact: true });
    assert.equal(
      await restart.isEnabled(),
      true,
      "Retry should remain available after failed start",
    );
    await restart.click();
    await until(
      async () =>
        (await page
          .locator(".run-state")
          .textContent()
          .then((text) => text?.trim().toLowerCase())
          .catch(() => "")) === "failed",
      "failed start retry to settle",
      60_000,
    );
    assert.equal(await page.locator(".preview-toolbar").count(), 0);
    const kids = childProcs(appProc.pid).filter((name) => /node|npm|next|cmd/i.test(name));
    assert.deepEqual(kids, [], `failed start left an owned process alive: ${kids.join(", ")}`);
    const notices = await page
      .locator(".notice")
      .allInnerTexts()
      .catch(() => []);
    assert.equal(
      notices.some((text) => /illegal runtime state/i.test(text)),
      false,
    );
    console.log(
      "  ok  missing dependencies fail visibly, offer retry guidance, and leave no stuck Preview/process",
    );
  } finally {
    await cdp?.close().catch(() => undefined);
    await killApp(appProc);
  }
}

await invalidProject();
await missingDependencies();
console.log("\nINSTALLED RECOVERY VERIFICATION: PASS");
