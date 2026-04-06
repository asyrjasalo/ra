import type { SimpleGitRejectableFunction } from 'lint-staged';

type ConfigRule = Record<
  string,
  string | string[] | SimpleGitRejectableFunction
>;

/** Path segments Biome ignores (see biome.json files.includes). */
const BIOME_IGNORED_SEGMENTS = new Set(['.pi']);

function isBiomeIgnoredPath(filePath: string): boolean {
  return filePath
    .replace(/\\/g, '/')
    .split('/')
    .some((segment) => BIOME_IGNORED_SEGMENTS.has(segment));
}

const config: ConfigRule = {
  '*.{ts,js,json}': (files: readonly string[]) => {
    const toLint = files.filter((f) => !isBiomeIgnoredPath(f));
    if (toLint.length === 0) return [];
    return `biome check --write ${toLint.join(' ')}`;
  },
  '*.{js,ts,json,md,yaml,yml,toml,css,html}': (files: readonly string[]) => {
    return `secretlint ${files.join(' ')}`;
  },
  '*.md': 'markdownlint-cli2 fix',
  '*.{ts,js,md}': 'cspell lint',
};

export default config;
