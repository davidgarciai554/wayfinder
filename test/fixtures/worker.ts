// Child process used by the concurrency tests: performs one store operation and exits.
import { createTask } from '../../src/store/tasks.ts';
import { reviewTask } from '../../src/store/review.ts';

const [mode, home, slug, arg] = process.argv.slice(2);
if (mode === 'create') {
  const { task } = createTask(home, slug, { title: `Concurrente ${arg}` }, 'mcp');
  process.stdout.write(task.id);
} else if (mode === 'review') {
  reviewTask(home, slug, arg);
  process.stdout.write(arg);
}
