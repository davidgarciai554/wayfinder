import { LANGS, resolveLang, t, type Lang } from './i18n/index.ts';
import { WayfinderError } from './store/errors.ts';
import { initHome } from './store/init.ts';
import { getHome } from './store/paths.ts';
import { runMcp } from './mcp.ts';
import { HOOK_EVENTS, readStdin, runHook } from './hook.ts';
import { startServer } from './server.ts';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Replaced at build time by esbuild; the fallback covers running the sources directly.
declare const __WAYFINDER_VERSION__: string | undefined;
const VERSION = typeof __WAYFINDER_VERSION__ === 'string' ? __WAYFINDER_VERSION__ : '0.0.0-dev';

const COMMANDS = ['init', 'mcp', 'serve', 'hook'] as const;
type Command = (typeof COMMANDS)[number];

export interface Io {
  out: (text: string) => void;
  err: (text: string) => void;
}

const defaultIo: Io = {
  out: (text) => process.stdout.write(`${text}\n`),
  err: (text) => process.stderr.write(`${text}\n`),
};

function help(lang: Lang): string {
  return [
    t(lang, 'cli.usage'),
    '',
    t(lang, 'cli.commands'),
    `  ${t(lang, 'cli.cmd.init')}`,
    `  ${t(lang, 'cli.cmd.mcp')}`,
    `  ${t(lang, 'cli.cmd.serve')}`,
    `  ${t(lang, 'cli.cmd.hook')}`,
    '',
    t(lang, 'cli.options'),
  ].join('\n');
}

function isCommand(value: string): value is Command {
  return (COMMANDS as readonly string[]).includes(value);
}

/** Returns the process exit code. No colour is ever emitted, so NO_COLOR is honoured trivially. */
export async function main(argv: string[], io: Io = defaultIo, env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const lang = resolveLang(env);
  const [command] = argv;

  if (command === undefined || command === '--help' || command === '-h' || command === 'help') {
    io.out(help(lang));
    return 0;
  }
  if (command === '--version' || command === '-v') {
    io.out(VERSION);
    return 0;
  }
  if (!isCommand(command)) {
    io.err(t(lang, 'cli.unknownCommand', { command }));
    return 2;
  }
  try {
    if (command === 'init') return runInit(argv.slice(1), lang, io, env);
    if (command === 'hook') {
      const event = argv[1] ?? '';
      if (!(HOOK_EVENTS as readonly string[]).includes(event)) {
        io.err(t(lang, 'cli.unknownHook', { event, valid: HOOK_EVENTS.join(', ') }));
        return 2;
      }
      return runHook(event, { stdin: readStdin, out: io.out }, env);
    }
    if (command === 'serve') return await runServe(argv.slice(1), lang, io, env);
    if (command === 'mcp') {
      await runMcp(VERSION, env);
      return 0;
    }
  } catch (error) {
    if (error instanceof WayfinderError) {
      io.err(t(lang, 'cli.error', { message: t(lang, error.key, error.vars) }));
      return 1;
    }
    throw error;
  }
  // The remaining subcommands are implemented in later increments of the plan.
  io.err(t(lang, 'cli.notImplemented', { command }));
  return 1;
}

function option(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

function webDir(): string {
  // Bundle: dist/wayfinder.mjs → dist/web. Sources: src/cli.ts → web/.
  const bundled = fileURLToPath(new URL('./web', import.meta.url));
  return existsSync(join(bundled, 'index.html')) ? bundled : fileURLToPath(new URL('../web', import.meta.url));
}

async function runServe(args: string[], lang: Lang, io: Io, env: NodeJS.ProcessEnv): Promise<number> {
  const home = getHome(env);
  if (!existsSync(join(home, 'projects'))) {
    io.err(t(lang, 'cli.error', { message: t(lang, 'serve.notInitialized', { path: home }) }));
    return 1;
  }
  const parsePort = (value: string | undefined, fallback?: number) => {
    if (value === undefined || value === '') return fallback;
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 && n <= 65535 ? n : NaN;
  };
  const port = parsePort(option(args, '--port') ?? env.WAYFINDER_PORT, 4321);
  const publicPort = parsePort(env.WAYFINDER_PUBLIC_PORT);
  if (Number.isNaN(port) || Number.isNaN(publicPort)) {
    io.err(t(lang, 'serve.invalidPort', { value: option(args, '--port') ?? env.WAYFINDER_PORT ?? env.WAYFINDER_PUBLIC_PORT ?? '' }));
    return 2;
  }
  const host = option(args, '--host') ?? '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) io.err(t(lang, 'cli.warning', { message: t(lang, 'serve.nonLoopback', { host }) }));
  const poll = args.includes('--poll') || env.WAYFINDER_POLL === '1';
  const server = await startServer({ home, lang, host, port, publicPort, poll, webDir: webDir() });
  io.out(t(lang, 'serve.listening', { url: server.writeUrl }));
  io.out(t(lang, 'serve.keyNote'));
  const stop = () => {
    void server.close().then(() => process.exit(0));
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  return 0;
}

function runInit(args: string[], lang: Lang, io: Io, env: NodeJS.ProcessEnv): number {
  let chosen: Lang | undefined;
  const langIndex = args.indexOf('--lang');
  if (langIndex !== -1) {
    const value = args[langIndex + 1] ?? '';
    if (!(LANGS as readonly string[]).includes(value)) {
      io.err(t(lang, 'cli.invalidLang', { value }));
      return 2;
    }
    chosen = value as Lang;
  }
  const out = chosen ?? lang;
  const home = getHome(env);
  if (/onedrive/i.test(home)) io.err(t(out, 'cli.warning', { message: t(out, 'init.oneDrive', { path: home }) }));
  const result = initHome(home, { lang: chosen });
  io.out(t(out, result.created ? 'init.created' : 'init.exists', { path: home }));
  for (const w of result.warnings) io.err(t(out, 'cli.warning', { message: t(out, w.key, w.vars) }));
  if (result.secrets.length > 0) {
    io.err(t(out, 'init.secretsFound', { count: result.secrets.length }));
    for (const s of result.secrets) io.err(t(out, 'init.secretItem', s));
  }
  if (result.created) io.out(t(out, 'init.privateReminder'));
  return 0;
}

process.exitCode = await main(process.argv.slice(2));
