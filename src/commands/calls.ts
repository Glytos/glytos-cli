import { Command } from 'commander';
import { action, globalFlags, makeClient } from '../context.js';
import { asRows, printJson, printObject, printTable } from '../output.js';

const CALL_COLUMNS: [string, string][] = [
  ['call_uuid', 'UUID'],
  ['status', 'STATUS'],
  ['to_number', 'TO'],
  ['from_number', 'FROM'],
  ['agent_name', 'AGENT'],
];

export function registerCalls(program: Command): void {
  const calls = program.command('calls').description('Start and inspect calls');

  calls
    .command('create')
    .description('Start an outbound phone call to a saved agent')
    .requiredOption('--to <e164>', 'Destination phone number in E.164 format')
    .requiredOption('--agent <uuid>', 'Agent (workflow) uuid to run the call')
    .option('--from <e164>', 'Caller-ID number (defaults to a provisioned number)')
    .action(
      action(async (opts: { to: string; agent: string; from?: string }, command: Command) => {
        const flags = globalFlags(command);
        const body: Record<string, unknown> = {
          transport: 'phone',
          workflow_uuid: opts.agent,
          to_number: opts.to,
        };
        if (opts.from) body.from_number = opts.from;
        const data = await makeClient(flags).calls.create(body);
        flags.json ? printJson(data) : printObject(data);
      }),
    );

  calls
    .command('list')
    .description('List calls')
    .action(
      action(async (_opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).calls.list();
        if (flags.json) return printJson(data);
        printTable(asRows(data), CALL_COLUMNS);
      }),
    );

  calls
    .command('get <uuid>')
    .description('Retrieve a call by uuid')
    .action(
      action(async (uuid: string, _opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).calls.retrieve(uuid);
        flags.json ? printJson(data) : printObject(data);
      }),
    );
}
