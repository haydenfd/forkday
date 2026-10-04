// Adds an "Apply with Forkday" card to Workday job postings and follows the
// application's progress in the desktop app. Reads only the job's URL, title
// and company; nothing else on the page leaves the browser.
const api = globalThis.browser ?? globalThis.chrome;
const HOST_ID = 'forkday-apply-card';
const ACTIVE = ['queued', 'opening', 'signing_in', 'filling'];
const POLL_MS = 2500;

let host;
let shadow;
let jobUrl;
let timer;
const dismissed = new Set();

const logo = `<svg viewBox="0 0 100 100" aria-hidden="true"><clipPath id="t"><rect width="100" height="100" rx="23"/></clipPath><rect width="100" height="100" rx="23" fill="#2fa866"/><g clip-path="url(#t)" fill="#fff"><g transform="translate(56 56) rotate(-45) scale(0.86)"><rect x="-21" y="-44" width="10" height="29" rx="5"/><rect x="-5" y="-44" width="10" height="29" rx="5"/><rect x="11" y="-44" width="10" height="29" rx="5"/><path d="M-21 -20H21V-12C21 -1 10.5 1 8.5 11H-8.5C-10.5 1 -21 -1 -21 -12Z"/><rect x="-8.5" y="2" width="17" height="90" rx="8.5"/></g></g></svg>`;

const styles = `
  :host { all: initial; position: fixed; right: 20px; bottom: 20px; z-index: 2147483647; }
  aside {
    box-sizing: border-box; width: 300px; padding: 16px; border-radius: 14px;
    border: 1px solid #383e44; background: #202326; color: #e8eaed;
    font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 16px 48px rgb(0 0 0 / 35%);
    animation: enter 250ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  @keyframes enter { from { opacity: 0; transform: translateY(8px) scale(0.98); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  header { display: flex; align-items: center; gap: 10px; }
  header svg { width: 28px; height: 28px; flex: none; }
  header strong { flex: 1; font-size: 14px; font-weight: 600; }
  .close { all: unset; cursor: pointer; color: #a5abb3; padding: 4px; border-radius: 6px; line-height: 0; }
  .close:hover { color: #e8eaed; background: #2a2e32; }
  .job { margin: 10px 0 0; color: #a5abb3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  [hidden] { display: none !important; }
  .status { display: flex; gap: 8px; align-items: flex-start; margin-top: 12px; padding: 10px 12px; border-radius: 10px; background: #2a2e32; }
  .status[data-tone="good"] { background: #16382e; color: #6ee7b7; }
  .status[data-tone="warn"] { background: #3a2d15; color: #fbbf24; }
  .status[data-tone="bad"] { background: #421f29; color: #fb7185; }
  .spinner { flex: none; width: 14px; height: 14px; margin-top: 2px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: spin 0.8s linear infinite; }
  .actions { display: flex; gap: 8px; margin-top: 12px; }
  button.primary, button.secondary {
    all: unset; box-sizing: border-box; flex: 1; text-align: center; cursor: pointer;
    padding: 8px 12px; border-radius: 8px; font-weight: 600; font-size: 13px;
    transition: background-color 150ms ease-out, opacity 150ms ease-out;
  }
  button.primary { background: #70dda0; color: #102218; }
  button.primary:hover { background: #86efac; }
  button.secondary { border: 1px solid #69737d; color: #e8eaed; }
  button.secondary:hover { background: #2a2e32; }
  button:disabled { opacity: 0.5; cursor: default; }
  button:focus-visible { outline: 2px solid #70dda0; outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { aside, .spinner { animation: none; } }
`;

function postingUrl() {
  // One key per posting: drop tracking queries and the /apply sub-path.
  const url = new URL(location.href);
  return `${url.origin}${url.pathname.replace(/\/apply(\/.*)?$/, '')}`;
}

function isPosting() {
  return (
    Boolean(
      document.querySelector('[data-automation-id="jobPostingHeader"]'),
    ) || /\/job\//.test(location.pathname)
  );
}

function jobDetails() {
  const title =
    document
      .querySelector('[data-automation-id="jobPostingHeader"]')
      ?.textContent?.trim() || document.title.trim();
  const careers = document
    .querySelector('h1')
    ?.textContent?.trim()
    .match(/^Careers at (.+)$/i)?.[1];
  const tenant = location.hostname.split('.')[0];
  const company = careers || tenant.charAt(0).toUpperCase() + tenant.slice(1);
  return { url: postingUrl(), title: title.slice(0, 500), company };
}

