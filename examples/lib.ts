/**
 * Shared utilities for examples
 */

import { homedir } from "node:os";
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from "@mariozechner/pi-coding-agent";

export const PI_AGENT_DIR = `${homedir()}/.pi/agent`;

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
