import { Command } from 'commander';
import { action, CliError, globalFlags } from '../context.js';
import {
  clearConfig,
  configPath,
  DEFAULT_BASE_URL,
  loadConfig,
  saveConfig,
  type StoredConfig,
} from '../config.js';
import { prompt, promptHidden } from '../prompt.js';
import { info } from '../output.js';

export function registerAuth(program: Command): void {
  program
    .command('login')
    .description('Save your API key, base URL, and environment to ~/.glytos/config.json')
    .action(
      action(async (_opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const existing = loadConfig();

        // Prefer values already supplied via flags/env; otherwise prompt.
        let apiKey = flags.apiKey;
        if (!apiKey) apiKey = await promptHidden('API key');
        if (!apiKey) throw new CliError('An API key is required.');

        const baseUrl =
          flags.baseUrl ??
          (await prompt('Base URL', existing.baseUrl ?? DEFAULT_BASE_URL));

        const environmentAnswer =
          flags.environment ??
          (await prompt('Environment (dev/staging/prod, blank for default)', existing.environment));

        const config: StoredConfig = { apiKey, baseUrl };
        if (environmentAnswer) config.environment = environmentAnswer;

        const path = saveConfig(config);
        info(`Saved credentials to ${path}`);
      }),
    );

  program
    .command('logout')
    .description('Remove the saved credentials from ~/.glytos/config.json')
    .action(
      action(async () => {
        const removed = clearConfig();
        info(removed ? `Removed ${configPath()}` : 'No saved credentials to remove.');
      }),
    );
}
