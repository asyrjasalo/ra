/**
 * 03 - Read-Only Session Example
 * 
 * Safe mode with only read tools (no edit/write)
 * 
 * Run: bun run examples/03-read-only.ts
 */

import { createSession } from "./lib.js";

async function main() {
  console.log("\n=== Read-Only Example ===\n");

  const { session } = await createSession();

  session.subscribe((event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      process.stdout.write(event.assistantMessageEvent.delta);
    }
  });

  await session.prompt("Search for 'TODO' in this project");
  console.log("\n");

  session.dispose();
}

main().catch(console.error);
