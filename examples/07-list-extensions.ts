/**
 * 07 - List Installed Extensions
 * 
 * Lists all extensions loaded from ~/.pi/agent
 * 
 * Run: bun run examples/07-list-extensions.ts
 */

import { createSession } from "./lib.js";

async function main() {
  console.log("\n=== List Extensions ===\n");

  const { extensionsResult } = await createSession();



  const extensions = extensionsResult.extensions;
  
  if (extensions.length === 0) {
    console.log("No extensions installed.");
    return;
  }

  const sorted = [...extensions].sort((a, b) =>
    (a.sourceInfo.source.split(":").pop() || a.path).localeCompare(b.sourceInfo.source.split(":").pop() || b.path)
  );

  for (const ext of sorted) {
    const name = ext.sourceInfo.source.split(":").pop() || ext.path;
    console.log(`  - ${name}`);
  }

  console.log(`\n${extensions.length} extensions installed.`);

  if (extensionsResult.errors.length > 0) {
    const failed = extensionsResult.errors.map(e => {
      // Extract package name from path (handles node_modules/package or node_modules/package/src)
      const match = e.path.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
      const name = match ? match[1] : e.path.split("/").pop();
      return { name, error: e.error };
    }).sort((a, b) => a.name.localeCompare(b.name));

    console.log(`\n${extensionsResult.errors.length} extension(s) failed to load:`);
    for (const { name, error } of failed) {
      console.log(`  - ${name}`);
      console.log(`    ${error}`);
    }
  }
}

main().catch(console.error);
