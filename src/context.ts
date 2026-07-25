/**
 * Bridge between commander and the API client: turn the parsed global flags into
 * a ready-to-use client, and wrap command actions so an API error is reported as
 * a clean message (never a raw stack trace) with a non-zero exit code.
 */

import type { Command } from 'commander';
import { GlytosClient, GlytosError } from './client.js';
import { resolveConfig, type CliFlags } from './config.js';

export interface GlobalFlags extends CliFlags {
  json?: boolean;
}

/** Read the global options merged across the command hierarchy. */
export function globalFlags(command: Command): GlobalFlags {
  return command.optsWithGlobals() as GlobalFlags;
}

/** Build an authenticated client from the resolved settings, or fail clearly. */
export function makeClient(flags: GlobalFlags): GlytosClient {
  const config = resolveConfig(flags);
  if (!config.apiKey) {
    throw new CliError(
      'No API key found. Run `glytos login`, set GLYTOS_API_KEY, or pass --api-key.',
    );
  }
  return new GlytosClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    environment: config.environment,
  });
}

/** A user-facing error whose message is printed as-is (no stack trace). */
export class CliError extends Error {}

/**
 * Wrap an async command action. Any thrown error is turned into a clean stderr
 * message and `process.exitCode = 1`; API errors surface their `code`/`status`.
 */
export function action<A extends unknown[]>(
  fn: (...args: A) => Promise<void>,
): (...args: A) => Promise<void> {
  return async (...args: A) => {
    try {
      await fn(...args);
    } catch (err) {
      reportError(err);
      process.exitCode = 1;
    }
  };
}

function reportError(err: unknown): void {
  if (err instanceof GlytosError) {
    const rid = err.requestId ? ` (request ${err.requestId})` : '';
    process.stderr.write(`Error [${err.code}] ${err.status}: ${err.message}${rid}\n`);
    return;
  }
  if (err instanceof CliError) {
    process.stderr.write(`Error: ${err.message}\n`);
    return;
  }
  if (err instanceof Error) {
    process.stderr.write(`Error: ${err.message}\n`);
    return;
  }
  process.stderr.write(`Error: ${String(err)}\n`);
}
