import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import es from './es.json' with { type: 'json' };
import en from './en.json' with { type: 'json' };

export type Lang = 'es' | 'en';
export type MessageKey = keyof typeof es;

export const LANGS: readonly Lang[] = ['es', 'en'];
export const dictionaries: Record<Lang, Record<string, string>> = { es, en };

const DEFAULT_LANG: Lang = 'es';

function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

/** Resolution order from the plan: WAYFINDER_LANG > WAYFINDER_HOME/config.json > es. */
export function resolveLang(env: NodeJS.ProcessEnv = process.env): Lang {
  const fromEnv = env.WAYFINDER_LANG?.trim().toLowerCase();
  if (isLang(fromEnv)) return fromEnv;
  if (env.WAYFINDER_HOME) {
    try {
      const config: unknown = JSON.parse(readFileSync(join(env.WAYFINDER_HOME, 'config.json'), 'utf8'));
      const language = (config as { language?: unknown } | null)?.language;
      if (isLang(language)) return language;
    } catch {
      // A missing or unreadable config.json falls back to the default language.
    }
  }
  return DEFAULT_LANG;
}

// The store explains unreadable task files with stable English reasons; translate them at the edges.
const REASONS: ReadonlyArray<readonly [RegExp, MessageKey, string?]> = [
  [/^missing frontmatter$/, 'reason.missingFrontmatter'],
  [/^unterminated frontmatter$/, 'reason.unterminated'],
  [/^invalid YAML: (.*)$/, 'reason.invalidYaml', 'detail'],
  [/^frontmatter is not a mapping$/, 'reason.notMapping'],
  [/^missing or invalid id$/, 'reason.invalidId'],
  [/^unknown status: (.*)$/, 'reason.unknownStatus', 'value'],
  [/^missing title$/, 'reason.missingTitle'],
  [/^id mismatch \((.*)\)$/, 'reason.idMismatch', 'value'],
];

export function translateReason(lang: Lang, reason: string): string {
  for (const [re, key, varName] of REASONS) {
    const m = re.exec(reason);
    if (m) return t(lang, key, varName ? { [varName]: m[1] } : {});
  }
  return reason;
}

export function t(lang: Lang, key: MessageKey, vars: Record<string, string | number> = {}): string {
  if ((key === 'store.taskUnreadable' || key === 'mcp.unreadable') && typeof vars.reason === 'string') {
    vars = { ...vars, reason: translateReason(lang, vars.reason) };
  }
  const template = dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
