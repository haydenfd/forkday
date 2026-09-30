import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';
import {
  detectAccountPage,
  fillAccountForm,
} from '../src/main/workday/accountForm.ts';

const fixture = (kind: string): Promise<string> =>
  readFile(new URL(`./fixtures/workday/${kind}.html`, import.meta.url), 'utf8');

test('Workday detection and filling stop before consent and submission', async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const email = 'candidate@example.com';
  const password = 'Example-password1!';
  try {
    for (const kind of [
      'sign_in_options',
      'create_account',
      'sign_in',
    ] as const) {
      await page.setContent(await fixture(kind), { timeout: 3000 });
      assert.equal(await detectAccountPage(page), kind);
    }
    for (const kind of ['create_account', 'sign_in'] as const) {
      await page.setContent(await fixture(kind), { timeout: 3000 });
      await page.evaluate(() => {
        document.addEventListener('submit', (e) => {
          e.preventDefault();
          document.body.dataset.submitted = 'yes';
        });
        document.addEventListener('click', () => {
          document.body.dataset.clicked = 'yes';
        });
      });
      const result = await fillAccountForm(page, email, password);
      assert.deepEqual(result, {
        page: kind,
        filled:
          kind === 'create_account'
            ? ['email', 'password', 'verify_password']
            : ['email', 'password'],
      });
      assert.equal(
        await page
          .locator('[data-automation-id=email]')
          .inputValue({ timeout: 3000 }),
        email,
      );
      assert.equal(
        await page
          .locator('[data-automation-id=password]')
          .inputValue({ timeout: 3000 }),
        password,
      );
      if (kind === 'create_account') {
        assert.equal(
          await page
            .locator('[data-automation-id=verifyPassword]')
            .inputValue({ timeout: 3000 }),
          password,
        );
        assert.equal(
          await page.locator('[type=checkbox]').isChecked({ timeout: 3000 }),
          false,
        );
      }
      assert.equal(
        await page.locator('body').getAttribute('data-clicked'),
        null,
      );
      assert.equal(
        await page.locator('body').getAttribute('data-submitted'),
        null,
      );
    }
    // Accessible locators work when automation IDs are absent; retry typing when fill is rejected.
    await page.setContent(await fixture('create_account'), { timeout: 3000 });
    await page.evaluate(() => {
      document
        .querySelectorAll('[data-automation-id]')
        .forEach((el) => el.removeAttribute('data-automation-id'));
      const input = document.querySelector<HTMLInputElement>(
        'input[type=password]',
      )!;
      input.addEventListener('input', () => {
        if (input.value.length > 1 && !input.dataset.rejected) {
          input.dataset.rejected = 'yes';
          input.value = '';
        }
      });
    });
    assert.equal(
      (await fillAccountForm(page, email, password)).page,
      'create_account',
    );

    // Options may lead to either form, with a delayed render.
    for (const kind of ['create_account', 'sign_in'] as const) {
      await page.setContent(await fixture('sign_in_options'), {
        timeout: 3000,
      });
      await page.evaluate(
        (html) => {
          document
            .querySelector('[data-automation-id=SignInWithEmailButton]')!
            .addEventListener('click', () =>
              setTimeout(() => {
                document.body.innerHTML = html;
              }, 100),
            );
        },
        await fixture(kind),
      );
      assert.equal((await fillAccountForm(page, email, password)).page, kind);
    }
    await page.setContent(
      '<a data-automation-id="applyManually" href="#">Apply Manually</a>',
      { timeout: 3000 },
    );
    await page.evaluate(
      (html) => {
        document.querySelector('a')!.addEventListener('click', (e) => {
          e.preventDefault();
          document.body.innerHTML = html;
        });
      },
      await fixture('create_account'),
    );
    assert.equal(
      (await fillAccountForm(page, email, password)).page,
      'create_account',
    );

    await page.setContent('<h1>Job posting</h1>', { timeout: 3000 });
    assert.deepEqual(await fillAccountForm(page, email, password), {
      page: 'unknown',
      filled: [],
    });
    await page.setContent(await fixture('create_account'), { timeout: 3000 });
    await page
      .locator('[data-automation-id=password]')
      .evaluate((el) => el.remove());
    assert.equal(await detectAccountPage(page), 'unknown');

    // Disappearing fields return unknown and preserve the verified field list.
    await page.setContent(await fixture('create_account'), { timeout: 3000 });
    await page
      .locator('[data-automation-id=email]')
      .evaluate((el) =>
        el.addEventListener('blur', () =>
          document.querySelector('[data-automation-id=password]')!.remove(),
        ),
      );
    assert.deepEqual(await fillAccountForm(page, email, password), {
      page: 'unknown',
      filled: ['email'],
    });
  } finally {
    await browser.close();
  }
});

test(
  'a missing email-screen transition times out as unknown',
  { timeout: 15000 },
  async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(await fixture('sign_in_options'), {
        timeout: 3000,
      });
      const started = Date.now();
      assert.deepEqual(
        await fillAccountForm(
          page,
          'candidate@example.com',
          'Example-password1!',
        ),
        { page: 'unknown', filled: [] },
      );
      assert.ok(Date.now() - started < 12000);
    } finally {
      await browser.close();
    }
  },
);
