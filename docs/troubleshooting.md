# Troubleshooting

Start with the symptom below. RootRay's supported platforms and capabilities are
listed in the [README](../README.md#supported-stacks); the
[architecture guide](architecture.md#dev-server-and-inspector-adapters) explains
how each runner and inspector adapter works.

## Windows blocks the unsigned installer

**Symptom:** SmartScreen warns about an unrecognized app, or organizational policy
prevents the installer from running.

**Likely cause:** RootRay releases are not yet code-signed.

**Next steps:** Download the installer and matching `.sha256` from the
[official releases](https://github.com/abudoxali/RootRay/releases/latest).
Compare the installer hash before deciding whether to run it:

```powershell
Get-FileHash .\RootRay_0.3.0_x64-setup.exe -Algorithm SHA256
Get-Content .\RootRay_0.3.0_x64-setup.exe.sha256
```

Use the actual downloaded version's filenames. If the hashes differ, stop and
report the mismatch. On a managed machine, ask your administrator about the
installation policy. A matching hash checks the download against the published
file; it does not make an unsigned installer code-signed.

**Look next:** [Installation](../README.md#install-windows). Include the Windows
version and exact warning in a bug report; do not disable system protections to
make the installation work.

## WebView2 is missing or blocked

**Symptom:** The desktop app cannot create its embedded Preview.

**Likely cause:** RootRay requires the Microsoft WebView2 Runtime. The installer
fetches Microsoft's bootstrapper when it is missing, but a managed machine may
restrict runtime installation.

**Next steps:** Check that the runtime is installed. If installation is blocked,
ask the administrator to make WebView2 available through your organization's
approved process. RootRay itself does not require a project Node installation
just to open the desktop app.

**Look next:** [Runtime requirements](../README.md#install-windows) and
Settings → Copy Diagnostics. Report the Windows and RootRay versions with the
bounded diagnostic report.

## No dev command is detected, or a target cannot run

**Symptom:** Opening a project does not produce the expected runnable target, or
Run reports a missing executable.

**Likely cause:** The selected target lacks a supported safe script, or its own
Node/package manager is absent from `PATH`. In a workspace, the selected root
and the active nested target may differ.

**Next steps:** Confirm the intended active target and its `package.json` scripts.
Check the project's tools in a terminal, for example:

```powershell
node --version
npm --version
```

For a pnpm or Yarn project, check that package manager instead. Use the project's
existing setup instructions to install its dependencies. RootRay discovers the
project without executing its code; press Run to start it.

**Look next:** [Getting started](../README.md#getting-started) and the target's
capability rows. If discovery disagrees with the manifest, report the framework,
package-manager version and a minimal reproduction.

## Preview stays blank after Run

**Symptom:** Run starts, but the app never appears in Preview.

**Likely cause:** The dev server failed to start, or RootRay has not detected its
loopback URL. The process lifecycle and Preview are separate stages.

**Next steps:** Open Output with `Ctrl+J` and inspect the dev-server stdout/stderr.
Resolve the reported project error first. Confirm the selected target is the
one you intended to run and that its dev command serves the app locally.

**Look next:** [Process state and events](architecture.md#commands-events-and-state).
Include the error and reproduction steps in a report. Do not paste private
source, `.env` contents or tokens from logs.

## Inspection is limited or unavailable

**Symptom:** The app runs, but clicking an element does not reveal an authored
component/source location.

**Likely cause:** Run support and inspection support differ by framework. React
+ Vite and supported Next.js paths have authored JSX mapping; generic-DOM
inspection provides facts/styles and exact authored HTML mapping. Other detected
frameworks can run a declared script without an inspector adapter. Runtime-created
elements and canvas pixels do not imply an authored component location.

**Next steps:** Read the active target's capability explanation and compare it
with the [capability matrix](../README.md#supported-stacks). An unsupported mapping
is a capability limit; RootRay does not guess a source location.

**Look next:** [How source mapping works](../README.md#how-source-mapping-works) and
[inspector adapters](architecture.md#dev-server-and-inspector-adapters). If a
supported authored element fails to map, include a minimal example in a bug report.

## Reporting a remaining problem

Use the [bug report form](https://github.com/abudoxali/RootRay/issues/new?template=bug_report.yml).
Include the RootRay version, Windows version, project framework/package manager,
steps, expected result and actual result. Settings → Copy Diagnostics produces
a bounded report intended for sharing. Never attach secrets, tokens, `.env`
contents or private source. Security reports follow [SECURITY.md](../SECURITY.md).
