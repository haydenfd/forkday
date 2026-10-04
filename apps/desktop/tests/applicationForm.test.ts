import assert from 'node:assert/strict';
import test from 'node:test';
import { matchOption } from '../src/main/workday/applicationForm.ts';

test('answers map onto the wording employers use', () => {
  assert.equal(matchOption('Yes', ['No', 'Yes']), 'Yes');
  assert.equal(
    matchOption('No', ['Yes, I need sponsorship', 'No, I do not']),
    'No, I do not',
  );
  const veteran = [
    'I identify as one or more of the classifications of protected veteran',
    'I am not a protected veteran',
    'I do not wish to self-identify',
  ];
  assert.equal(matchOption('Yes', veteran), veteran[0]);
  assert.equal(matchOption('No', veteran), veteran[1]);
  assert.equal(matchOption('Prefer not to answer', veteran), veteran[2]);
  assert.equal(
    matchOption('California', ['Alabama', 'California']),
    'California',
  );
  assert.equal(matchOption('Mobile', ['Home', 'Mobile']), 'Mobile');
  assert.equal(matchOption('Maybe', ['Yes', 'No']), undefined);
});

test('fills empty fields from the profile and leaves the rest for the user', async () => {
  const { chromium } = await import('playwright');
  const { readFile, writeFile, mkdtemp } = await import('node:fs/promises');
  const { fillApplicationPage, onApplicationForm } =
    await import('../src/main/workday/applicationForm.ts');
  const resume = `${await mkdtemp('/tmp/forkday-resume-')}/resume.pdf`;
  await writeFile(resume, '%PDF-1.4\n%%EOF');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(
      await readFile(
        new URL('./fixtures/workday/application_page.html', import.meta.url),
        'utf8',
      ),
    );
    assert.equal(await onApplicationForm(page), true);
    const result = await fillApplicationPage(
      page,
      {
        firstName: 'Ada',
        lastName: 'Lovelace',
        addressLine1: '1 Main St',
        city: 'Springfield',
        state: 'CA',
        postalCode: '94000',
        phone: '(555) 010-0000',
        authorizedToWork: 'Yes',
        sponsorshipNow: 'No',
        sponsorshipFuture: 'No',
      },
      resume,
    );
    assert.deepEqual(result.filled.sort(), [
      'Address Line 1',
      'Are you legally authorized to work in the United States?',
      'City',
      'First Name',
      'Phone Device Type',
      'Phone Number',
      'Postal Code',
      'State',
      'Will you now or in the future require sponsorship?',
    ]);
    assert.deepEqual(result.missing.sort(), [
      'Have you previously worked for Acme?',
      'How Did You Hear About Us?',
    ]);
    assert.equal(result.resumeUploaded, true);
    assert.equal(await page.inputValue('#first'), 'Ada');
    assert.equal(await page.inputValue('#last'), 'Existing');
    assert.equal(await page.inputValue('#phone'), '5550100000');
    assert.equal(await page.innerText('#state'), 'California');
    assert.equal(await page.innerText('#phoneType'), 'Mobile');
    assert.equal(await page.innerText('#sponsor'), 'No');
    assert.equal(await page.innerText('#country'), 'United States of America');
    assert.equal(await page.isChecked('#auth-yes'), true);
    assert.equal(await page.isChecked('#agree'), false);
    assert.equal(
      await page.evaluate(() => document.body.dataset.next),
      undefined,
    );
  } finally {
    await browser.close();
  }
});
