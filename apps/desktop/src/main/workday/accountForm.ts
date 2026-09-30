import type { Locator, Page } from 'playwright';
import type {
  AccountFormResult,
  AccountPageKind,
} from '../../shared/contracts';

const TIMEOUT = 3000;
const TRANSITION_TIMEOUT = 10000;

async function preferred(
  primary: Locator,
  fallback: Locator,
): Promise<Locator> {
  return (await primary.count()) ? primary : fallback;
}

async function fields(page: Page): Promise<Record<string, Locator>> {
  return {
    email: await preferred(
      page.locator('input[data-automation-id="email"]'),
      page.getByLabel(/^Email Address(?:\s*\*)?$/),
    ),
    password: await preferred(
      page.locator('input[data-automation-id="password"]'),
      page.getByLabel(/^Password(?:\s*\*)?$/),
    ),
    verify_password: await preferred(
      page.locator('input[data-automation-id="verifyPassword"]'),
      page.getByLabel(/^Verify New Password(?:\s*\*)?$/),
    ),
  };
}

async function emailButton(page: Page): Promise<Locator> {
  return preferred(
    page.locator('[data-automation-id="SignInWithEmailButton"]'),
    page.getByRole('button', { name: 'Sign in with email', exact: true }),
  );
}

export async function detectAccountPage(page: Page): Promise<AccountPageKind> {
  try {
    if (await (await emailButton(page)).isVisible()) return 'sign_in_options';
    const inputs = await fields(page);
    if (
      !(await inputs.email.isVisible()) ||
      !(await inputs.password.isVisible())
    )
      return 'unknown';
    if (await inputs.verify_password.isVisible()) {
      return (await page
        .getByRole('heading', { name: 'Create Account', exact: true })
        .isVisible())
        ? 'create_account'
        : 'unknown';
    }
    // A partially rendered Create Account form must not be treated as Sign In.
    if (await inputs.verify_password.count()) return 'unknown';
    return (await page
      .getByRole('heading', { name: 'Sign In', exact: true })
      .isVisible())
      ? 'sign_in'
      : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function waitForAccountPage(page: Page): Promise<AccountPageKind> {
  const deadline = Date.now() + TRANSITION_TIMEOUT;
  do {
    const kind = await detectAccountPage(page);
    if (kind !== 'unknown') return kind;
    await page.waitForTimeout(100);
  } while (Date.now() < deadline);
  return 'unknown';
}

export async function fillAccountForm(
  page: Page,
  email: string,
  password: string,
): Promise<AccountFormResult> {
  let kind = await detectAccountPage(page);
  const filled: string[] = [];
  try {
    if (kind === 'unknown') {
      const applyManually = await preferred(
        page.locator('[data-automation-id="applyManually"]'),
        page.getByRole('link', { name: 'Apply Manually', exact: true }),
      );
      if (await applyManually.isVisible()) {
        await applyManually.click({ timeout: TIMEOUT });
        kind = await waitForAccountPage(page);
      }
    }
    if (kind === 'sign_in_options') {
      await (await emailButton(page)).click({ timeout: TIMEOUT });
      const deadline = Date.now() + TRANSITION_TIMEOUT;
      do {
        kind = await detectAccountPage(page);
        if (kind === 'create_account' || kind === 'sign_in') break;
        await page.waitForTimeout(100);
      } while (Date.now() < deadline);
      if (kind !== 'create_account' && kind !== 'sign_in')
        return { page: 'unknown', filled };
    }
    if (kind === 'unknown') return { page: kind, filled };
    const inputs = await fields(page);
    const names =
      kind === 'create_account'
        ? ['email', 'password', 'verify_password']
        : ['email', 'password'];
    for (const name of names) {
      const input = inputs[name];
      const value = name === 'email' ? email : password;
      await input.fill(value, { timeout: TIMEOUT });
      await input.blur({ timeout: TIMEOUT });
      if ((await input.inputValue({ timeout: TIMEOUT })) !== value) {
        await input.fill('', { timeout: TIMEOUT });
        await input.pressSequentially(value, { timeout: TIMEOUT });
        await input.blur({ timeout: TIMEOUT });
      }
      if ((await input.inputValue({ timeout: TIMEOUT })) !== value)
        return { page: 'unknown', filled };
      filled.push(name);
    }
    return { page: kind, filled };
  } catch {
    // Do not leak Playwright's call log, which can include the generated password.
    return { page: 'unknown', filled };
  }
}
