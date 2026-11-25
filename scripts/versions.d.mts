// Types of versions.mjs for the tests: tsconfig.json does not set allowJs.
export function versionProblems(manifests: { pkg: unknown; lock: unknown; plugin: unknown }): string[];
