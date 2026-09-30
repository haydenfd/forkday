# Forkday

Forkday contains a local Electron shell and a minimal Chrome extension. The desktop app proves local Codex invocation; the extension detects supported Workday job pages without reading or sending page data.

## Setup

Requirements: Node.js 22+, pnpm, and optionally the Codex CLI.

```bash
pnpm install
pnpm exec install-electron
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
- `apps/desktop/src/renderer`: Vite/React UI styled with Tailwind CSS and local shadcn/ui components. It calls the preload API and has no Node or shell access.
- `apps/extension`: dependency-free Manifest V3 content script for supported Workday job pages.
- `ModelProvider`: the single provider seam. Only `CodexProvider` is implemented.

UI components live in `apps/desktop/src/renderer/src/components/ui`. The shadcn
configuration is `apps/desktop/components.json`; Tailwind runs through the Vite
plugin in `electron.vite.config.ts`.

`pnpm dev` watches all three Electron layers: renderer changes update through
Vite HMR, preload changes reload the renderer, and main-process changes restart
Electron automatically. Main-process restarts reset the in-memory job queue.

## Codex behavior

At startup, Forkday asks the user's login shell for its PATH. This handles GUI launches that do not inherit the interactive shell PATH. `FORKDAY_CODEX_PATH` can override the discovered binary later without changing the provider.

Health checks use `codex --version` and the documented `codex login status`. Forkday never reads credential files. If authentication is missing, **Authenticate** starts the normal `codex login --device-auth` flow and opens the URL emitted by Codex in the default browser. The login subprocess is terminated if Forkday exits.

**Test Codex** runs `codex exec` in read-only, ephemeral mode with a 60-second timeout. It ignores user configuration and rules so personal hooks, MCP servers, and project instructions do not affect this fixed health check; Codex authentication remains available. It uses the CLI's documented `--output-schema` and `--output-last-message` options, then validates the JSON again before sending it to the renderer. Temporary schema/output files are removed after each call.

The current CLI does not expose reliable account usage or rate-limit status programmatically. Forkday does not inspect private credential or state files to infer it.

## Browser proof of concept

The home screen is split in two: paste a job URL on the left and it loads in
the embedded browser on the right, below the top bar. Until a page loads, the
right half shows a blank placeholder. The browser hides on **Settings** and
returns when you go back.

The job queue dashboard (active, queued, completed, and failed applications) is
parked in `apps/desktop/src/renderer/src/JobsDashboard.tsx`. It still compiles
but is not rendered; render it from `main.tsx` to bring it back. The main-process
`JobQueue` and its IPC are unchanged.

The browser uses Electron's `WebContentsView` and a separate persistent session
(`persist:forkday-jobs`) so logins survive closing and reopening the app. Main
validates HTTP/HTTPS URLs, rejects embedded credentials, and blocks unsafe
navigation. The remote page has no Node access or Forkday preload API. Links
that request a new window open in the same pane.

Apply starts manually in the browser; Codex's provider test does not
control the page. Agent browser tools are not connected yet. The application
queue is in memory and resets when Forkday quits.

Run `pnpm -C apps/desktop test:browser` to verify the split view, embedded
browser, navigation guards, resize, Settings hide/show, URL validation, and page
isolation in a real Electron window.

## Fill a Workday account form

1. Open a Workday job URL and click **Apply** in the embedded browser.
2. Enter your email in Forkday and click **Fill Account Form**.
3. Review the filled form. Forkday chooses **Apply Manually** and **Sign in with email** when those choices appear, then fills email and a generated password (plus verification on Create Account).

Forkday never checks consent or submits the form. It reports the detected page
and verified fields; unsupported or incomplete screens return `unknown`.
The 20-character password stays in main-process memory and the browser fields;
it is not saved, logged, or returned to the renderer. Each click generates a
new password. On a Sign In screen this fills a new generated password, not an
existing account password.

Playwright connects to the embedded browser over Chromium's ephemeral loopback
DevTools port, enabled at app startup. The remote page still has no Forkday
preload API. Filling is limited to HTTPS `*.myworkdayjobs.com` pages.

Fixture tests use Chromium: install it with
`pnpm -C apps/desktop exec playwright install chromium` if needed.
Run `pnpm -C apps/desktop test:account` for the renderer/IPC/browser integration check.

## Limitations

- Invocation history is in memory and resets when the app exits.
- Authentication uses the device flow; the renderer only receives launch instructions, not credentials.
- Process-tree cleanup uses POSIX process groups on macOS/Linux and direct child termination on Windows.
- This is a development shell, not a packaged installer.

## Future scope

- Claude Code provider
- Chrome extension handoff to the desktop app
- durable application workflow
