import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
  SettingsManager,
} from '@mariozechner/pi-coding-agent';

// Skip tests that require API calls when no API key is available
const hasApiKey = () =>
  !!process.env.MINIMAX_API_KEY ||
  !!process.env.OPENAI_API_KEY ||
  !!process.env.ANTHROPIC_API_KEY ||
  !!process.env.GEMINI_API_KEY ||
  !!process.env.ZAI_API_KEY;

// Conditional test that skips when condition is true
function apiTest(name: string, fn: () => Promise<void>, timeout?: number) {
  if (!hasApiKey()) {
    test.skip(name, fn, timeout);
  } else {
    test(name, fn, timeout);
  }
}

const PI_PROJECT_DIR = join(dirname(import.meta.filename), '..');
const PI_AGENT_DIR = getAgentDir();

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

async function createSession() {
  const settingsManager = createProjectOnlySettingsManager();

  const resourceLoader = new DefaultResourceLoader({
    cwd: PI_PROJECT_DIR,
    agentDir: PI_AGENT_DIR,
    settingsManager,
  });

  await resourceLoader.reload();
  const extensionsResult = resourceLoader.getExtensions();

  const { session } = await createAgentSession({
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
    settingsManager,
  });

  return { session, extensionsResult };
}

describe('Extensions Loading', () => {
  apiTest('extensions are loaded from project settings', async () => {
    const { extensionsResult } = await createSession();

    expect(extensionsResult.extensions.length).toBeGreaterThan(0);
    expect(extensionsResult.errors.length).toBe(0);
  });

  apiTest('pi-prompt-enhancer extension is loaded', async () => {
    const { extensionsResult } = await createSession();

    const enhancerExt = extensionsResult.extensions.find((ext) =>
      ext.path.includes('pi-prompt-enhancer'),
    );

    expect(enhancerExt).toBeDefined();
  });

  apiTest('/enhance command is registered in extension', async () => {
    const { extensionsResult } = await createSession();

    // Find the pi-prompt-enhancer extension and check it has the enhance command
    const enhancerExt = extensionsResult.extensions.find((ext) =>
      ext.path.includes('pi-prompt-enhancer'),
    );

    expect(enhancerExt).toBeDefined();
    expect(enhancerExt?.commands.has('enhance')).toBe(true);

    const enhanceCmd = enhancerExt?.commands.get('enhance');
    expect(enhanceCmd).toBeDefined();
    expect(enhanceCmd?.description).toBeDefined();
  });
});
