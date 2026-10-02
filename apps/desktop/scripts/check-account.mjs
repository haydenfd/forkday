import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { _electron } from 'playwright';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const profile = await mkdtemp('/tmp/forkday-account-');
const fixtures = {};
for (const kind of ['sign_in_options', 'create_account', 'sign_in'])
  fixtures[kind] = await readFile(
    new URL(`../tests/fixtures/workday/${kind}.html`, import.meta.url),
    'utf8',
  );
let app;
let shell;
let html;
const launch = async () => {
  app = await _electron.launch({
    executablePath: require('electron'),
    args: [
      fileURLToPath(new URL('../out/main/index.js', import.meta.url)),
      `--user-data-dir=${profile}`,
    ],
    env: { ...process.env, ELECTRON_RENDERER_URL: '' },
    timeout: 15000,
  });
  shell = await app.firstWindow();
  await shell.getByRole('link', { name: 'Browser', exact: true }).click();
  await app.evaluate(({ BrowserWindow }) => {
    for (const window of BrowserWindow.getAllWindows()) window.hide();
  });
  await app
    .context()
    .route('https://*.myworkdayjobs.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: html }),
    );
};
const form = (kind) => {
  const initial =
    kind === 'apply_manually'
      ? '<a data-automation-id="applyManually" href="#">Apply Manually</a>'
      : fixtures[kind];
  return `${initial}<script>
    const style = document.createElement('style');
    style.textContent = '[data-automation-id=click_filter]{width:100px;height:40px}';
    document.head.appendChild(style);
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.matches('[data-automation-id=click_filter]')) {
        e.preventDefault(); e.target.click();
      }
    });
    document.addEventListener('click', async e => {
      if (e.target.closest('[data-automation-id=applyManually]')) {
        e.preventDefault(); document.body.innerHTML = ${JSON.stringify(fixtures.sign_in_options)}; return;
      }
      if (e.target.closest('[data-automation-id=SignInWithEmailButton], [data-automation-id=signInLink]')) {
        e.preventDefault(); document.body.innerHTML = ${JSON.stringify(fixtures.sign_in)}; return;
      }
      if (e.target.closest('[data-automation-id=createAccountLink]')) {
        e.preventDefault(); document.body.innerHTML = ${JSON.stringify(fixtures.create_account)}; return;
      }
      if (!e.target.closest('[data-automation-id=click_filter]')) return;
      const email = document.querySelector('[data-automation-id=email]').value;
      const password = document.querySelector('[data-automation-id=password]').value;
      const verify = document.querySelector('[data-automation-id=verifyPassword]');
      const checkbox = document.querySelector('[type=checkbox]');
      window.submittedState = {email, length:password.length, equal: !verify || verify.value === password, checked: checkbox?.checked ?? false,
        fingerprint: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)))).join(',')};
      document.body.innerHTML = '<h1>My Information</h1>';
    });
    document.addEventListener('submit',e => e.preventDefault());
  </script>`;
};
const open = async (host, kind) => {
  html = form(kind);
  await shell
    .getByLabel('Job URL')
    .fill(`https://${host}.myworkdayjobs.com/job`);
  await shell
    .getByRole('button', { name: 'Open', exact: true })
    .click({ timeout: 5000 });
  await shell
    .getByRole('button', { name: 'Create Account / Sign In', exact: true })
    .waitFor({ timeout: 10000 });
};
const check = async (kind, expectedEmail = 'candidate@example.com') => {
  await shell
    .getByRole('button', { name: 'Create Account / Sign In', exact: true })
    .click({ timeout: 10000 });
  await shell
    .getByRole('status')
    .filter({ hasText: 'Account form submitted' })
    .waitFor({ timeout: 30000 });
  assert.match(
    await shell.getByRole('status').innerText(),
    new RegExp(`Page: ${kind}`),
  );
  const state = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    const view = win.contentView.children.find(
      (v) => v.webContents && v.webContents !== win.webContents,
    );
    return view.webContents.executeJavaScript('window.submittedState');
  });
  assert.equal(state.email, expectedEmail);
  assert.equal(state.length, 20);
  assert.equal(state.equal, true);
  assert.equal(state.checked, kind === 'create_account');
  return state.fingerprint;
};
try {
  await launch();
  assert.match(
    await shell.evaluate(async () => {
      try {
        await window.forkday.fillAccountForm();
        return '';
      } catch (error) {
        return error.message;
      }
    }),
    /Add your email in Profile\./,
  );
  await shell.getByRole('link', { name: 'Profile', exact: true }).click();
  await shell
    .getByLabel('Email *', { exact: true })
    .fill('candidate@example.com');
  await shell.getByRole('group', { name: 'Phone', exact: true }).waitFor();
  await shell.getByRole('button', { name: 'Save', exact: true }).click();
  assert.equal(
    await shell
      .getByLabel('First name *', { exact: true })
      .evaluate((input) => input.validity.valueMissing),
    true,
  );
  for (const [label, value] of Object.entries({
    'First name': 'Ada',
    'Last name': 'Lovelace',
    'Address line 1': '1 Main St',
    City: 'Example City',
    State: 'DC',
    'Postal code': '20001',
  }))
    await shell.getByLabel(`${label} *`, { exact: true }).fill(value);
  assert.equal(
    await shell.getByLabel('Phone Device Type', { exact: true }).count(),
    0,
  );
  assert.equal(
    await shell.getByLabel('Phone Extension', { exact: true }).count(),
    0,
  );
  assert.equal(
    await shell
      .getByLabel('Country / Territory Phone Code *', { exact: true })
      .count(),
    0,
  );
  await shell.getByLabel('Phone Number *', { exact: true }).fill('2025550123');
  assert.equal(
    await shell.getByLabel('Phone Number *', { exact: true }).inputValue(),
    '2025550123',
  );
  assert.deepEqual(
    await shell.locator('form input').evaluateAll((inputs) =>
      inputs
        .filter((input) => !input.validity.valid)
        .map((input) => ({
          id: input.id,
          value: input.value,
          message: input.validationMessage,
        })),
    ),
    [],
  );
  await shell.getByRole('button', { name: 'Save', exact: true }).click();
  await shell
    .getByRole('status')
    .filter({ hasText: 'Saved' })
    .waitFor({ timeout: 5000 });
  assert.deepEqual(
    JSON.parse(await readFile(`${profile}/profile.json`, 'utf8')),
    {
      email: 'candidate@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      addressLine1: '1 Main St',
      city: 'Example City',
      state: 'DC',
      postalCode: '20001',
      country: 'United States of America',
      phoneDeviceType: 'Mobile',
      phoneCountryCode: 'United States of America (+1)',
      phone: '2025550123',
    },
  );
  await shell.getByLabel('Email *', { exact: true }).fill('invalid');
  await shell.getByRole('button', { name: 'Save', exact: true }).click();
  assert.equal(
    await shell
      .getByLabel('Email *', { exact: true })
      .evaluate((input) => input.validity.typeMismatch),
    true,
  );
  await shell.getByRole('link', { name: 'Browser', exact: true }).click();
  await shell
    .getByRole('dialog')
    .getByRole('button', { name: 'Discard', exact: true })
    .click();
  let firstFingerprint;
  for (const [index, kind] of [
    'create_account',
    'sign_in',
    'sign_in_options',
    'apply_manually',
  ].entries()) {
    await open(`company${index}`, kind);
    const fingerprint = await check('create_account');
    if (index === 0) firstFingerprint = fingerprint;
  }
  const saved = await shell.evaluate(() => window.forkday.listCredentials());
  assert.equal(saved.length, 4);
  assert.deepEqual(Object.keys(saved[0]).sort(), [
    'company',
    'email',
    'origin',
  ]);
  const encrypted = await readFile(`${profile}/credentials.enc`);
  assert.equal(encrypted.includes('candidate@example.com'), false);
  assert.equal(encrypted.includes('company0'), false);
  assert.equal(
    await app.evaluate(({ safeStorage }) =>
      safeStorage.isEncryptionAvailable(),
    ),
    true,
  );
  await shell
    .getByRole('link', { name: 'Saved Credentials', exact: true })
    .click();
  await shell
    .getByRole('cell', { name: 'company0', exact: true })
    .waitFor({ timeout: 5000 });
  assert.equal(await shell.getByRole('columnheader').count(), 3);
  assert.equal(await shell.getByLabel('Password hidden').count(), 4);
  const firstRow = shell.getByRole('row').filter({
    has: shell.getByRole('cell', { name: 'company0', exact: true }),
  });
  const hiddenBounds = await firstRow
    .locator('td, button')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      }),
    );
  await firstRow
    .getByRole('button', { name: /^Show password/ })
    .click({ timeout: 5000 });
  const visiblePassword = firstRow.locator('span.font-mono:not([aria-label])');
  await visiblePassword.waitFor({ timeout: 5000 });
  assert.equal(
    Array.from(
      createHash('sha256')
        .update(await visiblePassword.innerText())
        .digest(),
    ).join(','),
    firstFingerprint,
  );
  assert.equal(await shell.getByLabel('Password hidden').count(), 3);
  assert.deepEqual(
    await firstRow.locator('td, button').evaluateAll((elements) =>
      elements.map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      }),
    ),
    hiddenBounds,
  );
  await firstRow
    .getByRole('button', { name: /^Hide password/ })
    .click({ timeout: 5000 });
  await visiblePassword.waitFor({ state: 'hidden', timeout: 5000 });
  assert.equal(await shell.getByLabel('Password hidden').count(), 4);
  const search = shell.getByRole('searchbox', {
    name: 'Search saved credentials',
  });
  await search.fill('COMPANY0');
  await shell
    .getByRole('cell', { name: 'company1', exact: true })
    .waitFor({ state: 'hidden', timeout: 5000 });
  assert.equal(await shell.getByLabel('Password hidden').count(), 1);
  await search.fill('missing-company');
  await shell
    .getByText('No matching credentials.', { exact: true })
    .waitFor({ timeout: 5000 });
  await search.fill('candidate@example.com');
  await shell
    .getByRole('cell', { name: 'company1', exact: true })
    .waitFor({ timeout: 5000 });
  assert.equal(await shell.getByLabel('Password hidden').count(), 4);
  assert.equal(await shell.locator('input[type=password]').count(), 0);
  assert.equal(
    (
      await shell
        .getByRole('link', { name: 'Saved Credentials', exact: true })
        .innerText()
    ).trim(),
    '',
  );
  await app.close();
  app = undefined;
  await launch();
  await shell.getByRole('link', { name: 'Profile', exact: true }).click();
  await shell.getByRole('button', { name: 'Save', exact: true }).waitFor();
  await shell.getByLabel('Phone Number *', { exact: true }).click();

  assert.equal(
    await shell.getByLabel('Phone Number *', { exact: true }).inputValue(),
    '2025550123',
  );
  await shell.getByRole('link', { name: 'Browser', exact: true }).click();
  await open('company0', 'sign_in');
  assert.equal(await check('sign_in'), firstFingerprint);
  for (const kind of ['sign_in_options', 'create_account']) {
    await open('company0', kind);
    assert.equal(await check('sign_in'), firstFingerprint);
  }
  assert.equal(
    (await shell.evaluate(() => window.forkday.listCredentials())).length,
    4,
  );
  // Another company and another email must receive different passwords.
  await shell.evaluate(() =>
    window.forkday
      .getProfile()
      .then((profile) =>
        window.forkday.saveProfile({ ...profile, email: 'other@example.com' }),
      ),
  );
  await open('company0', 'sign_in');
  assert.notEqual(
    await check('create_account', 'other@example.com'),
    firstFingerprint,
  );
  assert.equal(
    (await shell.evaluate(() => window.forkday.listCredentials())).length,
    5,
  );
  console.log(
    'PASS: real OS-backed encryption; account creation and consent; saved-password sign-in after restart; tenant/email isolation; searchable three-column credentials table; passwords absent from credential lists; per-row reveal and hide.',
  );
} finally {
  await app?.close();
  await rm(profile, { recursive: true, force: true });
}
