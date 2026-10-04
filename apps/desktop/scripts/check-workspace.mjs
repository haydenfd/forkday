import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  writeFile,
  rm,
  mkdir,
  chmod,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { _electron } from 'playwright';

const require = createRequire(import.meta.url);
const root = await mkdtemp('/tmp/forkday-workspace-');
const userData = path.join(root, 'data');
const source = path.join(root, 'candidate.pdf');
const fakeCodex = path.join(root, 'codex');
const captures = process.env.FORKDAY_UI_SCREENSHOTS;
const pdf = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF',
);
await writeFile(source, pdf);
await writeFile(
  fakeCodex,
  `#!/bin/sh
if [ "$1" = "--version" ]; then echo 'codex-cli fixture'; exit 0; fi
if [ "$1" = "login" ]; then echo 'Logged in using ChatGPT'; exit 0; fi
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--output-last-message" ]; then shift; printf '%s' '{"status":"ok","message":"Forkday provider test successful"}' > "$1"; exit 0; fi
  shift
done
exit 1
`,
);
await chmod(fakeCodex, 0o700);
let app;
let page;
const launch = async () => {
  app = await _electron.launch({
    executablePath: require('electron'),
    args: [
      fileURLToPath(new URL('../out/main/index.js', import.meta.url)),
      `--user-data-dir=${userData}`,
    ],
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: '',
      FORKDAY_CODEX_PATH: fakeCodex,
    },
    timeout: 15000,
  });
  page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  await page.getByRole('heading', { name: 'Tasks', exact: true }).waitFor();
  await app.evaluate(({ Notification }) => {
    globalThis.forkdayNotifications = [];
    globalThis.forkdayNotificationObjects = [];
    Notification.isSupported = () => true;
    Notification.prototype.show = function () {
      globalThis.forkdayNotifications.push({
        title: this.title,
        body: this.body,
      });
      globalThis.forkdayNotificationObjects.push(this);
    };
  });
  page.on('pageerror', (error) => {
    throw error;
  });
};
const navigate = (name) =>
  page.getByRole('link', { name, exact: true }).click();
const choose = async (label, option) => {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
};
const save = async () => {
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page
    .getByRole('status')
    .filter({ hasText: /^Saved$/ })
    .waitFor({ timeout: 5000 });
};
const browserViews = () =>
  app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return win.contentView.children.filter(
      (view) => view.webContents && view.webContents !== win.webContents,
    ).length;
  });
