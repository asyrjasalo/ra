/**
 * Shared utilities for examples
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
  SettingsManager,
} from '@mariozechner/pi-coding-agent';

// Project root (cwd for package resolution)
export const PI_PROJECT_DIR = join(dirname(import.meta.filename), '..', '..');
// Agent directory (where settings, extensions, skills are configured)
export const PI_AGENT_DIR = getAgentDir();

/**
 * Create a SettingsManager that loads packages and defaults from the project's
 * `.pi/settings.json`, ignoring globally installed extensions.
 */
function createProjectOnlySettingsManager(): SettingsManager {
  const projectSettingsPath = join(PI_PROJECT_DIR, '.pi', 'settings.json');
  const sm = SettingsManager.inMemory({}); // empty global

  if (existsSync(projectSettingsPath)) {
    const projectSettings = JSON.parse(
      readFileSync(projectSettingsPath, 'utf8'),
    );
    if (projectSettings.packages) {
      sm.setProjectPackages(projectSettings.packages);
    }
    // Set default provider and model from project settings
    if (projectSettings.defaultProvider) {
      sm.setDefaultProvider(projectSettings.defaultProvider);
    }
    if (projectSettings.defaultModel) {
      sm.setDefaultModel(projectSettings.defaultModel);
    }
  }

  return sm;
}

export async function createSession() {
  const settingsManager = createProjectOnlySettingsManager();

  const resourceLoader = new DefaultResourceLoader({
    cwd: PI_PROJECT_DIR,
    agentDir: PI_AGENT_DIR,
    settingsManager,
  });

  // Load extensions, skills, etc.
  await resourceLoader.reload();
  const extensionsResult = resourceLoader.getExtensions();
  const skillsResult = resourceLoader.getSkills();

  const { session } = await createAgentSession({
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
    settingsManager,
  });

  return { session, extensionsResult, skillsResult };
}
