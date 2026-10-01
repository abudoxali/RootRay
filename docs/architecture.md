# RootRay Architecture

## System layers

```text
Desktop React UI (apps/desktop)
        │  invoke narrow commands / receive Tauri events
        ▼
Tauri command and event boundary (apps/desktop/src-tauri)
        │  delegates application logic
        ▼
rootray-core (crates/rootray-core) — no Tauri dependency
        │
        ├─ project/       bounded discovery, framework detection, targets, capabilities
        ├─ process/       dev-server spawn, output, URL detection and shutdown
        ├─ inspector/     adapters, authenticated bridge, session lifecycle
        ├─ static_server  loopback static hosting, HTML injection and reload events
        ├─ editor/        safe reads, writes, conflicts and file watching
        ├─ filesystem/    canonicalized workspace boundaries and navigation
        ├─ launcher/      external editor and browser launch
        ├─ state/         authoritative runtime state machine
        ├─ settings/      local settings store
        └─ app.rs         AppCore orchestration
```

The Tauri shell exposes explicit application commands only. It does not expose a
generic command executor. `AppCore` owns project analysis, the selected target,
the dev-server or static-server lifecycle, the inspector session and the editor
session. Keeping those operations in `rootray-core` makes them testable without
a webview and keeps the native privilege boundary small.

## Implemented v0.3 flow

```text
Open Project
  → bounded workspace analysis and target selection
  → Run
  → AppCore chooses the target runner and InspectorAdapter
  → instrumented dev server, or RootRay's static loopback server
  → URL detection
  → embedded child WebView2 Preview
  → Interact or Inspect
  → authenticated inspector selection
  → workspace-relative source resolution
  → CodeMirror Quick Edit
  → hash-checked atomic save
  → HMR / Fast Refresh, or static-server SSE reload
```

Project discovery does not execute project code. It distinguishes the selected
workspace root (also the filesystem security root) from a nested active target
root. The active target determines the run directory and capabilities while
Explorer, Search and source paths remain workspace-relative.

## Commands, events and state

The main React webview invokes commands declared in the Tauri shell. Process,
inspector, editor and Preview changes return as full or typed event payloads:

```text
dev-server stdout/stderr
  → ProcessManager reader threads
  → AppCore RuntimeState update
  → rootray://process-event + rootray://state
  → frontend reducer

inspector bridge
  → validated InspectorState
  → rootray://inspector-state
  → selection auto-reveal

file watcher
  → rootray://editor-event
  → reload clean sessions or surface a conflict

child Preview webview
  → native PreviewState
  → rootray://preview-state
  → toolbar/loading state
```

`RuntimeState.seq` and process generations prevent older asynchronous snapshots
or output from replacing a newer project/run state. Project changes and
start/stop/restart operations are serialized in the core.

The runtime state machine is:

```text
idle → analyzing → ready → starting → running → stopping → stopped
          │          │          │          │                    │
          └──────────┴──────────┴──────────┴──────→ failed      └→ starting
```

A clean or failed process exit updates the authoritative state. Restart may
begin from running, stopped or failed. Changing project while live stops the
owned server tree and analyzes the new directory under one lifecycle hold.

## Dev-server and inspector adapters

`InspectorAdapter` currently has three implemented paths:

- `ViteReact` runs a reconstructable plain Vite command through RootRay's
  in-memory plugin in `jsx-meta` mode.
- `ViteGeneric` serves plain Vite, Vue + Vite and Svelte + Vite targets in
  `generic-dom` mode when their script is reconstructable as Vite. Authored
  `index.html` can map exactly; framework-created DOM remains inspectable but
  has no fabricated component/source mapping.
- `NextJs` runs a reconstructable `next dev` command with RootRay's shim and JSX
  loader for supported Turbopack and webpack development paths.

Other detected frameworks may still run their declared script, but they do not
receive an inspector adapter. Capability rows report the limitation instead of
claiming component/source support.

Static web targets use RootRay's own loopback HTTP server. It stamps authored
HTML, injects the inspector runtime and exposes an SSE endpoint used to reload
a connected page after a save.

Adapter assets are shipped with the desktop bundle. Instrumentation is applied
at dev-server/build-transform time; RootRay does not rewrite project source.
The Next.js path writes a generated session entry under
`node_modules/.cache/rootray/`, then replaces it with an inert stub at session
end so stale bundler cache imports remain resolvable.

## Embedded Preview

RootRay uses two webviews in one native window:

1. **Main RootRay webview** — renders the trusted React workbench and owns the
   Tauri capability set.
2. **`project-preview` child webview** — renders the user's local application
   as a native WebView2 child surface. It matches no Tauri capability and has no
   privileged IPC commands.

The Preview is not an iframe or a React DOM child. `PreviewPanel` renders a
`.preview-host` placeholder and measures its logical rectangle. A
`ResizeObserver`, batched through `requestAnimationFrame`, calls
`preview_set_bounds` only when the rectangle materially changes. Native code
positions the child WebView2 over that rectangle. Pane resize, Preview/Code/
Split changes, focus modes and Output changes therefore keep the native surface
aligned with the React layout.

The child surface is hidden while a modal, palette or splitter drag needs to
cover its pixels, and in Code-only mode. Hiding preserves browser state.
Stopping the runtime closes the child webview; changing projects or returning to
an idle/ready analysis state disposes it and clears its URL.

