import { Command } from 'commander';
import { action, CliError, globalFlags, makeClient } from '../context.js';
import { asRows, printJson, printObject, printTable } from '../output.js';

const WEBHOOK_COLUMNS: [string, string][] = [
  ['id', 'ID'],
  ['url', 'URL'],
  ['events', 'EVENTS'],
  ['is_active', 'ACTIVE'],
];

export function registerWebhooks(program: Command): void {
  const webhooks = program.command('webhooks').description('Manage webhook endpoints');

  webhooks
    .command('list')
    .description('List your webhook endpoints')
    .action(
      action(async (_opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).webhooks.list();
        if (flags.json) return printJson(data);
        printTable(asRows(data), WEBHOOK_COLUMNS);
      }),
    );

  webhooks
    .command('create')
    .description('Create a webhook endpoint subscribed to a set of events')
    .requiredOption('--url <url>', 'The endpoint URL to deliver events to')
    .requiredOption('--events <events>', 'Comma-separated event types (e.g. call.completed,call.failed)')
    .action(
      action(async (opts: { url: string; events: string }, command: Command) => {
        const flags = globalFlags(command);
        const events = opts.events
          .split(',')
          .map((event) => event.trim())
          .filter((event) => event.length > 0);
        if (events.length === 0) throw new CliError('At least one event is required.');
        const data = await makeClient(flags).webhooks.create({ url: opts.url, events });
        flags.json ? printJson(data) : printObject(data);
      }),
    );
}
