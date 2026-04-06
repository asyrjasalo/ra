/** Path segments Biome ignores (see biome.json files.includes). */
const BIOME_IGNORED_SEGMENTS = new Set(['.pi'])

function isBiomeIgnoredPath(filePath) {
  return filePath
    .replace(/\\/g, '/')
    .split('/')
    .some((segment) => BIOME_IGNORED_SEGMENTS.has(segment))
}

export default {
  '*.{ts,js,json}': (files) => {
    const toLint = files.filter((f) => !isBiomeIgnoredPath(f))
    if (toLint.length === 0) return []
    return `biome check --write ${toLint.join(' ')}`
  },
}
