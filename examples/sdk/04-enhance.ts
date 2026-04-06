/**
 * 04 - Prompt Enhancement via /enhance Command
 *
 * Uses the /enhance command from pi-prompt-enhancer extension
 *
 * Run: bun run examples/04-enhance.ts
 */

import { createSession } from './lib.js';

async function main() {
  console.log('\n=== /enhance Command Example ===\n');

  const { session } = await createSession();

  // Bind extensions to initialize the extension runner
  await session.bindExtensions({});

  // Get the extension runner
  const runner = session.extensionRunner;
  if (!runner) {
    console.error('No extension runner');
    session.dispose();
    return;
  }

  // Get the /enhance command
  const enhanceCmd = runner.getCommand('enhance');
  if (!enhanceCmd) {
    console.error('/enhance command not found');
    session.dispose();
    return;
  }

  const prompt = 'fix the login bug';
  console.log(`Original: "${prompt}"`);

  // Execute the command
  const ctx = runner.createCommandContext();
  ctx.hasUI = true; // Required by /enhance command

  // Capture the enhanced result
  let enhancedResult: string | undefined;
  ctx.ui.setEditorText = (text: string) => {
    enhancedResult = text;
  };

  await enhanceCmd.handler(prompt, ctx);

  console.log(`Enhanced: "${enhancedResult}"`);
  console.log('\n');

  session.dispose();
}

main().catch(console.error);
