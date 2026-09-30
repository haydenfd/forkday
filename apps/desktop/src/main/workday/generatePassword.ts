import { randomInt } from 'node:crypto';

const classes = [
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'abcdefghijklmnopqrstuvwxyz',
  '0123456789',
  '!@#$%^&*-_+=',
];

export function generatePassword(): string {
  const allowed = classes.join('');
  const characters = classes.map((group) => group[randomInt(group.length)]);
  while (characters.length < 20)
    characters.push(allowed[randomInt(allowed.length)]);
  for (let i = characters.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [characters[i], characters[j]] = [characters[j], characters[i]];
  }
  return characters.join('');
}
