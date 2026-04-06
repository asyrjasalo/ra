import { describe, expect, test } from "bun:test";
import { spawn } from "bun";

describe("ra CLI", () => {
	let portCounter = 31000;

	async function runCli(
		args: string[],
	): Promise<{ stdout: string; exitCode: number }> {
		const proc = spawn({
			cmd: ["bun", "run", "src/cli.ts", ...args],
			stdout: "pipe",
			stderr: "inherit",
		});

		// Read output for up to 3 seconds
		const chunks: string[] = [];
		const reader = proc.stdout.getReader();

		const timeoutPromise = new Promise<void>((resolve) =>
			setTimeout(resolve, 3000),
		);
		const readPromise = (async () => {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(new TextDecoder().decode(value));
			}
		})();

		await Promise.race([readPromise, timeoutPromise]);
		reader.releaseLock();

		// Force kill with SIGTERM
		proc.kill("SIGTERM");
		const exitCode = await proc.exited;

		return { stdout: chunks.join(""), exitCode };
	}

	test("shows help with no arguments", async () => {
		const { stdout, exitCode } = await runCli([]);
		expect(exitCode).toBe(0);
		expect(stdout.includes("ra - Pi Coding Agent CLI")).toBe(true);
	});

	test("serve command starts HTTP server", async () => {
		const port = portCounter++;
		const { stdout } = await runCli(["serve", `--port=${port}`]);
		expect(stdout.includes(`Starting HTTP API server on port ${port}`)).toBe(
			true,
		);
		expect(stdout.includes(`Server running at http://localhost:${port}`)).toBe(
			true,
		);
	});

	test("serve command with explicit port flag", async () => {
		const port = portCounter++;
		const { stdout } = await runCli(["serve", "--port", String(port)]);
		expect(stdout.includes(`Starting HTTP API server on port ${port}`)).toBe(
			true,
		);
		expect(stdout.includes(`Server running at http://localhost:${port}`)).toBe(
			true,
		);
	});

	test("mcp command starts MCP server", async () => {
		const { stdout } = await runCli(["mcp"]);
		expect(stdout.includes("Starting MCP server on stdio")).toBe(true);
	});
});
