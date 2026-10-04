# Forkday

Forkday is a local Electron app plus a Firefox/Chrome extension. Click **Apply with Forkday** on a Workday job and the desktop app queues it, signs in, fills each application page from your profile, and stops for your review. Forkday never submits an application for you.

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

`pnpm dev` and `pnpm start` re-sign the downloaded dev `Electron.app` ad hoc when
needed (`scripts/sign-dev-electron.mjs`); macOS refuses notifications from it
otherwise. After that re-sign, macOS asks once for access to the
"Electron Safe Storage" keychain item: enter your login password and choose
**Always Allow**.

## Browser extension

`apps/extension` is one Manifest V3 extension for Firefox (140+) and Chrome.

- Firefox: open `about:debugging#/runtime/this-firefox`, click **Load Temporary
  Add-on…**, and choose `apps/extension/manifest.json`. Temporary add-ons are
  removed when Firefox quits; sign it as an unlisted add-on on
  addons.mozilla.org to keep it.
- Chrome: open `chrome://extensions`, turn on **Developer mode**, click **Load
  unpacked**, and choose `apps/extension`.

On a `*.myworkdayjobs.com` job posting, a card offers **Apply with Forkday** and
then shows live progress (in line, signing in, filling, ready for review, needs
you). It sends only the posting URL, title, and company. The background script
posts JSON to the desktop app on `127.0.0.1:47615`; the app refuses requests with
a web-page `Origin`, a non-loopback `Host`, or a non-JSON body, so websites cannot
queue jobs. **Settings → Extension** shows the connection and the folder to load.

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
Electron automatically. Profile details, resume files, and the application tracker survive restarts.

## Codex behavior

At startup, Forkday asks the user's login shell for its PATH. This handles GUI launches that do not inherit the interactive shell PATH. `FORKDAY_CODEX_PATH` can override the discovered binary later without changing the provider.

Health checks use `codex --version` and the documented `codex login status`. Forkday never reads credential files. If authentication is missing, **Authenticate** starts the normal `codex login --device-auth` flow and opens the URL emitted by Codex in the default browser. The login subprocess is terminated if Forkday exits.

**Test Codex** runs `codex exec` in read-only, ephemeral mode with a 60-second timeout. It ignores user configuration and rules so personal hooks, MCP servers, and project instructions do not affect this fixed health check; Codex authentication remains available. It uses the CLI's documented `--output-schema` and `--output-last-message` options, then validates the JSON again before sending it to the renderer. Temporary schema/output files are removed after each call.

The current CLI does not expose reliable account usage or rate-limit status programmatically. Forkday does not inspect private credential or state files to infer it.

## Browser proof of concept

The **Browser** page is split in two: paste a job URL on the left and it loads in
the embedded browser on the right, below the top bar. Until a page loads, the
right half shows a blank placeholder. The browser hides on **Tasks**, **Settings**, **Profile**, **Saved Credentials**, **Job queue**, and **Status** and
returns when you go back.

The home page is **Tasks**, with current work and the five most recently processed
applications. **See all** opens processed history in the queue; each task links to
its saved details. Queue records remain independent of browser opening and automation.

The browser uses Electron's `WebContentsView` and a separate persistent session
(`persist:forkday-jobs`) so logins survive closing and reopening the app. Main
validates HTTP/HTTPS URLs, rejects embedded credentials, and blocks unsafe
navigation. The remote page has no Node access or Forkday preload API. Links
that request a new window open in the same pane.

Applications started from the queue or extension are automated with Playwright
(see Applying with Forkday). The application tracker is saved locally and
survives closing the app.

Run `pnpm -C apps/desktop test:browser` to verify the split view, embedded
browser, navigation guards, resize, Settings hide/show, URL validation, and page
isolation in a real Electron window.

## Workday accounts

1. Save your email in **Profile**.
2. Open a Workday job URL and click **Apply** in the embedded browser.
3. Click **Create Account / Sign In**. Forkday chooses Apply Manually and email sign-in when needed, then creates an account on first use or signs in using previously saved credentials.

Creating an account fills both password fields, checks the account consent box,
and submits the account form. Sign In reuses the saved password. Forkday stops
at the next screen; review any validation errors or verification requests in
the browser.

The document icon at the top right opens **Saved Credentials**, showing company
and email in a searchable table with passwords hidden by default. Company names come from the careers heading
when available, with the Workday tenant name as a fallback. Click the eye icon on a row to reveal its password; click again to hide it.
Only an explicit reveal request returns that password to the renderer;
passwords are not logged or copied to the clipboard.

Credentials are saved before filling/submission in an encrypted `credentials.enc`
file under Electron's user-data directory. Electron `safeStorage` protects the
encryption key with macOS Keychain; credentials are matched by Workday host and
email and survive app restarts. If secure storage is unavailable or the file
cannot be decrypted, Forkday stops rather than saving plaintext or overwriting
it. The Profile file remains separate from encrypted account credentials.

