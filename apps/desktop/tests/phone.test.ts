import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPhoneNumber } from '../src/shared/phone.ts';

test('phone numbers format ten digits without truncating partial or international numbers', () => {
  assert.equal(formatPhoneNumber('2025550123'), '(202) 555-0123');
  assert.equal(formatPhoneNumber('(202) 555-0123'), '(202) 555-0123');
  assert.equal(formatPhoneNumber('202555012'), '202555012');
  assert.equal(formatPhoneNumber('442079460958'), '442079460958');
  assert.equal(formatPhoneNumber(''), '');
});
