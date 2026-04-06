/**
 * 05 - Execute a Skill Example
 *
 * Demonstrates how to use skills in the SDK. This example uses the
 * eval-audit skill from ~/.agents/skills to audit an eval pipeline.
 *
 * Run: bun run examples/05-execute-skill.ts
 */

import { createSession } from './lib.js';

async function main() {
  console.log('\n=== Execute Skill Example ===\n');

  const { session, skillsResult } = await createSession();

  // Log available skills from ~/.agents/skills
  console.log('Available skills:');
  skillsResult?.skills.forEach((skill) => {
    console.log(`  - ${skill.name}: ${skill.description?.slice(0, 60)}...`);
  });
  console.log();

  // Subscribe to events
  session.subscribe((event) => {
    if (
      event.type === 'message_update' &&
      event.assistantMessageEvent.type === 'text_delta'
    ) {
      process.stdout.write(event.assistantMessageEvent.delta);
    }
  });

  // Execute the eval-audit skill by prompting the agent to use it
  // Skills are automatically loaded into the system prompt when relevant
  console.log('--- Using eval-audit skill ---\n');

  await session.prompt(
    `Use the eval-audit skill to audit your eval pipeline. 
    
Since we don't have a real eval pipeline, use the eval-audit skill's "No Eval Infrastructure" 
section as a guide and explain:
1. What steps would you take first
2. Why error analysis is the foundation
3. How to know when you need evaluators vs. when to keep iterating on traces`,
  );

  console.log('\n\n--- Skill execution complete ---\n');

  session.dispose();
}

main().catch(console.error);
