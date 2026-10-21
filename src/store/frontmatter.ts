import { parse, stringify } from 'yaml';

export interface Parsed {
  data: Record<string, unknown>;
  body: string;
}

/** Splits `---` frontmatter from the body. Tolerates BOM and CRLF; returns null when malformed. */
export function parseFrontmatter(raw: string): Parsed | { error: string } {
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!text.startsWith('---\n')) return { error: 'missing frontmatter' };
  const end = text.indexOf('\n---', 4);
  if (end === -1) return { error: 'unterminated frontmatter' };
  const after = text.slice(end + 4);
  if (after !== '' && !after.startsWith('\n')) return { error: 'unterminated frontmatter' };
  let data: unknown;
  try {
    data = parse(text.slice(4, end));
  } catch (error) {
    return { error: `invalid YAML: ${(error as Error).message.split('\n')[0]}` };
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return { error: 'frontmatter is not a mapping' };
  // Leading blank lines are layout, not content: this keeps parse/serialise idempotent.
  return { data: data as Record<string, unknown>, body: after.replace(/^\n+/, '') };
}

/** Serialises with LF and no BOM. Key order and unknown keys of `data` are preserved. */
export function serializeFrontmatter(data: Record<string, unknown>, body: string): string {
  const yaml = stringify(data, { lineWidth: 0 }).trimEnd();
  const content = body.replace(/\r\n?/g, '\n').replace(/^\n+/, '');
  if (content === '') return `---\n${yaml}\n---\n`;
  return `---\n${yaml}\n---\n\n${content}${content.endsWith('\n') ? '' : '\n'}`;
}
