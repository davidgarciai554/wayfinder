import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type E2ELang = 'es' | 'en';

/** Throwaway data folders shared by the fixture servers and the specs (never the real ~/.wayfinder). */
export const e2eHome = (lang: E2ELang) => join(tmpdir(), `wayfinder-e2e-home-${lang}`);
export const E2E_PORTS: Record<E2ELang, number> = { es: 4555, en: 4556 };
export const E2E_HOME = e2eHome('es');
export const E2E_PORT = E2E_PORTS.es;
