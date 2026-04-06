/**
 * Shared utilities for examples
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from "@mariozechner/pi-coding-agent";

// Use project root as cwd so package resolution works correctly
export const PI_AGENT_DIR = join(dirname(import.meta.filename), "..", "..");

export async function createSession() {
  const resourceLoader = new DefaultResourceLoader({
    cwd: PI_AGENT_DIR,
  });

  // Load extensions, skills, etc.
  await resourceLoader.reload();
  const extensionsResult = resourceLoader.getExtensions();
  const skillsResult = resourceLoader.getSkills();

  const { session } = await createAgentSession({
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
  });

  return { session, extensionsResult, skillsResult };
}
