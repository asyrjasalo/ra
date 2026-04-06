/**
 * Shared utilities for examples
 */

import { join } from "node:path";
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from "@mariozechner/pi-coding-agent";

export const PI_AGENT_DIR = join(import.meta.dir, "..", ".pi");

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
