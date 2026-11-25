// Heuristic detector: it reduces accidental leaks but is not a guarantee (false negatives exist).
const PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{20,}/],
  ['github-pat', /\bgithub_pat_[A-Za-z0-9_]{20,}/],
  ['api-key-sk', /\bsk-[A-Za-z0-9_-]{20,}/],
  ['aws-access-key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['slack-token', /\bxox[abposr]-[A-Za-z0-9-]{10,}/],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}/],
  ['stripe-key', /\b[rs]k_live_[0-9A-Za-z]{16,}/],
  ['npm-token', /\bnpm_[A-Za-z0-9]{36}/],
  ['gitlab-token', /\bglpat-[A-Za-z0-9_-]{20,}/],
  ['jwt', /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{10,}/],
  // The per-start key of the web (`/?k=<key>`, see startServer), with or without the link around it.
  ['wayfinder-web-key', /\b[0-9a-f]{6}\.[0-9a-f]{48}\b/],
  ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['bearer-token', /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/],
  ['url-credentials', /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i],
  ['password-assignment', /\b(?:pass(?:word|wd)?|contrase[ñn]a)\s*[=:]\s*\S+/i],
  // A long value with a digit: prose ("token: the session one") and paths or URLs (cut at ':') pass.
  [
    'key-assignment',
    /\b[\w-]*(?:api[_-]?key|secret|token|access[_-]?key|clave[ _-](?:de[ _-])?(?:api|acceso|secreta))[\w-]*["']?\s*[=:]\s*["']?(?=[\w+/=.-]*\d)[\w+/=.-]{20,}/i,
  ],
];

/** Returns the names of the secret patterns found in `text` (empty when none). */
export function findSecrets(text: string): string[] {
  return PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
}
