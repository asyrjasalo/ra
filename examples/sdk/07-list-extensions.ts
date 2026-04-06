/**
 * 07 - List Installed Extensions
 *
 * Lists all extensions loaded from ~/.pi/agent
 *
 * Run: bun run examples/07-list-extensions.ts
 */

import { createSession } from './lib.js';

function getPackageName(ext: {
  path: string;
  sourceInfo: { source: string };
}): string {
  const source = ext.sourceInfo.source;

  // npm:pi-context -> pi-context
  // git:github.com/user/repo -> github.com/user/repo
  const sourceParts = source.split(':');
  const sourceName = sourceParts[sourceParts.length - 1] ?? source;

  // For npm packages (no slashes or starts with @), use source name directly
  if (!sourceName.includes('/') || sourceName.startsWith('@')) {
    return sourceName;
  }

  // For git URLs, extract just the repo name (last part after /)
  // e.g., github.com/davebcn87/pi-autoresearch -> pi-autoresearch
  const parts = sourceName.split('/');
  return parts[parts.length - 1] || sourceName;
}

async function main() {
  console.log('\n=== List Extensions ===\n');

  const { extensionsResult } = await createSession();

  // Group by package name
  const byPackage = new Map<string, typeof extensionsResult.extensions>();
  for (const ext of extensionsResult.extensions) {
    const pkg = getPackageName(ext);
    if (!byPackage.has(pkg)) byPackage.set(pkg, []);
    byPackage.get(pkg)?.push(ext);
  }

  const extensions = Array.from(byPackage.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  if (extensions.length === 0) {
    console.log('No extensions installed.');
    return;
  }

  for (const [pkg, exts] of extensions) {
    if (exts.length > 1) {
      console.log(`  - ${pkg} (${exts.length} extensions)`);
    } else {
      console.log(`  - ${pkg}`);
    }
  }

  console.log(`\n${extensions.length} extensions installed.`);

  if (extensionsResult.errors.length > 0) {
    const failed = extensionsResult.errors
      .map((e) => {
        // Extract package name from path (handles node_modules/package or node_modules/package/src)
        const match = e.path.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
        const name = match ? match[1] : e.path.split('/').pop();
        return { name, error: e.error };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log(
      `\n${extensionsResult.errors.length} extension(s) failed to load:`,
    );
    for (const { name, error } of failed) {
      console.log(`  - ${name}`);
      console.log(`    ${error}`);
    }
  }
}

main().catch(console.error);
