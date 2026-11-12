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
 * Extracts the IDs the person explicitly orders to approve: an approval verb at most WINDOW
 * words before the ID, no negation in that window, and the sentence is not a question.
 * Code blocks, inline code and quoted lines are ignored. Ambiguity means no order (fail closed).
 */
export function extractOrders(prompt: string, idPrefix: string): string[] {
  const text = personText(prompt);
  const found = new Set<string>();
  // The ID is matched case-insensitively ("aprueba way-5") and stored in its canonical form.
  const idRe = new RegExp(`\\b${idPrefix}-([1-9]\\d{0,8})\\b`, 'gi');
  for (const sentence of text.split(/(?<=[.!?¡¿\n])/)) {
    if (/[¿?]/.test(sentence)) continue;
    for (const match of sentence.matchAll(idRe)) {
      const before = sentence.slice(0, match.index).toLowerCase();
      const words = before.split(/[^\p{L}'’]+/u).filter(Boolean).slice(-WINDOW);
      const joined = words.join(' ');
      if (NEGATIONS.some((n) => (n.includes(' ') ? joined.includes(n) : words.includes(n)))) continue;
      if (words.some((w) => APPROVAL_VERBS.includes(w))) found.add(`${idPrefix}-${match[1]}`);
    }
  }
  return [...found];
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
