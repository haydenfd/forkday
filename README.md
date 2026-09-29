# Forkday

Forkday contains a local Electron shell and a minimal Chrome extension. The desktop app proves local Codex invocation; the extension detects supported Workday job pages without reading or sending page data.

## Setup

Requirements: Node.js 22+, pnpm, and optionally the Codex CLI.

```bash
pnpm install
pnpm -C apps/desktop exec playwright install chromium
pnpm dev
```

Useful checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

To try the extension, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `apps/extension`. Visiting `https://*.myworkdayjobs.com/*` shows a dismissible Forkday prompt.

## Architecture

- `apps/desktop/src/main`: owns PATH resolution, CLI discovery, subprocesses, provider health, authentication, history, and IPC handlers.
- `apps/desktop/src/preload`: exposes only the typed `window.forkday` methods through `contextBridge`.
- `apps/desktop/src/renderer`: displays state and calls the preload API; it has no Node or shell access.
- `apps/extension`: dependency-free Manifest V3 content script for supported Workday job pages.
- `ModelProvider`: the single provider seam. Only `CodexProvider` is implemented.

## Codex behavior

At startup, Forkday asks the user's login shell for its PATH. This handles GUI launches that do not inherit the interactive shell PATH. `FORKDAY_CODEX_PATH` can override the discovered binary later without changing the provider.

Health checks use `codex --version` and the documented `codex login status`. Forkday never reads credential files. If authentication is missing, **Authenticate** starts the normal `codex login --device-auth` flow and opens the URL emitted by Codex in the default browser. The login subprocess is terminated if Forkday exits.

**Test Codex** runs `codex exec` in read-only, ephemeral mode with a 60-second timeout. It ignores user configuration and rules so personal hooks, MCP servers, and project instructions do not affect this fixed health check; Codex authentication remains available. It uses the CLI's documented `--output-schema` and `--output-last-message` options, then validates the JSON again before sending it to the renderer. Temporary schema/output files are removed after each call.

The current CLI does not expose reliable account usage or rate-limit status programmatically. Forkday does not inspect private credential or state files to infer it.

## Browser proof of concept

Paste a job URL into **Job URL** and click **Open Browser**. The main-process
`BrowserManager` opens one visible Chromium instance using Playwright's
`launchPersistentContext`. Its profile lives at
`app.getPath('userData')/browser-profile`, separate from your normal Chrome
profile. Subsequent opens reuse that browser. Closing Chromium manually allows
the next click to launch it again. Closing Forkday's window or quitting the app
closes its browser, including on macOS.

The preload exposes only `openBrowser(url)`. Main validates HTTP/HTTPS URLs and
rejects embedded credentials before launching or navigating. The page stays open
for manual interaction; Forkday does not inspect or automate it.

To verify locally: check Codex is authenticated, click **Test Codex**, paste a
real `myworkdayjobs.com` job URL, click **Open Browser**, and confirm the separate
Chromium window displays that URL. Close Forkday and confirm Chromium closes too.

## Limitations

- Invocation history is in memory and resets when the app exits.
- Authentication uses the device flow; the renderer only receives launch instructions, not credentials.
- Process-tree cleanup uses POSIX process groups on macOS/Linux and direct child termination on Windows.
- This is a development shell, not a packaged installer.

## Future scope

- Claude Code provider
- Chrome extension handoff to the desktop app
- Playwright Workday runner
- durable application workflow
