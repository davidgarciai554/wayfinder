import { readState, writeState } from './state.ts';
import { withLock } from './sync.ts';

const FILE = 'chat-mentions.json';
export const ORDER_TTL_MS = 15 * 60 * 1000;

/** Per project: the explicit approval orders found in the person's latest message. */
type Mentions = Record<string, { ts: number; ids: string[] }>;

const APPROVAL_VERBS = [
  'aprueba', 'apruébala', 'apruebala', 'aprobar', 'haz', 'hazla', 'empieza', 'empiézala', 'empiezala', 'arranca',
  'approve', 'do', 'start',
];
const NEGATIONS = ['no', 'nunca', 'ni', 'sin', "don't", 'dont', 'do not', 'never', 'not'];
const WINDOW = 3;

/**
 * Extracts the IDs the person explicitly orders to approve: an approval verb at most WINDOW
 * words before the ID, no negation in that window, and the sentence is not a question.
 * Code blocks, inline code and quoted lines are ignored. Ambiguity means no order (fail closed).
 */
export function extractOrders(prompt: string, idPrefix: string): string[] {
  const text = prompt
    .normalize('NFKC')
    .replace(/[​-‏‪-‮⁠-⁤﻿]/g, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('>'))
    .join('\n');
  const found = new Set<string>();
  const idRe = new RegExp(`\\b(${idPrefix}-[1-9]\\d{0,8})\\b`, 'g');
  for (const sentence of text.split(/(?<=[.!?¡¿\n])/)) {
    if (/[¿?]/.test(sentence)) continue;
    for (const match of sentence.matchAll(idRe)) {
      const before = sentence.slice(0, match.index).toLowerCase();
      const words = before.split(/[^\p{L}'’]+/u).filter(Boolean).slice(-WINDOW);
      const joined = words.join(' ');
      if (NEGATIONS.some((n) => (n.includes(' ') ? joined.includes(n) : words.includes(n)))) continue;
      if (words.some((w) => APPROVAL_VERBS.includes(w))) found.add(match[1]);
    }
  }
  return [...found];
}

/** Called only by the UserPromptSubmit hook: each message replaces the previous orders. */
export function recordOrders(home: string, slug: string, ids: string[], nowMs: number): void {
  withLock(home, () => {
    const all = readState<Mentions>(home, FILE);
    all[slug] = { ts: nowMs, ids };
    writeState(home, FILE, all);
  });
}

/** Must run inside the store lock. */
export function getOrderUnlocked(home: string, slug: string, id: string): { ts: number } | null {
  const entry = readState<Mentions>(home, FILE)[slug];
  if (!entry || !Array.isArray(entry.ids) || !entry.ids.includes(id) || typeof entry.ts !== 'number') return null;
  return { ts: entry.ts };
}

/** Must run inside the store lock. Each order authorises a single approval. */
export function consumeOrderUnlocked(home: string, slug: string, id: string): void {
  const all = readState<Mentions>(home, FILE);
  const entry = all[slug];
  if (!entry) return;
  entry.ids = entry.ids.filter((x) => x !== id);
  writeState(home, FILE, all);
}