### Preview isolation and navigation

Tauri capabilities are scoped to `webviews: ["main"]`; the child Preview has no
matching capability. Preview commands also reject any caller whose webview
label is not `main`, providing a second native check.

Main-frame Preview navigation accepts only loopback HTTP(S) URLs. Address-bar
navigation is validated in both React and native code. New-window requests are
always denied: loopback links navigate the existing Preview, remote HTTP(S)
links are handed to the unprivileged system browser, and other schemes are
denied.

The project page does not send selections through Tauri IPC. It communicates
with the separate inspector bridge described below.

## Interact, Inspect and selection transport

**Interact** leaves the project page's normal pointer and keyboard behavior in
control. **Inspect** tells the in-page inspector runtime to show its overlay and
capture an element selection. Escape or the workbench toggle returns to
Interact.

```text
instrumented project runtime
  → element:selected protocol message
  → ws://127.0.0.1:<dynamic>/rootray
  → session id + ephemeral token + protocol/shape validation
  → source-path rebasing and workspace-boundary validation
  → InspectorState selection event
  → Inspector metadata + Code pane auto-reveal
```

The bridge listens on loopback with a dynamic port and per-session credentials.
Messages are data only. A project page cannot request a file read, write,
process operation or native Preview command.

React/Next instrumentation stamps intrinsic JSX elements with
`data-rootray-file`, line, column and component metadata. Generic Vite/static
instrumentation stamps authored HTML. In `jsx-meta` mode the runtime may select
the nearest instrumented authored ancestor; in `generic-dom` mode it reports
the selected DOM node and includes source only when that node has an authored
stamp. Runtime-created DOM and canvas surfaces remain inspectable for element
facts/styles but report no authored source.

## Source resolution and CodeMirror handoff

A source-bearing selection contains a workspace-relative path and a 1-based
line/column. The Rust bridge validates and rebases target-relative metadata to
the workspace root. The frontend's selection auto-reveal then:

1. keeps Preview visible and switches Preview-only view to Split;
2. opens the reported relative path through `open_source_editor`;
3. discards stale reads using a monotonic Quick Edit sequence;
4. preserves dirty text on same-file reselection and only moves the marker;
5. passes the returned source text and exact location to the lazy CodeMirror
   editor.

CodeMirror initializes from the latest source value after its asynchronous
language extension resolves, reconciles any value that arrived during mount,
and applies the selected-line decoration. The editor surface stays covered by a
loading state until non-whitespace source is rendered; a genuinely empty file
uses an explicit empty-file state.

Preview Focus deliberately does not tear down the focused layout when a
selection arrives. It shows a source offer; accepting it exits focus and opens
Split.

## Safe source editing

```text
open_source_editor(relative path)
  → canonicalize inside workspace root
  → deny secrets/generated paths, oversized/binary/non-UTF-8 files
  → return content + SHA-256 + BOM/EOL metadata
  → CodeMirror editing
  → save_source_file(content, expected hash)
  → re-read disk and compare hash
  → encode original BOM/EOL
  → same-directory temporary file + fsync + atomic rename
  → watcher event / HMR, Fast Refresh or static SSE reload
```

A hash mismatch produces `SOURCE_EDIT_CONFLICT`; unsaved content is retained.
Clean sessions may reload after an external write, while dirty sessions show a
conflict. `peek_source_file` supports comparison without mutating the edit
session, and revert is allowed only while disk still matches RootRay's last
write.

All project file operations revalidate paths against the workspace root and
refuse traversal, absolute paths, symlink escapes, secrets, generated trees,
binary files and oversized files.

## Responsive workbench

Preview and Code are the primary Split surfaces. Each has a practical 360 px
minimum. Explorer and Inspector are secondary: when the measured workbench
width cannot preserve both primary surfaces, Inspector auto-collapses first and
Explorer next. These responsive hides are transient and do not overwrite the
user's persisted visibility settings.

Explorer, Inspector and Output retain their state when collapsed. Pane widths,
Output height and split ratio are clamped before persistence. Focus modes and
responsive auto-hides are session-only. The native Preview receives new bounds
after every layout change.

## Process containment on Windows

Every spawned dev server is assigned to a RootRay-owned Windows Job Object with
`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`. Descendants join the job automatically.
Stop and Restart perform normal owned-tree termination; closing or crashing
RootRay closes the job handle so the tree cannot be orphaned. RootRay never
kills a process merely because it owns a port.

## Project navigation and static intelligence

Explorer fetches directory children lazily. Quick Open and Workspace Search use
bounded native walks with file, byte and result caps. Component intelligence
parses collected JavaScript/TypeScript source as data; it does not import or
execute project modules. Unresolved imports, aliases and ambiguous re-exports
remain explicitly unresolved.

Style inspection is collected on selection and bounded to curated computed
properties, box-model values and matched rules. Vite stylesheet paths are
normalized and rejected if they escape the workspace; selector-line inference
is not claimed.

## Extension points

A new runtime integration belongs behind `InspectorAdapter` and must define its
honest capability tier, safe command reconstruction and instrumentation path.
Framework detection alone does not imply source or component mapping.

External editor support is extended through `LauncherSpec` entries in
`launcher/mod.rs`; all launches still receive a workspace-bounded path.
