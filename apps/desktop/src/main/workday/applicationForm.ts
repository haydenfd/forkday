import type { Locator, Page } from 'playwright';
import {
  US_COUNTRY,
  US_STATES,
  stateCode,
  type Profile,
} from '../../shared/profile.ts';
import { detectAccountPage } from './accountForm.ts';

const TIMEOUT = 3000;

export interface FillResult {
  /** Labels of fields Forkday filled on this page. */
  filled: string[];
  /** Labels of required fields still empty after filling. */
  missing: string[];
  resumeUploaded: boolean;
}

type Answer = (label: string) => string | undefined;

// Ordered: the first matching label wins. Labels come from the page, values from Profile.
function textAnswers(profile: Profile): [RegExp, string | undefined][] {
  return [
    [/^(legal )?first name|^given name/i, profile.firstName],
    [/^(legal )?last name|^family name|^surname/i, profile.lastName],
    [/^e-?mail/i, profile.email],
    [/address line 1|^street|^address$/i, profile.addressLine1],
    [/address line 2/i, profile.addressLine2],
    [/^city|^town/i, profile.city],
    [/postal code|zip/i, profile.postalCode],
    [/phone extension/i, undefined],
    [/phone number|^phone$|^mobile/i, profile.phone?.replace(/\D/g, '')],
    [/linkedin/i, profile.linkedinUrl],
    [/github/i, profile.githubUrl],
    [/website|portfolio|personal (site|url)/i, profile.websiteUrl],
    [/notice period/i, profile.noticePeriod],
    [/salary|compensation|desired pay/i, profile.salaryExpectation],
    [/visa|residency/i, profile.residencyStatus],
  ];
}

function choiceAnswer(profile: Profile): Answer {
  return (label) => {
    if (/country phone code|phone code/i.test(label)) return;
    if (/phone (device )?type/i.test(label))
      return profile.phoneDeviceType ?? 'Mobile';
    if (/^country/i.test(label)) return US_COUNTRY;
    if (/^state|province|region/i.test(label))
      return (
        profile.state && (US_STATES[stateCode(profile.state)!] ?? profile.state)
      );
    if (/sponsor/i.test(label)) {
      const { sponsorshipNow: now, sponsorshipFuture: future } = profile;
      if (/now/i.test(label) && /future/i.test(label))
        return now === 'Yes' || future === 'Yes'
          ? 'Yes'
          : now && future
            ? 'No'
            : undefined;
      return /future/i.test(label) ? future : now;
    }
    if (
      /authori[sz]ed to work|eligible to work|legally (authori|able)/i.test(
        label,
      )
    )
      return profile.authorizedToWork;
    if (/relocat/i.test(label)) return profile.willingToRelocate;
    if (/veteran/i.test(label)) return profile.protectedVeteran;
    if (/disabilit/i.test(label)) return profile.disability;
    if (/gender|^sex\b/i.test(label)) return profile.gender;
    if (/ethnic|race/i.test(label)) return profile.raceEthnicity;
  };
}

/** Pick the page option that means `answer`; undefined when nothing clearly does. */
export function matchOption(
  answer: string,
  options: string[],
): string | undefined {
  const clean = (value: string): string => value.trim().toLowerCase();
  const wanted = clean(answer);
  const declines =
    /prefer not|do not (wish|want)|decline|not to (answer|self.?identify)|choose not/i;
  return (
    options.find((option) => clean(option) === wanted) ??
    (wanted === 'prefer not to answer'
      ? options.find((option) => declines.test(option))
      : wanted === 'yes'
        ? options.find(
            (option) =>
              /^yes\b|identify as (one or more|a protected)/i.test(option) &&
              !declines.test(option),
          )
        : wanted === 'no'
          ? options.find(
              (option) =>
                /^no\b|^i am not|not a protected/i.test(option) &&
                !declines.test(option),
            )
          : options.find((option) => clean(option).startsWith(wanted)))
  );
}