const send = (type, body) =>
  api.runtime.sendMessage({ type, body }).catch(() => ({
    state: 'offline',
    message: 'Reload this page to reconnect the Forkday extension.',
  }));

const skeleton = `<style>${styles}</style>
  <aside aria-label="Forkday" role="status" aria-live="polite">
    <header>${logo}<strong></strong>
      <button class="close" type="button" aria-label="Hide Forkday for this job">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </header>
    <p class="job"></p>
    <div class="status"><span class="spinner" aria-hidden="true"></span><span class="message"></span></div>
    <div class="actions">
      <button class="primary apply" type="button"></button>
      <button class="open" type="button">Open Forkday</button>
    </div>
  </aside>`;

// Built once per card so polling updates text in place instead of replaying the entrance.
function mount() {
  host = document.createElement('div');
  host.id = HOST_ID;
  shadow = host.attachShadow({ mode: 'closed' });
  const parsed = new DOMParser().parseFromString(skeleton, 'text/html');
  shadow.append(...parsed.head.childNodes, ...parsed.body.childNodes);
  shadow.querySelector('.close').addEventListener('click', () => {
    dismissed.add(jobUrl);
    hide();
  });
  shadow
    .querySelector('.open')
    .addEventListener('click', () => void send('focus'));
  const apply = shadow.querySelector('.apply');
  apply.addEventListener('click', async () => {
    apply.disabled = true;
    apply.textContent = 'Sending…';
    update(await send('apply', jobDetails()));
  });
  document.documentElement.append(host);
}

function render(reply) {
  if (!host) mount();
  const state = reply?.state ?? 'none';
  const working = ACTIVE.includes(state);
  const canApply = [
    'none',
    'offline',
    'error',
    'waiting',
    'stopped',
    'rejected',
  ].includes(state);
  const details = jobDetails();
  // Page-derived text only ever goes in through textContent.
  shadow.querySelector('strong').textContent =
    state === 'review'
      ? 'Ready for your review'
      : state === 'attention'
        ? 'Forkday needs you'
        : state === 'completed'
          ? 'Applied'
          : working
            ? 'Applying in Forkday'
            : 'Forkday';
  shadow.querySelector('.job').textContent =
    `${details.title} · ${details.company}`;

  const status = shadow.querySelector('.status');
  status.hidden = !reply?.message;
  status.dataset.tone =
    state === 'review' || state === 'completed'
      ? 'good'
      : state === 'attention' || state === 'offline'
        ? 'warn'
        : state === 'error'
          ? 'bad'
          : '';
  shadow.querySelector('.spinner').hidden = !working;
  shadow.querySelector('.message').textContent = reply?.message ?? '';

  const apply = shadow.querySelector('.apply');
  apply.hidden = !canApply;
  apply.disabled = false;
  apply.textContent =
    state === 'offline' || state === 'error'
      ? 'Try again'
      : 'Apply with Forkday';
  const open = shadow.querySelector('.open');
  open.hidden = state === 'none' || state === 'offline';
  open.className = `${canApply ? 'secondary' : 'primary'} open`;
}

function hide() {
  clearTimeout(timer);
  host?.remove();
  host = undefined;
}

function update(reply) {
  clearTimeout(timer);
  if (dismissed.has(jobUrl)) return hide();
  render(reply);
  if ([...ACTIVE, 'review', 'attention'].includes(reply?.state))
    timer = setTimeout(refresh, POLL_MS);
}

async function refresh() {
  const url = jobUrl;
  const reply = await send('status', { url });
  if (url !== jobUrl) return;
  // Desktop offline before the user asked for anything: offer Apply, no warning.
  update(reply?.state === 'offline' ? { state: 'none' } : reply);
}

// Workday is a single-page app: re-check whenever the URL changes.
function onLocation() {
  if (!isPosting()) {
    jobUrl = undefined;
    return hide();
  }
  const url = postingUrl();
  if (url === jobUrl) return;
  jobUrl = url;
  void refresh();
}

if (!document.getElementById(HOST_ID)) {
  onLocation();
  setInterval(onLocation, 800);
}
