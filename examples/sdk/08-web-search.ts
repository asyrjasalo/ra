/**
 * 08 - Web Search Example using pi-web-access Extension
 *
 * Demonstrates using the web_search tool from the pi-web-access extension.
 * This extension provides web_search, code_search, and fetch_content tools.
 *
 * Run: bun run examples/08-web-search.ts
 *
 * Note: Some providers require API keys. See ~/.pi/web-search.json for configuration.
 */

import { createSession } from './lib.js';

async function main() {
  console.log('\n=== Web Search via pi-web-access Extension ===\n');

  const { session, extensionsResult } = await createSession();

  // Show which extensions are loaded
  console.log(`Extensions loaded: ${extensionsResult.extensions.length}`);
  const webAccessExt = extensionsResult.extensions.find(
    (e) => e.path.includes('pi-web-access') || e.path.includes('web-access'),
  );
  console.log(`pi-web-access loaded: ${!!webAccessExt}\n`);

  if (extensionsResult.errors.length > 0) {
    const webErrors = extensionsResult.errors.filter(
      (e) => e.path.includes('pi-web-access') || e.path.includes('web-access'),
    );
    if (webErrors.length > 0) {
      console.log('pi-web-access errors:');
      for (const e of webErrors) {
        console.log(`  - ${e.error}`);
      }
    }
  }

  // Bind extensions to initialize the extension runner
  await session.bindExtensions({});

  // Get the extension runner
  const runner = session.extensionRunner;
  if (!runner) {
    console.error('No extension runner');
    session.dispose();
    return;
  }

  // Get all registered tools
  const allTools = runner.getAllRegisteredTools();
  console.log('\nAvailable extension tools (search/fetch related):');
  allTools?.forEach((tool) => {
    const name = tool.definition?.name;
    if (name && (name.includes('search') || name.includes('fetch'))) {
      console.log(`  - ${name}`);
    }
  });

  // Get the web_search tool
  const webSearchTool = runner.getToolDefinition('web_search');
  if (!webSearchTool) {
    console.error(
      '\nweb_search tool not found. Make sure pi-web-access is installed:',
    );
    console.error('  pi install npm:pi-web-access');
    session.dispose();
    return;
  }

  console.log('\n--- Executing web_search tool directly ---\n');

  // Create a context for tool execution
  const ctx = runner.createContext();

  // Mock UI context (hasUI = false for SDK mode)
  ctx.hasUI = false;

  // Execute the tool directly
  const result = await webSearchTool.execute(
    'test-call-id', // tool call ID
    {
      query: 'TypeScript 5.4 latest features',
      numResults: 5,
      workflow: 'none', // Skip the curator UI
    },
    undefined, // abort signal
    undefined, // onUpdate callback
    ctx, // extension context
  );

  console.log('Search Results:');
  console.log('='.repeat(50));

  if (result.content && result.content.length > 0) {
    for (const item of result.content) {
      if (item.type === 'text') {
        console.log(item.text);
      }
    }
  } else {
    console.log('(no content in result)');
  }

  if (result.details) {
    console.log('\nDetails:', JSON.stringify(result.details, null, 2));
  }

  console.log('\n--- Tool Execution Complete ---\n');

  // Also demonstrate fetch_content tool
  console.log('\n--- Fetching Content from URL ---\n');

  const fetchContentTool = runner.getToolDefinition('fetch_content');
  if (fetchContentTool) {
    const fetchResult = await fetchContentTool.execute(
      'fetch-call-id',
      {
        url: 'https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-4.html',
        prompt: 'What are the top 3 new features in TypeScript 5.4?',
      },
      undefined,
      undefined,
      ctx,
    );

    console.log('Fetched Content Summary:');
    console.log('='.repeat(50));
    if (fetchResult.content && fetchResult.content.length > 0) {
      const text = fetchResult.content
        .map((c) => (c.type === 'text' ? c.text : ''))
        .join('\n');
      console.log(text.slice(0, 1500) + (text.length > 1500 ? '\n...' : ''));
    }
  } else {
    console.log('fetch_content tool not available');
  }

  console.log('\n--- All Examples Complete ---\n');

  session.dispose();
}

main().catch(console.error);
