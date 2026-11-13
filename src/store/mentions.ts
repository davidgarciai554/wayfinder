import { readState, writeState } from './state.ts';
import { withLock } from './sync.ts';

const FILE = 'chat-mentions.json';
export const ORDER_TTL_MS = 15 * 60 * 1000;

/** Per project: the explicit approval orders found in the person's latest message. */
type Mentions = Record<string, { ts: number; ids: string[] }>;

const APPROVAL_VERBS = [
  'aprueba', 'apruebo', 'apruébala', 'apruebala', 'aprobar', 'haz', 'hazla', 'empieza', 'empiézala', 'empiezala', 'arranca',
  'approve', 'do', 'start',
];
const NEGATIONS = ['no', 'nunca', 'ni', 'sin', "don't", 'dont', 'do not', 'never', 'not'];
const WINDOW = 3;
/**
 * Only the explicit approval verbs reach 3 filler words before the first ID ("apruebo las tres
 * tareas WAY-8"). The generic ones (haz, do, start…) keep the old window of 2, so a work request
 * like "haz un resumen de WAY-8" is never an order.
 */
const STRONG_VERBS = ['aprueba', 'apruebo', 'apruébala', 'apruebala', 'aprobar', 'approve'];
const STRONG_WINDOW = 4;
/** More IDs than this in one message (a pasted list?) records no order at all: never a truncated part. */
const MAX_ORDER_IDS = 10;
/** What may join two IDs of one list: a comma, «y», «e», «and», or a comma and one of them. */
const LIST_SEPARATOR = /^\s*(?:,\s*(?:(?:y|e|and)\s+)?|(?:y|e|and)\s+)$/i;

/**
 * Extracts the IDs the person explicitly orders to approve. The first ID of a list needs an
 * approval verb at most 3 words before it (counted from the previous ID, so earlier IDs never
 * fill the window) and no negation there; the sentence must not be a question. The IDs joined
 * to it only by LIST_SEPARATOR share its verdict ("aprueba WAY-8, WAY-9 y WAY-12"). Anything
 * else ends the list ("pero", "luego", another prefix, a range "a", a bare space), and the next
 * ID needs its own verb. Code, inline code and quoted lines are ignored. Ambiguity means no order.
 */
