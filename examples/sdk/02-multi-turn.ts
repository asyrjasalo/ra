/**
 * 02 - Multi-Turn Conversation Example
 *
 * Demonstrates context preservation across turns
 *
 * Run: bun run examples/02-multi-turn.ts
 */

import { createSession } from "./lib.js";

async function main() {
	console.log("\n=== Multi-Turn Example ===\n");

	const { session } = await createSession();

	session.subscribe((event) => {
		if (
			event.type === "message_update" &&
			event.assistantMessageEvent.type === "text_delta"
		) {
			process.stdout.write(event.assistantMessageEvent.delta);
		}
	});

	await session.prompt("Remember my favorite color is blue");
	console.log("\n--- First turn complete ---\n");

	await session.prompt("What is my favorite color?");
	console.log("\n");

	session.dispose();
}

main().catch(console.error);
