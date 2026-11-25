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
];

// key-assignment: a name, then = or :, then a value of 20 to 512 characters with a digit, so prose
// ("token: the session one") and paths or URLs (cut at ':') pass. Each candidate is found with
// bounded repeats and checked apart: one regex with `[\w-]*` around the names backtracked
// cubically on text such as 'token-'.repeat(3000).
const ASSIGNMENT = /([\w -]{1,64}?)["']?\s*[=:]\s*["']?([\w+/=.-]{20,512})/g;
const KEY_WORD = /^[\w-]*(?:api[_-]?key|secret|token|access[_-]?key)[\w-]*$/i;
const KEY_PHRASE = /\bclave[ _-](?:de[ _-])?(?:api|acceso|secreta)\s*$/i;

function hasKeyAssignment(text: string): boolean {
  for (const m of text.matchAll(ASSIGNMENT)) {
    const name = m[1].trimEnd();
    if (/\d/.test(m[2]) && (KEY_WORD.test(name.split(' ').pop() ?? '') || KEY_PHRASE.test(name))) return true;
  }
  return false;
}

/** Returns the names of the secret patterns found in `text` (empty when none). */
export function findSecrets(text: string): string[] {
  const found = PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
  return hasKeyAssignment(text) ? [...found, 'key-assignment'] : found;
}
