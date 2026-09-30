export function validateBrowserUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 8_192) {
    throw new Error('Enter a valid HTTP or HTTPS job URL.');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a valid HTTP or HTTPS job URL.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error('Use an HTTP or HTTPS URL without embedded credentials.');
  }
  return url.href;
}
