/**
 * Credential + configuration resolution for the CLI.
 *
 * Resolution precedence for every setting (first defined wins):
 *   1. an explicit command-line flag (--api-key / --base-url / --environment)
 *   2. an environment variable (GLYTOS_API_KEY / GLYTOS_BASE_URL / GLYTOS_ENVIRONMENT)
 *   3. the config file written by `glytos login` (~/.glytos/config.json)
 *
 * The config file is written with 0600 permissions so the API key is only
 * readable by the current user.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';

export const DEFAULT_BASE_URL = 'https://api.glytos.com/api/v1';

export interface StoredConfig {
  apiKey?: string;
  baseUrl?: string;
  environment?: string;
}

/** Flags parsed off the command line (global options). */
export interface CliFlags {
  apiKey?: string;
  baseUrl?: string;
  environment?: string;
}

/** Fully resolved settings ready to construct a client. */
export interface ResolvedConfig {
  apiKey?: string;
  baseUrl: string;
  environment?: string;
}

export function configDir(): string {
  return join(homedir(), '.glytos');
}

export function configPath(): string {
  return join(configDir(), 'config.json');
}

/** Read the persisted config file, or `{}` when absent or unreadable. */
export function loadConfig(): StoredConfig {
  const path = configPath();
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as StoredConfig;
    return {};
  } catch {
    return {};
  }
}

/** Persist config to `~/.glytos/config.json` with owner-only (0600) permissions. */
export function saveConfig(config: StoredConfig): string {
  const dir = configDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = configPath();
  const body = JSON.stringify(config, null, 2) + '\n';
  writeFileSync(path, body, { mode: 0o600 });
  // writeFileSync only applies the mode when creating the file; enforce it in
  // case the file already existed with looser permissions.
  try {
    chmodSync(path, 0o600);
  } catch {
    // chmod is a best-effort hardening step; ignore where unsupported.
  }
  return path;
}

/** Remove the persisted config file. Returns true if a file was deleted. */
export function clearConfig(): boolean {
  const path = configPath();
  if (!existsSync(path)) return false;
  rmSync(path);
  return true;
}

function firstDefined(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value !== undefined && value !== '') return value;
  }
  return undefined;
}

/**
 * Merge flags, environment variables, and the stored config into the effective
 * settings used to build a client.
 */
export function resolveConfig(flags: CliFlags, env: NodeJS.ProcessEnv = process.env): ResolvedConfig {
  const stored = loadConfig();
  return {
    apiKey: firstDefined(flags.apiKey, env.GLYTOS_API_KEY, stored.apiKey),
    baseUrl:
      firstDefined(flags.baseUrl, env.GLYTOS_BASE_URL, stored.baseUrl) ?? DEFAULT_BASE_URL,
    environment: firstDefined(flags.environment, env.GLYTOS_ENVIRONMENT, stored.environment),
  };
}
