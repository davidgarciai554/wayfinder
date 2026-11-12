import { WayfinderError, type Warning } from './errors.ts';
import { initHome, isInitialized } from './init.ts';
import { takeRegisterOrderUnlocked } from './mentions.ts';
import { assertNewProject, createProjectUnlocked, type NewProject, type Project } from './project.ts';
import { rootKey } from './resolve.ts';
import { readState, writeState } from './state.ts';
import { withLock } from './sync.ts';
import type { Lang } from '../i18n/index.ts';

const DECLINED_FILE = 'declined.json';
/** Per repository root (rootKey): when the person said no to registering it. */
type Declined = Record<string, string>;

/**
 * Registers the repository only with a fresh, unconsumed register order that the UserPromptSubmit
 * hook took from the person's own message. The order is checked, consumed and the project created
 * inside one lock (no TOCTOU), like approveByChat. A declined root is forgotten on registration.
 */
export function registerByOrder(home: string, root: string, input: NewProject, nowMs: number): { project: Project; warnings: Warning[] } {
  assertNewProject(input);
  // The hook creates the data folder when it records the order, so without a folder there is no order.
  if (!isInitialized(home)) throw new WayfinderError('register.noOrder', {});
  const key = rootKey(root);
  return withLock(home, () => {
    if (!takeRegisterOrderUnlocked(home, key, nowMs)) throw new WayfinderError('register.noOrder', {});
    const result = createProjectUnlocked(home, input);
    const declined = readState<Declined>(home, DECLINED_FILE);
    if (key in declined) {
      delete declined[key];
      writeState(home, DECLINED_FILE, declined);
    }
    return result;
  });
}

/**
 * Remembers that the person does not want this repository in Wayfinder, so SessionStart stops
 * asking. It only silences a question (no project data, no commit), so it needs no order. Without a
 * data folder it creates one first: `.state/` cannot exist before `init` (init.ts refuses a
 * non-empty folder that is not a home).
 */
export function declineRegistration(home: string, root: string, nowIso: string, lang?: Lang): Warning[] {
  const { warnings } = initHome(home, { lang });
  withLock(home, () => {
    const declined = readState<Declined>(home, DECLINED_FILE);
    const key = rootKey(root);
    if (key in declined) return;
    declined[key] = nowIso;
    writeState(home, DECLINED_FILE, declined);
  });
  return warnings;
}

/** Read without the lock: a stale answer only means asking once more or once less. */
export function isDeclined(home: string, root: string): boolean {
  return rootKey(root) in readState<Declined>(home, DECLINED_FILE);
}
