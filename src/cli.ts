#!/usr/bin/env bun

/**
 * ra CLI - Command-line interface
 *
 * Usage:
 *   ra serve          Start HTTP API server
 *   ra mcp            Start MCP server (stdio)
 *   ra --help         Show help
 */

import { parseArgs } from "node:util";

function showHelp() {
	console.log(
		`
ra - CLI

Usage:
  ra serve          Start HTTP API server
  ra mcp            Start MCP server (stdio)
  ra --help         Show this help

Options:
  --port <n>        Port for HTTP server (default: 3000)
  --help            Show this help
`.trim(),
	);
}

async function main() {
	const args = process.argv.slice(2);

	// Parse flags before subcommand
	const { values } = parseArgs({
		args,
		options: {
			port: { type: "string", default: "3000" },
		},
		allowPositionals: true,
	});

	const port = parseInt(values.port as string, 10) || 3000;

	const positional = args.find((a) => !a.startsWith("-")) || "";

	switch (positional) {
		case "serve": {
			// Dynamically import to allow tree-shaking and clear error messages
			const { startServer } = await import("./http-server.js");
			console.log(`Starting HTTP API server on port ${port}...`);
			await startServer(port);
			console.log(`Server running at http://localhost:${port}`);
			break;
		}

		case "mcp":
			// Run MCP server (blocks on stdio) - just import and let it run
			console.log("Starting MCP server on stdio...");
			await import("./mcp-server.js");
			break;

		default:
			showHelp();
			process.exit(0);
	}
}

main().catch((err) => {
	console.error("Error:", err.message);
	process.exit(1);
});