async function labelOf(field: Locator): Promise<string> {
  const label = field.locator('label, legend').first();
  if (!(await label.count())) return '';
  return ((await label.textContent({ timeout: TIMEOUT })) ?? '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function chooseFromListbox(
  page: Page,
  button: Locator,
  answer: string,
): Promise<boolean> {
  await button.click({ timeout: TIMEOUT });
  const controls = await button.getAttribute('aria-controls');
  const listbox = controls
    ? page.locator(`[id="${controls}"]`)
    : page.getByRole('listbox').last();
  await listbox.waitFor({ timeout: TIMEOUT });
  const options = listbox.getByRole('option');
  const labels = (await options.allTextContents()).map((text) => text.trim());
  const match = matchOption(answer, labels);
  if (!match) {
    await page.keyboard.press('Escape');
    return false;
  }
  await options.nth(labels.indexOf(match)).click({ timeout: TIMEOUT });
  return true;
}

/**
 * Fill whatever Workday application page is open from the saved profile.
 * Never overwrites a value, never ticks consent boxes, never clicks Next/Submit.
 */
export async function fillApplicationPage(
  page: Page,
  profile: Profile,
  resumePath?: string,
): Promise<FillResult> {
  const result: FillResult = { filled: [], missing: [], resumeUploaded: false };
  const texts = textAnswers(profile);
  const choose = choiceAnswer(profile);
  const fields = page.locator('[data-automation-id^="formField-"]');
  const count = Math.min(await fields.count(), 200);
  for (let index = 0; index < count; index++) {
    const field = fields.nth(index);
    let label = '';
    try {
      if (!(await field.isVisible())) continue;
      label = await labelOf(field);
      if (!label) continue;
      const required =
        (await field.locator('[aria-required="true"], [required]').count()) >
          0 ||
        /\*/.test(
          (await field.locator('label, legend').first().textContent()) ?? '',
        );

      const listButton = field
        .locator('button[aria-haspopup="listbox"]')
        .first();
      const radios = field.getByRole('radio');
      const input = field
        .locator(
          'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), textarea',
        )
        .first();

      let done = false;
      if (await listButton.count()) {
        const current = ((await listButton.textContent()) ?? '').trim();
        const answer = choose(label);
        if (!/^select one$|^$/i.test(current)) continue;
        if (answer) done = await chooseFromListbox(page, listButton, answer);
      } else if (await radios.count()) {
        const answer = choose(label);
        const names: string[] = [];
        for (let r = 0; r < (await radios.count()); r++) {
          if (await radios.nth(r).isChecked()) {
            names.length = 0;
            break;
          }
          const id = await radios.nth(r).getAttribute('id');
          const text = id
            ? await field.locator(`label[for="${id}"]`).textContent()
            : await radios.nth(r).getAttribute('aria-label');
          names.push((text ?? '').trim());
        }
        if (!names.length) continue;
        const match = answer && matchOption(answer, names);
        if (match) {
          await radios.nth(names.indexOf(match)).check({ timeout: TIMEOUT });
          done = true;
        }
      } else if (await input.count()) {
        if (await input.inputValue({ timeout: TIMEOUT })) continue;
        if (!(await input.isEditable())) continue;
        const value = texts.find(([pattern]) => pattern.test(label))?.[1];
        if (value) {
          await input.fill(value, { timeout: TIMEOUT });
          await input.blur({ timeout: TIMEOUT });
          done = true;
        }
      } else continue;

      if (done) result.filled.push(label);
      else if (required) result.missing.push(label);
    } catch {
      // Playwright messages can include typed values; keep only the label.
      await page.keyboard.press('Escape').catch(() => {});
      if (label) result.missing.push(label);
    }
  }

  if (resumePath) {
    try {
      const upload = page.locator('input[type=file]').first();
      const alreadyUploaded = await page
        .getByText(/successfully uploaded/i)
        .count();
      if ((await upload.count()) && !alreadyUploaded) {
        await upload.setInputFiles(resumePath, { timeout: TIMEOUT });
        result.resumeUploaded = true;
      }
    } catch {
      result.missing.push('Resume upload');
    }
  }
  return result;
}

/** Click the job posting's Apply button when it is on screen. */
export async function startApplication(page: Page): Promise<boolean> {
  const apply = page.locator('[data-automation-id="adventureButton"]');
  try {
    await apply.waitFor({ state: 'visible', timeout: 10000 });
    await apply.click({ timeout: TIMEOUT });
    return true;
  } catch {
    return false;
  }
}

/** True once Workday shows the application form (any step after sign-in). */
export async function onApplicationForm(page: Page): Promise<boolean> {
  return (
    (await page
      .locator(
        '[data-automation-id="progressBar"], [data-automation-id="pageFooterNextButton"], [data-automation-id="bottom-navigation-next-button"], [data-automation-id^="formField-legalName"]',
      )
      .count()) > 0
  );
}

async function poll<T>(
  check: () => Promise<T | undefined>,
  ms: number,
): Promise<T | undefined> {
  const deadline = Date.now() + ms;
  do {
    const value = await check().catch(() => undefined);
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  } while (Date.now() < deadline);
}

/** Wait for Workday to show either its sign-in flow or the application form. */
export async function locateStep(
  page: Page,
): Promise<'form' | 'account' | 'unknown'> {
  return (
    (await poll(async () => {
      if (await onApplicationForm(page)) return 'form' as const;
      if (
        (await detectAccountPage(page)) !== 'unknown' ||
        (await page.locator('[data-automation-id="applyManually"]').isVisible())
      )
        return 'account' as const;
    }, 15000)) ?? 'unknown'
  );
}

export async function waitForApplicationForm(page: Page): Promise<boolean> {
  return (
    (await poll(
      async () => ((await onApplicationForm(page)) ? true : undefined),
      20000,
    )) ?? false
  );
}
