import { WayfinderError, type Warning } from './errors.ts';
import { commitPaths } from './git.ts';
import { appendLogUnlocked, assertNoSecrets, taskLink } from './log.ts';
import { consumeOrderUnlocked, getOrderUnlocked, ORDER_TTL_MS } from './mentions.ts';
import { contentHash, consumeReviewUnlocked, getReviewUnlocked } from './review.ts';
import { withLock } from './sync.ts';
import { readTask, writeTaskUnlocked, type Task } from './tasks.ts';
import { isoLocal, systemClock, type Clock } from './time.ts';
import { checkTransition } from './transitions.ts';

export const MAX_QUOTE = 500;

export interface ChatApproval {
  userQuote: string;
  verdict: 'clean' | 'suspicious';
  reasons?: string;
}

const squash = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * proposed → todo on an explicit chat order. Everything is checked inside one lock (no TOCTOU):
 * an unconsumed, fresh order for this ID written by the UserPromptSubmit hook; a review whose
 * hash matches the current content; and, when the review found signals or the verdict is
 * "suspicious", an order given after the review (the second confirmation). The model's verdict can
 * only make this stricter: signals computed by the server always require the second confirmation.
 */
export function approveByChat(
  home: string,
  slug: string,
  id: string,
  input: ChatApproval,
  options: { clock?: Clock } = {},
): { task: Task; warnings: Warning[]; riskAcknowledged: boolean } {
  const clock = options.clock ?? systemClock;
  const quote = input.userQuote.replace(/\s+/g, ' ').trim();
  if (quote === '' || quote.length > MAX_QUOTE || !quote.includes(id)) {
    throw new WayfinderError('chat.invalidQuote', { id, max: MAX_QUOTE });
  }
  assertNoSecrets(quote);
  if (input.verdict !== 'clean' && input.verdict !== 'suspicious') throw new WayfinderError('chat.invalidVerdict', {});
  const reasons = input.reasons?.replace(/\s+/g, ' ').trim() ?? '';
  if (input.verdict === 'suspicious' && reasons === '') throw new WayfinderError('chat.reasonsRequired', {});
  if (reasons.length > MAX_QUOTE) throw new WayfinderError('chat.reasonsTooLong', { max: MAX_QUOTE });
  if (reasons) assertNoSecrets(reasons);

  return withLock(home, () => {
    const now = clock();
    const task = readTask(home, slug, id);
    checkTransition('chat', task.status, 'todo');
    if (task.origin !== 'claude') throw new WayfinderError('chat.originNotAllowed', { origin: task.origin });
    const content = squash(`${task.title}\n${task.body}`);
    if (content.includes(squash(quote))) throw new WayfinderError('chat.quoteFromContent', {});

    const order = getOrderUnlocked(home, slug, id);
    if (!order) throw new WayfinderError('chat.noOrder', { id });
    if (now.getTime() - order.ts > ORDER_TTL_MS) throw new WayfinderError('chat.orderExpired', { id });

    const review = getReviewUnlocked(home, slug, id);
    if (!review) throw new WayfinderError('chat.noReview', { id });
    if (review.hash !== contentHash(task)) throw new WayfinderError('chat.reviewStale', { id });

    const needsSecond = review.signals.length > 0 || input.verdict === 'suspicious';
    if (needsSecond && !(order.ts > review.ts)) {
      throw new WayfinderError('chat.secondConfirmationRequired', {
        id,
        signals: review.signals.length ? review.signals.join(', ') : '—',
      });
    }

    task.status = 'todo';
    task.approvedVia = 'chat';
    if (needsSecond) task.riskAcknowledged = true;
    task.updated = isoLocal(now);
    writeTaskUnlocked(home, task);

    const lines = [
      'status: proposed -> todo',
      'approved-via: chat',
      `quote: "${truncate(quote, 200)}"`,
      `review: ${input.verdict}`,
      ...(review.signals.length ? [`signals: ${review.signals.join(', ')}`] : []),
      ...(reasons ? [`reasons: ${truncate(reasons, 300)}`] : []),
      ...(needsSecond ? ['risk-acknowledged: true'] : []),
      '',
      taskLink(slug, id, task.title),
    ];
    const logFile = appendLogUnlocked(home, slug, lines.join('\n'), id, () => now);
    consumeOrderUnlocked(home, slug, id);
    consumeReviewUnlocked(home, slug, id);

    const trailers = ['Approved-via: chat', `Review: ${input.verdict}`, ...(needsSecond ? ['Risk-acknowledged: true'] : [])];
    const warnings = commitPaths(home, [task.file, logFile], `wf: approve ${id}`, trailers);
    return { task, warnings, riskAcknowledged: needsSecond };
  });
}