const capture = async (name) => {
  if (!captures) return;
  await mkdir(captures, { recursive: true });
  await page.screenshot({ path: path.join(captures, `${name}.png`) });
};
try {
  await launch();
  await navigate('Settings');
  assert.equal(
    await page.getByText('Your application toolkit', { exact: true }).count(),
    0,
  );
  await navigate('Resume');
  await page
    .getByLabel('Resume text', { exact: true })
    .fill('Saved before contact information');
  await save();
  await page.locator('a[href="#/settings/profile"]').click();
  for (const [label, value] of Object.entries({
    'First name *': 'Ada',
    'Last name *': 'Lovelace',
    'Email *': 'candidate@example.com',
    'Address line 1 *': '1 Example Street',
    'City *': 'Example City',
    'Postal code *': '20001',
    'Phone Number *': '2025550123',
  }))
    await page.getByLabel(label, { exact: true }).fill(value);
  await choose('State', 'District of Columbia (DC)');
  await save();
  await capture('profile');
  await navigate('Resume');
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, source);
  await page.getByRole('button', { name: 'Upload PDF', exact: true }).click();
  await page
    .getByRole('heading', { name: 'candidate.pdf', exact: true })
    .waitFor();
  await page
    .getByLabel('Resume text', { exact: true })
    .fill('Ada Lovelace\nSoftware engineer\nBuilt useful things.');
  await page.getByLabel('Skills', { exact: true }).fill('TypeScript, writing');
  await page.getByRole('button', { name: 'Add role', exact: true }).click();
  await page.getByLabel('Job title', { exact: true }).fill('Engineer');
  await page.getByLabel('Company', { exact: true }).fill('Example');
  await page.getByLabel('Start date', { exact: true }).fill('2023-01');
  await page.getByLabel('I currently work here', { exact: true }).check();
  assert.equal(
    await page.getByLabel('End date', { exact: true }).isDisabled(),
    true,
  );
  await page
    .getByRole('button', { name: 'Add education', exact: true })
    .click();
  await page
    .getByLabel('School / university', { exact: true })
    .fill('Example University');
  await page.getByLabel('Degree', { exact: true }).fill('BS');
  await navigate('Codex');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Test Codex', exact: true }).click();
  await page
    .getByRole('status')
    .filter({ hasText: 'Forkday provider test successful' })
    .waitFor();
  assert.equal(
    await page.getByText('Recent calls', { exact: true }).count(),
    0,
  );
  await capture('codex');
  await page.getByRole('button', { name: 'Check again', exact: true }).click();
  await page
    .getByRole('button', { name: 'Check again', exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByText('Forkday provider test successful', { exact: true })
      .count(),
    0,
  );
  await navigate('Resume');
  assert.match(
    await page.getByLabel('Resume text', { exact: true }).inputValue(),
    /Ada Lovelace/,
  );
  assert.equal(
    await page.getByRole('button', { name: 'Save', exact: true }).isDisabled(),
    true,
  );
  await page
    .getByRole('button', { name: 'Replace PDF', exact: true })
    .scrollIntoViewIfNeeded();
  await capture('resume');
  const resume = await page.evaluate(() => window.forkday.getResume());
  const copied = path.join(userData, 'resume', `${resume.id}.pdf`);
  await rm(source);
  assert.deepEqual(await readFile(copied), pdf);
  await app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
  });
  await page.getByRole('button', { name: 'Replace PDF', exact: true }).click();
  assert.deepEqual(
    await page.evaluate(() => window.forkday.getResume()),
    resume,
  );

  await navigate('Application answers');
  assert.equal(
    await page
      .getByLabel('Country these answers apply to', { exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page.locator('select:not([aria-hidden="true"])').count(),
    0,
  );
  const authorization = page.getByRole('combobox', {
    name: 'Authorized to work in the US?',
    exact: true,
  });
  await authorization.click();
  await capture('dropdown');
  assert.equal(
    await page
      .getByRole('listbox')
      .evaluate((element) => getComputedStyle(element).animationName),
    'select-open',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(
    await page
      .getByRole('listbox')
      .evaluate((element) => getComputedStyle(element).animationName),
    'none',
  );
  assert.equal(
    await page
      .locator('#profile-authorizedToWork .select-chevron')
      .evaluate(
        (element) => new DOMMatrix(getComputedStyle(element).transform).a,
      ),
    -1,
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.keyboard.press('Escape');
  assert.equal(await authorization.getAttribute('aria-expanded'), 'false');
  for (const label of [
    'Authorized to work in the US?',
    'Need employer sponsorship now?',
    'Need employer sponsorship in the future?',
  ])
    assert.equal(
      (await page.getByLabel(label, { exact: true }).innerText()).trim(),
      'Not set',
    );
  await authorization.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => document.activeElement?.getAttribute('role') === 'option',
  );
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(
    () => document.activeElement?.textContent?.trim() === 'Yes',
  );
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () =>
      document
        .querySelector('#profile-authorizedToWork')
        ?.textContent?.trim() === 'Yes',
  );
  assert.equal(await authorization.innerText(), 'Yes');
  await choose('Need employer sponsorship now?', 'No');
  await choose('Need employer sponsorship in the future?', 'Yes');
  await page
    .getByLabel('Residency / visa status', { exact: true })
    .fill('Example visa status');
  await save();
  await capture('answers');
  await navigate('Disclosures');
  assert.equal(
    await page
      .getByLabel('US disability self-identification', { exact: true })
      .innerText(),
    'Not set',
  );
  await choose('US disability self-identification', 'Prefer not to answer');
  await save();

  // Unsaved changes survive tabs and can block navigation away from settings.
  await page.getByLabel('Gender', { exact: true }).fill('Prefer not to answer');
  await navigate('Job queue');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Keep editing', exact: true })
    .click();
  await page.waitForFunction(() => location.hash === '#/settings/disclosures');
  assert.equal(
    await page
      .getByRole('heading', { name: 'Settings', exact: true })
      .isVisible(),
    true,
  );
  await save();
  // Cancelling navigation leaves a duplicate history entry; establish a distinct Back target.
  await navigate('Application answers');
  await navigate('Disclosures');
  await page.getByLabel('Gender', { exact: true }).fill('Unsaved response');
  await page.evaluate(() => history.back());
  await page.getByRole('dialog').waitFor();
  assert.equal(
    await page
      .getByRole('dialog')
      .evaluate((element) => element.contains(document.activeElement)),
    true,
  );
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Discard', exact: true })
    .click();
  await page.waitForFunction(() => location.hash === '#/settings/answers');
  await navigate('Disclosures');
  assert.equal(
    await page.getByLabel('Gender', { exact: true }).inputValue(),
    'Prefer not to answer',
  );
  await navigate('Job queue');
  for (const [title, url] of [
    ['Engineer', 'https://example.com/job-one'],
    ['Designer', 'https://example.com/job-two'],
  ]) {
    await page.getByLabel('Job URL *', { exact: true }).fill(url);
    await page.getByLabel('Job title', { exact: true }).fill(title);
    await page.getByLabel('Company', { exact: true }).fill('Example');
    await page.getByRole('button', { name: 'Add job', exact: true }).click();
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
  }
  assert.equal(await browserViews(), 0);
  await choose('Status for Engineer', 'Continuing');
  await page
    .getByRole('heading', { name: 'Continuing', exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'View details', exact: true }).click();
  await page
    .getByLabel('Application notes', { exact: true })
    .fill('Follow up Tuesday');
  const backConfirmation = page.waitForEvent('dialog');
  await page.evaluate(() => history.back());
  await (await backConfirmation).dismiss();
  await page.waitForFunction(() => location.hash === '#/queue');
  assert.equal(
    await page.getByLabel('Application notes', { exact: true }).inputValue(),
    'Follow up Tuesday',
  );
  await page.getByRole('button', { name: 'Save notes', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Notes saved.' }).waitFor();
  await capture('queue');
  await choose('Status for Engineer', 'Rejected');
  await page.getByRole('heading', { name: 'Rejected', exact: true }).waitFor();
  let applications = await page.evaluate(() =>
    window.forkday.listApplications(),
  );
  assert.equal(
    applications.find((item) => item.title === 'Engineer').status,
    'rejected',
  );
  assert.equal(
    applications.find((item) => item.title === 'Engineer').notes,
    'Follow up Tuesday',
  );
  assert.equal(
    applications.find((item) => item.title === 'Designer').status,
    'waiting',
  );
  assert.equal(await browserViews(), 0);
  await navigate('Tasks');
  await page.getByRole('heading', { name: 'Designer', exact: true }).waitFor();
  assert.equal(
    await page.getByText('1 waiting', { exact: true }).isVisible(),
    true,
  );
  await navigate('Job queue');
  await page.getByRole('button', { name: /Waiting/ }).click();
  await choose('Status for Designer', 'Continuing');
  await choose('Status for Designer', 'Stopped');
  await choose('Status for Designer', 'Continuing');
  await choose('Status for Designer', 'Completed');
  applications = await page.evaluate(() => window.forkday.listApplications());
  const notificationMessages = await app.evaluate(
    () => globalThis.forkdayNotifications,
  );
  assert.equal(
    notificationMessages.some((item) => item.title === 'Task waiting'),
    true,
  );
  assert.equal(
    notificationMessages.some((item) => item.title === 'Task stopped'),
    true,
  );
  assert.equal(
    notificationMessages.some((item) => item.title === 'Forkday is idle'),
    true,
  );
  await navigate('Tasks');
  await page.getByRole('heading', { name: 'Tasks', exact: true }).waitFor();
  await page.getByText(/Follow up Tuesday/).waitFor();
  await capture('tasks');
  await page.getByRole('link', { name: 'See all', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Past processed', exact: true })
    .waitFor();
  await navigate('Tasks');
  await page.getByRole('link', { name: 'View Engineer', exact: true }).click();
  await page.getByLabel('Application notes', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('Application notes', { exact: true }).inputValue(),
    'Follow up Tuesday',
  );
  await navigate('Status');
  await page.getByRole('button', { name: 'Refresh', exact: true }).waitFor();
  // The extension card is ready unless another Forkday already holds the port.
  const { listening } = await page.evaluate(() =>
    window.forkday.getBridgeStatus(),
  );
  assert.equal(
    await page.getByText('Ready', { exact: true }).count(),
    listening ? 5 : 4,
  );
  await capture('status');
  await app.evaluate(() => {
    globalThis.forkdayNotificationObjects.at(-1).emit('click');
  });
  await page.getByRole('heading', { name: 'Tasks', exact: true }).waitFor();
  const savedProfile = await page.evaluate(() => window.forkday.getProfile());
  assert.equal(savedProfile.workExperience[0].jobTitle, 'Engineer');
  assert.equal(savedProfile.education[0].school, 'Example University');
  assert.equal(savedProfile.disability, 'Prefer not to answer');
  await app.close();
  app = undefined;
  await launch();
  assert.deepEqual(
    await page.evaluate(() => window.forkday.getProfile()),
    savedProfile,
  );
  assert.deepEqual(
    await page.evaluate(() => window.forkday.getResume()),
    resume,
  );
  assert.deepEqual(
    await page.evaluate(() => window.forkday.listApplications()),
    applications,
  );
  await navigate('Settings');
  await navigate('Resume');
  await page
    .getByRole('heading', { name: 'candidate.pdf', exact: true })
    .waitFor();
  assert.match(
    await page.getByLabel('Resume text', { exact: true }).inputValue(),
    /Ada Lovelace/,
  );
  assert.equal(
    await page.getByLabel('Job title', { exact: true }).inputValue(),
    'Engineer',
  );
  await navigate('Application answers');
  assert.equal(
    await page
      .getByLabel('Need employer sponsorship in the future?', { exact: true })
      .innerText(),
    'Yes',
  );
  console.log(
    'PASS: custom dropdowns; section-scoped saves and save/discard/keep-editing navigation; Tasks home and processed history; native notification event calls; seven settings sections; PDF upload/cancel and independent local copy; experience/education; explicit authorization/disclosure answers; Codex connection/test without invocation history; unsaved-navigation guard; waiting/continuing/rejected queue and notes; status readiness; persistence across a real Electron restart; no queue browser activity.',
  );
} catch (error) {
  console.error(error);
  await capture('failure');
  throw error;
} finally {
  await app?.close();
  await rm(root, { recursive: true, force: true });
}