Playwright connects to the embedded browser over Chromium's ephemeral loopback
DevTools port, enabled at app startup. The remote page has no Forkday preload
API. Filling is limited to HTTPS `*.myworkdayjobs.com` pages.

Fixture tests use Chromium: install it with
`pnpm -C apps/desktop exec playwright install chromium` if needed.
Run `pnpm -C apps/desktop test:account` to check encrypted persistence and account
creation/sign-in across an app restart using local Workday fixtures. This check
never submits to a live Workday site.

## Applying with Forkday

Start an application from the extension or with **Apply with Forkday** on a
Workday job in **Job queue**. Applications run one at a time in the embedded
browser:

1. Open the posting and click **Apply**.
2. Choose Apply Manually and sign in or create the account (see above).
3. Fill the visible page from your profile: name, address, phone, links,
   state/country/phone-type dropdowns, US authorization and sponsorship,
   relocation, salary, disclosures, and the resume PDF. Filled values are never
   overwritten; consent boxes, Next, and Submit are never touched.
4. Stop at **Ready for review**, listing required fields that still need you
   (for example "How did you hear about us?").

Review the page in **Browser**, use Workday's Save and Continue, then press
**Fill page** for the next step. **I submitted it** marks the application
Completed and starts the next job in line; **Stop** marks it Stopped. If Workday
needs you (email verification, an unknown page), the run shows **Needs you** and
**Continue** resumes from the current page. The run's progress is shown in the
top bar, on Tasks, in the queue, and in the extension card.

Fields are matched by Workday field wrappers and their labels
(`src/main/workday/applicationForm.ts`). Employer-specific questions are left for
you. Run state lives in memory; quitting Forkday ends runs but keeps the queue.

## Settings and local data

Settings has seven sections: **Profile**, **Resume**, **Application answers**,
**Disclosures**, **Extension**, **Notifications**, and **Codex**. The Profile shortcut opens the same editor. Each
editable section has its own top-right **Save**. Leaving an unsaved section offers
**Save changes**, **Discard**, or **Keep editing**, including Back navigation.

Profile keeps the required contact and address fields, fixed US calling code,
and mobile phone behavior. Optional fields include preferred name, address line
2, and links. The app is scoped to US residents applying in the US; country
metadata is fixed internally. Save validates the current section and merges it into `profile.json` atomically
in Electron's user-data directory. Older partial profiles remain readable;
invalid files are preserved and reported. Resume content, application answers,
and disclosures can be saved before completing contact information.

Resume supports one PDF up to 10 MB. **Upload PDF** copies the file into a local
`resume/` folder and saves it immediately. **Replace PDF** changes the local copy;
**Open PDF** opens it with the system PDF viewer. Moving or deleting the original
file does not affect the saved copy. Editable resume text, skills, work history,
and education are saved with the profile. PDF upload does not parse text.

Application answers include US authorization and sponsorship, residency/visa
status, availability, relocation, and optional salary preferences. All start
unset. Disclosures are separate and include an
explicit choice not to answer. [Field selection and research](docs/application-profile.md)
describe the scope and primary sources.

**Job queue** saves title, company, URL, notes, and **Waiting / Continuing /
Completed / Rejected / Stopped** status in `applications.json`. Statuses are updated manually. Adding a
job does not open a browser. **Status** shows setup readiness and application
counts; it does not show invocation history. Codex connection, authentication,
and testing are available in the dedicated Codex settings section. System
notifications announce jobs queued from the extension, applications ready for
review or needing you, and queue status changes including idle; clicking one
opens the relevant page. **Settings → Notifications** sends a test notification
and opens the system settings. On macOS, notifications require a sealed app
bundle: the stock dev `Electron.app` fails with `UNErrorDomain error 1` until the
dev scripts re-sign it (delivery verified after re-signing). If delivery fails,
Forkday shows an in-app notice instead.

Profile data, PDFs, and the application tracker are local plaintext. Account
passwords remain separate in encrypted storage. New data files have owner-only
permissions on POSIX systems. Corrupt files and failed writes preserve the last
saved data. Source examples use fictional data; keep real data and captures
outside the repository.

Run `pnpm -C apps/desktop test:workspace` to check the settings sections, PDF
copying, section saves and navigation prompts, custom dropdowns, Tasks/history,
structured profile, Codex controls, queue transitions/notes, status, and
persistence across a real Electron restart. It uses a temporary local profile and
a fixture Codex CLI; it does not call an AI service or submit any application.

## Limitations

- Invocation history is in memory and resets when the app exits.
- Authentication uses the device flow; the renderer only receives launch instructions, not credentials.
- Process-tree cleanup uses POSIX process groups on macOS/Linux and direct child termination on Windows.
- This is a development shell, not a packaged installer.

## Future scope

- Claude Code provider
- Codex answers for employer-specific questions
- structured work-history entry on My Experience pages
