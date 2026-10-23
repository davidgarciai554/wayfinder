// Starts `wayfinder serve` over deterministic test data for the Playwright suite.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setGitRunner } from '../src/store/git.ts';
import { initHome } from '../src/store/init.ts';
import { createProject } from '../src/store/project.ts';
import { appendLog } from '../src/store/log.ts';
import { createTask, logProgress, setStatus, updateTask } from '../src/store/tasks.ts';
import { startServer } from '../src/server.ts';
import { createError, noteError, resolveError } from '../src/store/error-records.ts';
import { e2eGitOffFlag, e2eHome, e2eKeyFile, E2E_PORTS } from './paths.ts';

const lang = process.env.WAYFINDER_LANG === 'en' ? 'en' : 'es';
const E2E_HOME = e2eHome(lang);
const E2E_PORT = E2E_PORTS[lang];
rmSync(E2E_HOME, { recursive: true, force: true, maxRetries: 5 });
initHome(E2E_HOME);
createProject(E2E_HOME, { slug: 'wayfinder', name: 'wayfinder', idPrefix: 'WF', repo: 'github.com/example/wayfinder', body: '## Qué es\n\nGestor de tareas en Markdown.\n\n![Tablero vacío](assets/20261021-board.png)\n' });
createProject(E2E_HOME, { slug: 'demo-app', name: 'demo-app', idPrefix: 'DEM', localPath: 'D:/demo-app' });

const clock = () => new Date('2026-10-21T10:00:00');
const plan = () => true;
const mk = (title: string, body = '', priority = 'medium', actor: 'mcp' | 'web' = 'web') =>
  createTask(E2E_HOME, 'wayfinder', { title, body, priority }, actor, clock).task.id;

mk('Exportar la bitácora a PDF', 'Propuesta de Claude.', 'medium', 'mcp');
const xss = mk('<img src=x onerror=window.__xss=1>', '<script>window.__xss=2</script>\n\n[enlace](javascript:window.__xss=3)\n\n# Encabezado', 'low', 'mcp');
const todo = mk('Añadir filtro por prioridad al tablero', 'Permitir filtrar el tablero.\n\n- Accesible con teclado\n\n![Filtro desplegado](../assets/20261021-filter.png)', 'high');
mk('Revisar contraste del modo oscuro', '', 'low');
const progress = mk('Galería de capturas por proyecto', 'En curso.', 'high');
updateTask(E2E_HOME, 'wayfinder', progress, { plan: 'Planes/2026-10-21-galeria.md' }, { planExists: plan, clock });
setStatus(E2E_HOME, 'wayfinder', progress, 'in-progress', 'mcp', { planExists: plan, clock });
for (let i = 1; i <= 12; i++) {
  const id = mk(`Tarea hecha número ${i}`);
  setStatus(E2E_HOME, 'wayfinder', id, 'in-progress', 'mcp', { trivial: true, note: 'trivial', clock });
  setStatus(E2E_HOME, 'wayfinder', id, 'done', 'mcp', { clock });
}
const discarded = mk('Idea descartada');
setStatus(E2E_HOME, 'wayfinder', discarded, 'discarded', 'web', { clock });
appendLog(E2E_HOME, 'wayfinder', 'Implementado el filtro; tests en verde.', { taskId: todo, clock });
// Hostile text in a history entry is rendered as data, like descriptions.
logProgress(E2E_HOME, 'wayfinder', xss, '<img src=x onerror=window.__xss=4>\n[x](javascript:window.__xss=5)', {}, clock);

// Approved-by-chat and risk flags, written as the store would leave them.
const tasksDir = join(E2E_HOME, 'projects', 'wayfinder', 'tasks');
const chat = mk('Optimizar el tiempo de build', 'Mejorar el build.', 'medium');
const chatFile = join(tasksDir, `${chat}-optimizar-el-tiempo-de-build.md`);
writeFileSync(chatFile, readFileSync(chatFile, 'utf8').replace('plan: ""', 'plan: ""\napprovedVia: chat\nriskAcknowledged: true'));
writeFileSync(join(tasksDir, 'WF-99-rota.md'), '---\ntitle: Sin id\n---\n');

