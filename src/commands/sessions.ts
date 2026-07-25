import { Command } from 'commander';
import { action, globalFlags, makeClient } from '../context.js';
import { asRows, printJson, printTable } from '../output.js';

const SESSION_COLUMNS: [string, string][] = [
  ['session_uuid', 'SESSION'],
  ['workflow_uuid', 'AGENT'],
  ['mode', 'MODE'],
  ['status', 'STATUS'],
  ['created_at', 'CREATED'],
];

async function listSessions(command: Command): Promise<void> {
  const flags = globalFlags(command);
  const data = await makeClient(flags).sessions.list();
  if (flags.json) return printJson(data);
  printTable(asRows(data), SESSION_COLUMNS);
}

export function registerSessions(program: Command): void {
  program
    .command('sessions')
    .description('List sessions across your agents')
    .action(action(async (_opts: unknown, command: Command) => listSessions(command)));

  // `logs` is a convenience alias for `sessions`.
  program
    .command('logs')
    .description('Alias for `sessions`: list sessions across your agents')
    .action(action(async (_opts: unknown, command: Command) => listSessions(command)));
}
