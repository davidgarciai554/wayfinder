import { WayfinderError } from './errors.ts';

export const STATUSES = ['proposed', 'todo', 'in-progress', 'done', 'discarded'] as const;
export type Status = (typeof STATUSES)[number];
export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const ORIGINS = ['user', 'claude', 'routine'] as const;
export type Origin = (typeof ORIGINS)[number];

/** web = the person in the web UI; mcp = Claude; chat = Claude acting on an explicit chat order. */
export type Actor = 'web' | 'mcp' | 'chat';

export interface Rule {
  needsNote?: boolean;
  planRule?: boolean;
}

const TABLE: Record<Actor, Partial<Record<Status, Partial<Record<Status, Rule>>>>> = {
  web: {
    proposed: { todo: {}, discarded: {} },
    todo: { discarded: {} },
    'in-progress': { discarded: {} },
  },
  mcp: {
    proposed: { discarded: { needsNote: true } },
    todo: { 'in-progress': { planRule: true }, discarded: { needsNote: true } },
    'in-progress': { done: {}, todo: { needsNote: true }, discarded: { needsNote: true } },
  },
  chat: {
    proposed: { todo: {} },
  },
};

export function isStatus(value: unknown): value is Status {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}

export function validTargets(actor: Actor, from: Status): Status[] {
  return Object.keys(TABLE[actor][from] ?? {}) as Status[];
}

export function checkTransition(actor: Actor, from: Status, to: Status): Rule {
  const rule = TABLE[actor][from]?.[to];
  if (!rule) {
    const valid = validTargets(actor, from);
    throw new WayfinderError('store.invalidTransition', { from, to, valid: valid.length ? valid.join(', ') : '—' });
  }
  return rule;
}
