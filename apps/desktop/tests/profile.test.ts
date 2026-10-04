import assert from 'node:assert/strict';
import test from 'node:test';
import { CompleteProfileSchema, ProfileSchema } from '../src/shared/profile.ts';

test('profile accepts valid full and partial profiles', () => {
  const profile = {
    email: 'candidate@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    phoneDeviceType: 'Mobile',
    phoneCountryCode: 'United States of America (+1)',
    phone: '123',
    phoneExtension: '42',
    addressLine1: '1 Main St',
    city: 'London',
    state: '',
    postalCode: '12345',
    country: 'UK',
    linkedinUrl: 'https://linkedin.com/in/ada',
    githubUrl: 'https://github.com/ada',
    websiteUrl: 'https://example.com',
  };
  assert.deepEqual(ProfileSchema.parse(profile), profile);
  assert.deepEqual(ProfileSchema.parse({}), {});
  assert.deepEqual(ProfileSchema.parse({ firstName: 'Ada' }), {
    firstName: 'Ada',
  });
  assert.deepEqual(ProfileSchema.parse({ phone: '2025550123' }), {
    phone: '2025550123',
  });
});

test('profile rejects invalid email, URLs, and non-string fields', () => {
  for (const email of ['invalid', '', 123]) {
    assert.equal(ProfileSchema.safeParse({ email }).success, false);
  }
  for (const field of ['linkedinUrl', 'githubUrl', 'websiteUrl']) {
    assert.equal(
      ProfileSchema.safeParse({ [field]: 'invalid' }).success,
      false,
    );
  }
  assert.equal(ProfileSchema.safeParse({ firstName: 123 }).success, false);
  assert.equal(
    ProfileSchema.safeParse({ phoneDeviceType: 'Other' }).success,
    false,
  );
  for (const field of ['phoneCountryCode', 'phone', 'phoneExtension']) {
    assert.equal(ProfileSchema.safeParse({ [field]: 123 }).success, false);
  }
});

test('saving requires every visible field except links and defaults to Mobile without an extension', () => {
  const profile = {
    email: 'candidate@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    phoneCountryCode: 'United States of America (+1)',
    phone: '2025550123',
    addressLine1: '1 Main St',
    city: 'Example City',
    state: 'DC',
    postalCode: '20001',
    country: 'United States of America',
  };
  assert.deepEqual(CompleteProfileSchema.parse(profile), {
    ...profile,
    phoneDeviceType: 'Mobile',
  });
  assert.equal(
    CompleteProfileSchema.parse({ ...profile, phoneCountryCode: undefined })
      .phoneCountryCode,
    'United States of America (+1)',
  );
  assert.equal(
    CompleteProfileSchema.safeParse({
      ...profile,
      phoneCountryCode: 'Canada (+1)',
    }).success,
    false,
  );
  for (const field of Object.keys(profile).filter(
    (field) => !['phoneCountryCode', 'country'].includes(field),
  )) {
    const missing = { ...profile } as Record<string, unknown>;
    delete missing[field];
    assert.equal(
      CompleteProfileSchema.safeParse(missing).success,
      false,
      field,
    );
    assert.equal(
      CompleteProfileSchema.safeParse({ ...profile, [field]: '  ' }).success,
      false,
      field,
    );
  }
  assert.equal(
    CompleteProfileSchema.safeParse({ ...profile, phoneDeviceType: 'Home' })
      .success,
    false,
  );
  assert.equal(
    CompleteProfileSchema.safeParse({ ...profile, phoneExtension: '42' })
      .success,
    false,
  );
});

test('resume and application answers persist without guessing unset or declined choices', () => {
  const fields = {
    resumeText: 'Example resume',
    skills: 'TypeScript, writing',
    workExperience: [
      {
        id: crypto.randomUUID(),
        company: 'Example',
        jobTitle: 'Engineer',
        startDate: '2023-01',
        current: true,
      },
    ],
    education: [
      {
        id: crypto.randomUUID(),
        school: 'Example University',
        degree: 'BS',
        startDate: '2018-09',
        endDate: '2022-06',
      },
    ],
    workAuthorizationCountry: 'United States',
    authorizedToWork: 'Yes',
    sponsorshipNow: 'No',
    sponsorshipFuture: 'Yes',
    disability: 'Prefer not to answer',
    protectedVeteran: 'No',
    availableStartDate: '2026-11-01',
  };
  assert.deepEqual(ProfileSchema.parse(fields), fields);
  const contact = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'candidate@example.com',
    phone: '2025550123',
    addressLine1: '1 Example Street',
    city: 'Example City',
    state: 'DC',
    postalCode: '20001',
    country: 'United States of America',
  };
  assert.equal(
    CompleteProfileSchema.safeParse({ ...contact, ...fields }).success,
    true,
  );
  assert.equal(
    CompleteProfileSchema.safeParse({
      ...contact,
      ...fields,
      workAuthorizationCountry: undefined,
    }).success,
    true,
  );
  assert.deepEqual(ProfileSchema.parse({}), {});
  assert.equal(
    ProfileSchema.safeParse({ ...fields, disability: 'Guess' }).success,
    false,
  );
  assert.equal(
    ProfileSchema.safeParse({
      ...fields,
      workExperience: [{ ...fields.workExperience[0], startDate: '2024-14' }],
    }).success,
    false,
  );
  assert.equal(
    ProfileSchema.safeParse({
      ...fields,
      workExperience: [
        { ...fields.workExperience[0], current: false, endDate: '2022-01' },
      ],
    }).success,
    false,
  );
  assert.equal(
    ProfileSchema.safeParse({
      ...fields,
      workExperience: [{ ...fields.workExperience[0], endDate: '2025-01' }],
    }).success,
    false,
  );
  assert.equal(
    ProfileSchema.safeParse({ ...fields, availableStartDate: '2026-02-30' })
      .success,
    false,
  );
});

test('states are stored as two-letter codes, whichever form was saved', async () => {
  const { stateCode, US_STATES } = await import('../src/shared/profile.ts');
  assert.equal(Object.keys(US_STATES).length, 52);
  assert.equal(stateCode('California'), 'CA');
  assert.equal(stateCode(' ny '), 'NY');
  assert.equal(stateCode('district of columbia'), 'DC');
  assert.equal(stateCode('Ontario'), 'Ontario');
  assert.equal(stateCode(undefined), undefined);
});
