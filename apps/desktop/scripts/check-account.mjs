import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { _electron, chromium } from 'playwright';

const require = createRequire(import.meta.url);
const profile = await mkdtemp('/tmp/forkday-account-');
const live = process.argv.includes('--live');
const fixtures = {};
for (const kind of ['sign_in_options', 'create_account', 'sign_in'])
  fixtures[kind] = await readFile(
    new URL(`../tests/fixtures/workday/${kind}.html`, import.meta.url),
    'utf8',
  );
let app;
try {
  app = await _electron.launch({
    executablePath: require('electron'),
    args: [
      fileURLToPath(new URL('../out/main/index.js', import.meta.url)),
      `--user-data-dir=${profile}`,
    ],
    env: { ...process.env, ELECTRON_RENDERER_URL: '' },
    timeout: 15000,
  });
  const shell = await app.firstWindow();
  const open = async (url) => {
    await shell.getByLabel('Job URL').fill(url);
    await shell
      .getByRole('button', { name: 'Open', exact: true })
      .click({ timeout: 5000 });
    await shell
      .getByRole('button', { name: 'Fill Account Form', exact: true })
      .waitFor({ timeout: 10000 });
    await shell
      .getByLabel('Email', { exact: true })
      .fill('candidate@example.com');
  };
  const check = async (kind) => {
    await shell
      .getByRole('button', { name: 'Fill Account Form', exact: true })
      .click({ timeout: 10000 });
    const expected = `Page: ${kind}. Filled: email, password${kind === 'create_account' ? ', verify_password' : ''}.`;
    await shell
      .getByRole('status')
      .filter({ hasText: expected })
      .waitFor({ timeout: 30000 });
    assert.equal(await shell.getByRole('status').innerText(), expected);
    const state = await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const view = win.contentView.children.find(
        (v) => v.webContents && v.webContents !== win.webContents,
      );
      return view.webContents.executeJavaScript(
        `({ email: document.querySelector('[data-automation-id=email]').value, length: document.querySelector('[data-automation-id=password]').value.length, equal: !document.querySelector('[data-automation-id=verifyPassword]') || document.querySelector('[data-automation-id=password]').value === document.querySelector('[data-automation-id=verifyPassword]').value, checked: document.querySelector('[type=checkbox]')?.checked ?? false, submitted: document.body.dataset.submitted ?? 'no' })`,
      );
    });
    assert.deepEqual(state, {
      email: 'candidate@example.com',
      length: 20,
      equal: true,
      checked: false,
      submitted: 'no',
    });
  };
  if (live) {
    const url =
      'https://workday.wd5.myworkdayjobs.com/en-US/Workday/job/USA-IL-Chicago/Principal---Senior-Partner-Solution-Architect--Workday-Wellness_JR-0109178';
    await open(url);
    const [port, endpoint] = (
      await readFile(`${profile}/DevToolsActivePort`, 'utf8')
    )
      .trim()
      .split('\n');
    const connection = await chromium.connectOverCDP(
      `ws://127.0.0.1:${port}${endpoint}`,
      { timeout: 5000 },
    );
    const embedded = connection
      .contexts()
      .flatMap((context) => context.pages())
      .find(
        (page) => page !== shell && page.url().includes('myworkdayjobs.com'),
      );
    assert.ok(embedded);
    // Simulate the user's manual Apply; the product never clicks this button.
    await embedded
      .locator('[data-automation-id=adventureButton]')
      .click({ timeout: 30000 });
    await embedded
      .locator('[data-automation-id=applyManually]')
      .waitFor({ timeout: 10000 });
    await check('sign_in');
    // Manually switch to Create Account to verify all three React-controlled fields.
    await embedded
      .locator('[data-automation-id=createAccountLink]')
      .click({ timeout: 5000 });
    await embedded
      .locator('[data-automation-id=verifyPassword]')
      .waitFor({ timeout: 5000 });
    await check('create_account');
    console.log(
      'PASS: live Workday Apply Manually → email sign-in → two verified fields; Create Account → three verified fields. No consent or submission.',
    );
  } else {
    let html = fixtures.create_account;
    await app
      .context()
      .route('https://fixture.myworkdayjobs.com/**', (route) =>
        route.fulfill({ contentType: 'text/html', body: html }),
      );
    for (const kind of [
      'create_account',
      'sign_in',
      'sign_in_options',
      'apply_manually',
    ]) {
      html =
        kind === 'apply_manually'
          ? '<a data-automation-id="applyManually" href="#">Apply Manually</a>'
          : fixtures[kind];
      if (kind === 'sign_in_options' || kind === 'apply_manually') {
        const id =
          kind === 'apply_manually' ? 'applyManually' : 'SignInWithEmailButton';
        html += `<script>document.querySelector('[data-automation-id=${id}]').addEventListener('click', e => {e.preventDefault();document.body.innerHTML=${JSON.stringify(fixtures.create_account)};});</script>`;
      }
      html +=
        '<script>document.addEventListener("submit",e=>{e.preventDefault();document.body.dataset.submitted="yes";});</script>';
      await open(`https://fixture.myworkdayjobs.com/${kind}`);
      await check(kind === 'sign_in' ? 'sign_in' : 'create_account');
    }
    for (const invalid of ['', 123, 'invalid', 'x'.repeat(255)]) {
      assert.equal(
        await shell.evaluate(async (email) => {
          try {
            await window.forkday.fillAccountForm(email);
            return false;
          } catch {
            return true;
          }
        }, invalid),
        true,
      );
    }
    assert.deepEqual(
      await shell.evaluate(() =>
        window.forkday.fillAccountForm('candidate@example.com'),
      ),
      {
        page: 'create_account',
        filled: ['email', 'password', 'verify_password'],
      },
    );
    console.log(
      'PASS: renderer → guarded IPC → current WebContentsView → Playwright; all account routes, invalid email rejection, password kept out of result, no consent or submission.',
    );
  }
} finally {
  await app?.close();
  await rm(profile, { recursive: true, force: true });
}