const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201d6e8a0e20000000049454e44ae426082', 'hex');
mkdirSync(join(E2E_HOME, 'projects', 'wayfinder', 'assets'), { recursive: true });
writeFileSync(join(E2E_HOME, 'projects', 'wayfinder', 'assets', '20261021-board.png'), png);
writeFileSync(join(E2E_HOME, 'projects', 'wayfinder', 'assets', '20261021-filter.png'), png);

// Write specs (increment 5) use their own project so the read specs keep their counts.
createProject(E2E_HOME, { slug: 'escritura', name: 'escritura', idPrefix: 'ESC', localPath: 'D:/escritura' });
for (const title of ['Propuesta para aprobar', 'Propuesta para descartar', 'Propuesta en conflicto', 'Propuesta sin git']) {
  createTask(E2E_HOME, 'escritura', { title, body: 'Idea de Claude.' }, 'mcp', clock);
}

// History plan: a task with progress entries on two days and a task written before histories existed.
createProject(E2E_HOME, { slug: 'historial', name: 'historial', idPrefix: 'HIS', localPath: 'D:/historial' });
const memory = createTask(E2E_HOME, 'historial', { title: 'Filtro con memoria', body: 'Descripción de la tarea.' }, 'web', () => new Date('2026-10-19T08:00:00')).task.id;
setStatus(E2E_HOME, 'historial', memory, 'in-progress', 'mcp', { trivial: true, note: 'trivial', clock: () => new Date('2026-10-19T08:05:00') });
logProgress(E2E_HOME, 'historial', memory, 'Avanzamos en el filtro: primer paso.', { files: 'web/app.js' }, () => new Date('2026-10-20T09:15:00'));
logProgress(E2E_HOME, 'historial', memory, 'Avanzamos en el filtro: tests en verde.', { next: 'revisión visual' }, () => new Date('2026-10-21T11:30:00'));
const legacy = createTask(E2E_HOME, 'historial', { title: 'Tarea antigua sin historial', body: 'Escrita antes del historial.' }, 'web', clock).task;
const legacyFile = join(E2E_HOME, legacy.file);
writeFileSync(legacyFile, readFileSync(legacyFile, 'utf8').replace(/\n## Historial[\s\S]*$/, '\n'));

// Error records plan: its own project, so the counts of the other specs do not change.
createProject(E2E_HOME, { slug: 'errores', name: 'errores', idPrefix: 'FAL', localPath: 'D:/errores' });
const build = createTask(E2E_HOME, 'errores', { title: 'Compilar el bundle' }, 'web', clock).task.id;
createTask(E2E_HOME, 'errores', { title: 'Tarea sin errores' }, 'web', clock);
const at = (minute: number) => () => new Date(2026, 9, 21, 12, minute);
createError(E2E_HOME, 'errores', {
  title: 'El bundle falla con require dinámico <img src=x onerror=window.__xss=6>',
  task: build,
  context: 'npm run build en Windows.\n\n<script>window.__xss=7</script>',
  output: 'Error: Dynamic require of "process" is not supported\n    at node_modules/yaml/dist/compose/composer.js:12:5 una línea muy larga que obliga a desplazar el bloque en horizontal',
  files: ['scripts/build.mjs'],
}, at(0));
noteError(E2E_HOME, 'errores', 'ERR-1', 'Recurrencia: también en Node 24.', at(1));
for (let i = 2; i <= 13; i++) {
  createError(E2E_HOME, 'errores', { title: `Error resuelto número ${i}`, task: build, context: 'Contexto.' }, at(i));
  resolveError(E2E_HOME, 'errores', `ERR-${i}`, { solution: 'Corregido.', validation: 'npm test' }, { clock: at(i) });
}

// Real git, unless a spec switches it "off" with the flag file (git missing → 200 with a warning).
rmSync(e2eGitOffFlag(lang), { force: true });
setGitRunner((args) => {
  if (existsSync(e2eGitOffFlag(lang))) return { ok: false, missing: true, stdout: '', stderr: 'spawn git ENOENT' };
  try {
    return { ok: true, missing: false, stdout: execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }), stderr: '' };
  } catch (error) {
    return { ok: false, missing: false, stdout: '', stderr: String((error as Error).message) };
  }
});

const webDir = fileURLToPath(new URL('../web', import.meta.url));
const server = await startServer({ home: E2E_HOME, lang, port: E2E_PORT, webDir });
writeFileSync(e2eKeyFile(lang), server.token);
console.log(`e2e server ${server.url}`);
