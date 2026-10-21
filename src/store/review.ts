import { createHash } from 'node:crypto';
import { readState, writeState } from './state.ts';
import { withLock } from './sync.ts';
import { readTask, type Task } from './tasks.ts';

const FILE = 'reviews.json';
export const REVIEW_TTL_MS = 24 * 60 * 60 * 1000;

type Reviews = Record<string, Record<string, { hash: string; signals: string[]; ts: number }>>;

/** Hash of the fields an approval depends on, normalised (LF, no BOM). */
export function contentHash(task: Pick<Task, 'title' | 'body' | 'priority' | 'plan' | 'origin'>): string {
  const norm = (s: string) => s.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const payload = JSON.stringify([norm(task.title), norm(task.body), task.priority, task.plan, task.origin]);
  return createHash('sha256').update(payload).digest('hex');
}

const INVISIBLE = /[​-‏‪-‮⁠-⁤﻿]|[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

// Heuristic signals. They only decide whether a second confirmation is required; they are not a verdict.
const SIGNALS: ReadonlyArray<readonly [string, RegExp]> = [
  ['assistant-instruction', /\b(ignore|disregard|forget)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all)\b[^.\n]{0,30}\b(instructions?|prompts?|rules|messages?)\b/i],
  ['assistant-instruction', /\bignor\w*\b[^.\n]{0,40}\b(instrucciones|indicaciones|anterior(es)?|reglas)\b/i],
  ['assistant-instruction', /\b(you are now|act as|system prompt|new instructions|eres ahora|act[uú]a como|nuevas instrucciones)\b/i],
  ['secret-request', /\b(tokens?|passwords?|contraseñas?|api[ _-]?keys?|credenciales?|credentials?|secrets?|secretos?|claves? privadas?|private keys?)\b/i],
  ['shell-command', /(^|[\s;&|`$(])(curl|wget|iwr|iex|invoke-webrequest|invoke-expression|powershell|pwsh|bash|sh|cmd(\.exe)?|sudo|chmod|rm\s+-rf|del\s+\/)\b/im],
  ['git-network', /\bgit\s+(push|remote|fetch|pull|clone)\b/i],
  ['external-url', /\b(https?|ftp):\/\/(?!(localhost|127\.0\.0\.1)([:/]|$))[^\s)>\]]+/i],
  ['encoded-blob', /[A-Za-z0-9+/]{120,}={0,2}/],
  ['sensitive-path', /(^|[\s"'`(\\/~])\.ssh\b|(^|[\s"'`(\\/])\.env\b|WAYFINDER_HOME|\.wayfinder\b|id_(rsa|ed25519)\b/i],
  ['agent-config', /(^|[\s"'`(\\/])\.claude[\\/]|\bAGENTS\.md\b|\bCLAUDE\.md\b|\bsettings(\.local)?\.json\b/i],
];

export function computeSignals(title: string, body: string): string[] {
  const raw = `${title}\n${body}`;
  const text = raw.normalize('NFKC');
  const found = new Set<string>();
  if (INVISIBLE.test(raw)) found.add('invisible-chars');
  for (const [name, re] of SIGNALS) if (re.test(text)) found.add(name);
  return [...found];
}

export interface ReviewResult {
  task: Task;
  signals: string[];
  hash: string;
  ts: number;
}

/** Only the MCP calls this. It records the review; the task and git are left untouched. */
export function reviewTask(home: string, slug: string, id: string, nowMs: number = Date.now()): ReviewResult {
  return withLock(home, () => {
    const task = readTask(home, slug, id);
    const signals = computeSignals(task.title, task.body);
    const hash = contentHash(task);
    const all = readState<Reviews>(home, FILE);
    for (const [s, entries] of Object.entries(all)) {
      for (const [k, v] of Object.entries(entries)) if (nowMs - v.ts > REVIEW_TTL_MS) delete all[s][k];
    }
    all[slug] = { ...(all[slug] ?? {}), [id]: { hash, signals, ts: nowMs } };
    writeState(home, FILE, all);
    return { task, signals, hash, ts: nowMs };
  });
}

export function getReviewUnlocked(home: string, slug: string, id: string): { hash: string; signals: string[]; ts: number } | null {
  const entry = readState<Reviews>(home, FILE)[slug]?.[id];
  if (!entry || typeof entry.hash !== 'string' || !Array.isArray(entry.signals) || typeof entry.ts !== 'number') return null;
  return entry;
}

export function consumeReviewUnlocked(home: string, slug: string, id: string): void {
  const all = readState<Reviews>(home, FILE);
  if (all[slug]?.[id]) {
    delete all[slug][id];
    writeState(home, FILE, all);
  }
}
