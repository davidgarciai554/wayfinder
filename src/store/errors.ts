import type { MessageKey } from '../i18n/index.ts';

export type MessageVars = Record<string, string | number>;

/** A user-facing failure. The edges (CLI, MCP, web) translate `key` with `vars`. */
export class WayfinderError extends Error {
  readonly key: MessageKey;
  readonly vars: MessageVars;

  constructor(key: MessageKey, vars: MessageVars = {}) {
    super(`${key} ${JSON.stringify(vars)}`);
    this.name = 'WayfinderError';
    this.key = key;
    this.vars = vars;
  }
}

export interface Warning {
  key: MessageKey;
  vars: MessageVars;
}
