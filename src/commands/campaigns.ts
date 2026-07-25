import { Command } from 'commander';
import { action, CliError, globalFlags, makeClient } from '../context.js';
import { asRows, printJson, printObject, printTable } from '../output.js';

const CAMPAIGN_COLUMNS: [string, string][] = [
  ['uuid', 'UUID'],
  ['name', 'NAME'],
  ['status', 'STATUS'],
];

export function registerCampaigns(program: Command): void {
  const campaigns = program.command('campaigns').description('Manage outbound calling campaigns');

  campaigns
    .command('list')
    .description('List your campaigns')
    .action(
      action(async (_opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).campaigns.list();
        if (flags.json) return printJson(data);
        printTable(asRows(data), CAMPAIGN_COLUMNS);
      }),
    );

  campaigns
    .command('create')
    .description('Create an outbound calling campaign')
    .requiredOption('--name <name>', 'Campaign name')
    .requiredOption('--agent <uuid>', 'Agent (workflow) uuid to run')
    .requiredOption('--from <e164>', 'Caller-ID number in E.164 format')
    .option('--contacts <json>', 'Contacts as a JSON array of objects')
    .action(
      action(
        async (
          opts: { name: string; agent: string; from: string; contacts?: string },
          command: Command,
        ) => {
          const flags = globalFlags(command);
          const body: Record<string, unknown> = {
            name: opts.name,
            workflow_uuid: opts.agent,
            from_number: opts.from,
          };
          if (opts.contacts) {
            try {
              body.contacts = JSON.parse(opts.contacts);
            } catch {
              throw new CliError('--contacts must be a valid JSON array.');
            }
          }
          const data = await makeClient(flags).campaigns.create(body);
          flags.json ? printJson(data) : printObject(data);
        },
      ),
    );

  campaigns
    .command('start <uuid>')
    .description('Start a campaign (begins dialing its contacts)')
    .action(
      action(async (uuid: string, _opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).campaigns.start(uuid);
        flags.json ? printJson(data) : printObject(data);
      }),
    );
}
