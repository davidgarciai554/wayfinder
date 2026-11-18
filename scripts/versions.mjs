// One version number: package.json is the source (the build reads it), and the lockfile and the
// plugin manifest must repeat it. Pure and free of side effects on import, so check-dist.mjs and
// the tests can both use it.

/**
 * @param {{ pkg: any, lock: any, plugin: any }} manifests parsed package.json, package-lock.json
 *   and plugin/.claude-plugin/plugin.json
 * @returns {string[]} one message per file and field that disagrees with package.json; empty when all match
 */
export function versionProblems({ pkg, lock, plugin }) {
  const expected = pkg?.version;
  if (typeof expected !== 'string' || expected === '') return ['package.json: version is missing'];
  const found = [
    ['package-lock.json', 'version', lock?.version],
    ['package-lock.json', 'packages[""].version', lock?.packages?.['']?.version],
    ['plugin/.claude-plugin/plugin.json', 'version', plugin?.version],
  ];
  return found.flatMap(([file, field, value]) =>
    value === undefined
      ? [`${file}: ${field} is missing`]
      : value !== expected
        ? [`${file}: ${field} is "${value}" but package.json version is "${expected}"`]
        : [],
  );
}
