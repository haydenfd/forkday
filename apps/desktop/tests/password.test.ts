import assert from 'node:assert/strict';
import test from 'node:test';
import { generatePassword } from '../src/main/workday/generatePassword.ts';

test('passwords have 20 allowed characters, all four classes, and no duplicates in 1000 draws', () => {
  const passwords = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const password = generatePassword();
    assert.equal(password.length, 20);
    for (const pattern of [/[A-Z]/, /[a-z]/, /[0-9]/, /[!@#$%^&*_=+\-]/])
      assert.match(password, pattern);
    assert.match(password, /^[A-Za-z0-9!@#$%^&*_=+\-]+$/);
    passwords.add(password);
  }
  assert.equal(passwords.size, 1000);
});
