// Starts `wayfinder serve` over deterministic test data for the Playwright suite.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initHome } from '../src/store/init.ts';
import { createProject } from '../src/store/project.ts';
import { appendLog } from '../src/store/log.ts';
import { createTask, setStatus, updateTask } from '../src/store/tasks.ts';
import { startServer } from '../src/server.ts';
import { e2eHome, E2E_PORTS } from './paths.ts';

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
updateTask(E2E_HOME, 'wayfinder', progress, { plan: 'Planes/2026-10-21-galeria.md' }, { planExists: plan });
setStatus(E2E_HOME, 'wayfinder', progress, 'in-progress', 'mcp', { planExists: plan });
for (let i = 1; i <= 12; i++) {
  const id = mk(`Tarea hecha número ${i}`);
  setStatus(E2E_HOME, 'wayfinder', id, 'in-progress', 'mcp', { trivial: true, note: 'trivial' });
  setStatus(E2E_HOME, 'wayfinder', id, 'done', 'mcp');
}
const discarded = mk('Idea descartada');
setStatus(E2E_HOME, 'wayfinder', discarded, 'discarded', 'web');
appendLog(E2E_HOME, 'wayfinder', 'Implementado el filtro; tests en verde.', { taskId: todo, clock });
void xss;

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

const webDir = fileURLToPath(new URL('../web', import.meta.url));
const server = await startServer({ home: E2E_HOME, lang, port: E2E_PORT, webDir });
console.log(`e2e server ${server.url}`);
