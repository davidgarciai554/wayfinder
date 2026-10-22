// Text that reaches the model from task data: one line, no control or invisible characters.

// Control chars, zero-width and bidi controls, soft hyphen, variation selectors and Unicode tags.
const INVISIBLE = /[\u0000-\u001F\u007F­​-‏‪-‮⁠-⁩︀-️﻿]|[\u{E0000}-\u{E007F}]/gu;

/** Collapses `text` to a single clean line of at most `max` characters. */
export function flatten(text: string, max: number): string {
  const flat = text.replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** Keeps data from closing or opening an UNTRUSTED block (whose delimiters are <<< and >>>). */
export function neutralize(text: string): string {
  return text.replace(/<<</g, '< < <').replace(/>>>/g, '> > >');
}
