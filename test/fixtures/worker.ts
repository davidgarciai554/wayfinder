// Child process used by the concurrency tests: performs one store operation and exits.
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
} else if (mode === 'error') {
  const { error } = createError(home, slug, { title: `Error concurrente ${extra}`, task: arg, context: `Contexto ${extra}` });
  process.stdout.write(error.id);
} else if (mode === 'update') {
  updateTask(home, slug, arg, { body: `Descripción ${extra}` });
  process.stdout.write(extra);
}
