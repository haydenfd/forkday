import assert from 'node:assert/strict';
import test from 'node:test';
import { ProfileSchema } from '../src/shared/profile.ts';

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
