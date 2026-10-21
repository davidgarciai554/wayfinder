// Heuristic detector: it reduces accidental leaks but is not a guarantee (false negatives exist).
const PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{20,}/],
  ['github-pat', /\bgithub_pat_[A-Za-z0-9_]{20,}/],
  ['api-key-sk', /\bsk-[A-Za-z0-9_-]{20,}/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['bearer-token', /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/],
  ['url-credentials', /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i],
  ['password-assignment', /\bpass(?:word|wd)?\s*[=:]\s*\S+/i],
];

/** Returns the names of the secret patterns found in `text` (empty when none). */
export function findSecrets(text: string): string[] {
  return PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
}
