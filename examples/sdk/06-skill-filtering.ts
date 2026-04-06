/**
 * 06 - Skill Filtering & Custom Skills Example
 *
 * Demonstrates how to filter skills, add custom skills, or replace them entirely.
 *
 * Run: bun run examples/06-skill-filtering.ts
 */

import {
	createAgentSession,
	createSyntheticSourceInfo,
	DefaultResourceLoader,
	SessionManager,
} from "@mariozechner/pi-coding-agent";

// Custom skill defined inline
const customSkill = {
	name: "my-custom-skill",
	description: "My custom skill for specialized tasks",
	filePath: "/virtual/SKILL.md",
	baseDir: "/virtual",
	sourceInfo: createSyntheticSourceInfo("/virtual/SKILL.md", { source: "sdk" }),
	disableModelInvocation: false,
};

async function main() {
	console.log("\n=== Skill Filtering Example ===\n");

	// Create a resource loader with skill filtering
	const loader = new DefaultResourceLoader({
		skillsOverride: (current) => {
			// Filter to only include skills with "browser" or "search" in name
			// or add our custom skill
			const filtered = current.skills.filter(
				(s) => s.name.includes("browser") || s.name.includes("search"),
			);

			console.log(
				"Filtered skills:",
				filtered.map((s) => s.name),
			);
			console.log("Adding custom skill:", customSkill.name);

			return {
				skills: [...filtered, customSkill as any],
				diagnostics: current.diagnostics,
			};
		},
	});

	await loader.reload();

	// Get discovered skills
	const { skills: allSkills, diagnostics } = loader.getSkills();
	console.log("\nDiscovered skills after filtering:");
	allSkills.forEach((skill) => {
		console.log(`  - ${skill.name}`);
	});

	if (diagnostics.length > 0) {
		console.log("\nDiagnostics:", diagnostics);
	}

	// Create session with filtered skills
	const { session } = await createAgentSession({
		resourceLoader: loader,
		sessionManager: SessionManager.inMemory(),
	});

	console.log("\n--- Session created with filtered skills ---\n");

	session.subscribe((event) => {
		if (
			event.type === "message_update" &&
			event.assistantMessageEvent.type === "text_delta"
		) {
			process.stdout.write(event.assistantMessageEvent.delta);
		}
	});

	await session.prompt("What skills do you have available?");

	console.log("\n");

	session.dispose();
}

main().catch(console.error);
