#!/usr/bin/env node
/**
 * @glytos/cli - the official command-line interface for the Glytos platform.
 *
 * Credentials resolve from (first match wins): a --api-key flag, the
 * GLYTOS_API_KEY environment variable, or ~/.glytos/config.json written by
 * `glytos login`. The base URL and environment resolve the same way from
 * --base-url / GLYTOS_BASE_URL and --environment / GLYTOS_ENVIRONMENT.
 */

import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { registerAuth } from './commands/auth.js';
import { registerAgents } from './commands/agents.js';
import { registerChat } from './commands/chat.js';
import { registerCalls } from './commands/calls.js';
import { registerNumbers } from './commands/numbers.js';
import { registerCampaigns } from './commands/campaigns.js';
import { registerDnc } from './commands/dnc.js';
import { registerSessions } from './commands/sessions.js';
import { registerWebhooks } from './commands/webhooks.js';
import { registerSuites } from './commands/suites.js';
import { registerAccount } from './commands/account.js';

// Read from the manifest rather than repeating it here: `npm version` only edits
// package.json, so a constant silently reports the previous release forever.
// Resolves the same from src/ and from dist/, both one level under the manifest.
export const VERSION = (
  createRequire(import.meta.url)('../package.json') as { version: string }
).version;

export function buildProgram(): Command {
  const program = new Command();

  program
    .name('glytos')
    .description('Command-line interface for the Glytos voice-AI platform')
    .version(VERSION, '-v, --version', 'Print the CLI version')
    .option('--api-key <key>', 'API key (overrides GLYTOS_API_KEY and the saved config)')
    .option('--base-url <url>', 'API base URL (default https://api.glytos.com/api/v1)')
    .option('--environment <env>', 'Environment: dev, staging, prod, or an env uuid')
    .option('--json', 'Print raw JSON instead of formatted tables')
    .showHelpAfterError();

  registerAuth(program);
  registerAgents(program);
  registerChat(program);
  registerCalls(program);
  registerNumbers(program);
  registerCampaigns(program);
  registerDnc(program);
  registerSessions(program);
  registerWebhooks(program);
  registerSuites(program);
  registerAccount(program);

  return program;
}

async function main(): Promise<void> {
  await buildProgram().parseAsync(process.argv);
}

/**
 * True only when this file is the process entry point. Comparing real (symlink-
 * resolved) paths keeps the npm `.bin` symlink working while preventing the CLI
 * from auto-running when imported (e.g. by the test suite).
 */
function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main().catch((err) => {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}
