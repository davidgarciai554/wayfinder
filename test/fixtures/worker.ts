// Child process used by the concurrency tests: performs one store operation and exits.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sleepSync, withLock } from '../../src/store/sync.ts';
import { createTask, logProgress, updateTask } from '../../src/store/tasks.ts';
import { reviewTask } from '../../src/store/review.ts';
import { createError } from '../../src/store/error-records.ts';

const [mode, home, slug, arg, extra] = process.argv.slice(2);
if (mode === 'create') {
  const { task } = createTask(home, slug, { title: `Concurrente ${arg}` }, 'mcp');
  process.stdout.write(task.id);
} else if (mode === 'review') {
  reviewTask(home, slug, arg);
  process.stdout.write(arg);
} else if (mode === 'progress') {
  logProgress(home, slug, arg, `Avance ${extra}`);
  process.stdout.write(extra);
} else if (mode === 'block') {
  logProgress(home, slug, arg, `Bloqueo ${extra}`, { blockers: `Motivo ${extra}` }, undefined, true);
  process.stdout.write(extra);
} else if (mode === 'error') {
  const { error } = createError(home, slug, { title: `Error concurrente ${extra}`, task: arg, context: `Contexto ${extra}` });
  process.stdout.write(error.id);
} else if (mode === 'update') {
  updateTask(home, slug, arg, { body: `Descripción ${extra}` });
  process.stdout.write(extra);
} else if (mode === 'hold') {
  // Takes the lock, says so in the signals folder (arg) and holds it until told to release it.
  withLock(home, () => {
    writeFileSync(join(arg, 'acquired'), '');
    const started = Date.now();
    while (!existsSync(join(arg, 'release')) && Date.now() - started < 30_000) sleepSync(20);
  });
} else if (mode === 'depend') {
  try {
    updateTask(home, slug, arg, { depends_on: [extra] });
    process.stdout.write('ok');
  } catch (error) {
    process.stdout.write((error as { key?: string }).key ?? 'error');
  }
}