export function extractOrders(prompt: string, idPrefix: string): string[] {
  const text = personText(prompt);
  const found = new Set<string>();
  // The ID is matched case-insensitively ("aprueba way-5") and stored in its canonical form.
  const idRe = new RegExp(`\\b${idPrefix}-([1-9]\\d{0,8})\\b`, 'gi');
  for (const sentence of text.split(/(?<=[.!?¡¿\n])/)) {
    if (/[¿?]/.test(sentence)) continue;
    let previousEnd = 0;
    let previousOrdered: boolean | null = null;
    for (const match of sentence.matchAll(idRe)) {
      const between = sentence.slice(previousEnd, match.index);
      let ordered: boolean;
      if (previousOrdered !== null && LIST_SEPARATOR.test(between)) {
        ordered = previousOrdered;
      } else {
        const words = between.toLowerCase().split(/[^\p{L}'’]+/u).filter(Boolean);
        // Each window is judged on its own: a verb inside it and no negation inside it.
        const orders = (window: string[], verbs: readonly string[]) => {
          const joined = window.join(' ');
          const negated = NEGATIONS.some((n) => (n.includes(' ') ? joined.includes(n) : window.includes(n)));
          return !negated && window.some((w) => verbs.includes(w));
        };
        ordered = orders(words.slice(-WINDOW), APPROVAL_VERBS) || orders(words.slice(-STRONG_WINDOW), STRONG_VERBS);
      }
      if (ordered) found.add(`${idPrefix}-${match[1]}`);
      previousEnd = (match.index ?? 0) + match[0].length;
      previousOrdered = ordered;
    }
  }
  return found.size > MAX_ORDER_IDS ? [] : [...found];
}

/** What the person wrote, without code blocks, inline code, quoted lines or invisible characters. */
function personText(prompt: string): string {
  return prompt
    .normalize('NFKC')
    .replace(/[​-‏‪-‮⁠-⁤﻿]/g, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('>'))
    .join('\n');
}

/**
 * Closed phrases that order registering the current repository. A bare «sí» is not enough: the
 * hook must see the person's own words, so the agent cannot answer for them.
 */
const REGISTER_PHRASES = [
  /\bregistra\s+(?:este|el)\s+(?:proyecto|repo|repositorio)\b/u,
  /\bregister\s+(?:this|the)\s+(?:project|repo|repository)\b/u,
];

/** Same exclusions as extractOrders: not a question, no negation right before, not code or quotes. */
export function extractRegisterOrder(prompt: string): boolean {
  return findPhrase(prompt, REGISTER_PHRASES) !== -1;
}

/** Index of the first phrase found in an order-like sentence, or -1. */
function findPhrase(prompt: string, phrases: RegExp[]): number {
  for (const sentence of personText(prompt).toLowerCase().split(/(?<=[.!?¡¿\n])/)) {
    if (/[¿?]/.test(sentence)) continue;
    for (const [i, re] of phrases.entries()) {
      const match = re.exec(sentence);
      if (!match) continue;
      const words = sentence.slice(0, match.index).split(/[^\p{L}'’]+/u).filter(Boolean).slice(-WINDOW);
      const joined = words.join(' ');
      if (NEGATIONS.some((n) => (n.includes(' ') ? joined.includes(n) : words.includes(n)))) continue;
      return i;
    }
  }
  return -1;
}

/**
 * One phrase that names Wayfinder, so it never means the consumer project's own website («abre la
 * web» did, in a real session). Opening Wayfinder always includes the network (webHost).
 */
const WEB_PHRASES = [/\babre\s+wayfinder\b/u, /\bopen\s+wayfinder\b/u];

export function extractWebOrder(prompt: string): boolean {
  return findPhrase(prompt, WEB_PHRASES) !== -1;
}

const WEB_FILE = 'web-orders.json';
/** Per consumer root (rootKey): when the person last ordered to open Wayfinder. */
type WebOrders = Record<string, number>;

/** Called only by the UserPromptSubmit hook; same rules as recordRegisterOrder. */
export function recordWebOrder(home: string, key: string, ordered: boolean, nowMs: number): void {
  withLock(home, () => {
    const all = readState<WebOrders>(home, WEB_FILE);
    if (!ordered && !(key in all)) return;
    if (ordered) all[key] = nowMs;
    else delete all[key];
    writeState(home, WEB_FILE, all);
  });
}

/** Must run inside the store lock. A fresh order is consumed: it authorises a single opening. */
export function takeWebOrderUnlocked(home: string, key: string, nowMs: number): boolean {
  const all = readState<WebOrders>(home, WEB_FILE);
  const ts = all[key];
  if (typeof ts !== 'number') return false;
  delete all[key];
  writeState(home, WEB_FILE, all);
  return ts <= nowMs && nowMs - ts <= ORDER_TTL_MS;
}

const REGISTER_FILE = 'register-orders.json';
/** Per repository root (rootKey): when the person last ordered to register it. */
type RegisterOrders = Record<string, number>;

/**
 * Called only by the UserPromptSubmit hook, in an unregistered repository. Only the latest message
 * counts: a message without the order clears an earlier one. Without a data folder nothing is written.
 */
export function recordRegisterOrder(home: string, key: string, ordered: boolean, nowMs: number): void {
  withLock(home, () => {
    const all = readState<RegisterOrders>(home, REGISTER_FILE);
    if (!ordered && !(key in all)) return;
    if (ordered) all[key] = nowMs;
    else delete all[key];
    writeState(home, REGISTER_FILE, all);
  });
}

/** Must run inside the store lock. A fresh order is consumed: it authorises a single registration. */
export function takeRegisterOrderUnlocked(home: string, key: string, nowMs: number): boolean {
  const all = readState<RegisterOrders>(home, REGISTER_FILE);
  const ts = all[key];
  if (typeof ts !== 'number') return false;
  delete all[key];
  writeState(home, REGISTER_FILE, all);
  return ts <= nowMs && nowMs - ts <= ORDER_TTL_MS;
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
