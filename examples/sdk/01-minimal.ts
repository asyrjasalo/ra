/**
 * 01 - Minimal Example
 *
 * Uses user settings, extensions, skills from ~/.pi/agent
 *
 * Run: bun run examples/01-minimal.ts
 */

import { createSession } from './lib.js';

async function main() {
  console.log('\n=== Minimal Example ===\n');

  const { session } = await createSession();

  session.subscribe((event) => {
    if (
      event.type === 'message_update' &&
      event.assistantMessageEvent.type === 'text_delta'
    ) {
      process.stdout.write(event.assistantMessageEvent.delta);
    }
  });

  await session.prompt('What files are in the current directory?');
  console.log('\n');

  session.dispose();
}

main().catch(console.error);
