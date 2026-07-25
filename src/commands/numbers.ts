import { Command } from 'commander';
import { action, CliError, globalFlags, makeClient } from '../context.js';
import { asRows, info, printJson, printObject, printTable } from '../output.js';

const NUMBER_COLUMNS: [string, string][] = [
  ['uuid', 'UUID'],
  ['e164', 'NUMBER'],
  ['provider', 'PROVIDER'],
  ['country', 'COUNTRY'],
];

const SEARCH_COLUMNS: [string, string][] = [
  ['e164', 'NUMBER'],
  ['provider', 'PROVIDER'],
  ['country', 'COUNTRY'],
  ['region', 'REGION'],
];

export function registerNumbers(program: Command): void {
  const numbers = program.command('numbers').description('Search, import, and release phone numbers');

  numbers
    .command('search')
    .description('Search carrier inventory for available numbers')
    .requiredOption('--country <country>', 'ISO country code (e.g. US)')
    .option('--area-code <code>', 'Restrict to an area/prefix code')
    .action(
      action(async (opts: { country: string; areaCode?: string }, command: Command) => {
        const flags = globalFlags(command);
        const query: Record<string, string> = { country: opts.country };
        if (opts.areaCode) query.area_code = opts.areaCode;
        const data = await makeClient(flags).phoneNumbers.search(query);
        if (flags.json) return printJson(data);
        printTable(asRows(data), SEARCH_COLUMNS);
      }),
    );

  numbers
    .command('list')
    .description('List the numbers on your account')
    .action(
      action(async (_opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).phoneNumbers.list();
        if (flags.json) return printJson(data);
        printTable(asRows(data), NUMBER_COLUMNS);
      }),
    );

  numbers
    .command('import')
    .description('Connect a number you already own at a carrier')
    .requiredOption('--e164 <e164>', 'The number to import in E.164 format')
    .option('--provider <provider>', 'Carrier (twilio/telnyx/signalwire/plivo/sip)')
    .option('--provider-sid <sid>', 'The number id at the carrier')
    .option('--workflow <uuid>', 'Assign the number to this agent')
    .option('--credentials <json>', 'Carrier credentials as a JSON object')
    .action(
      action(
        async (
          opts: {
            e164: string;
            provider?: string;
            providerSid?: string;
            workflow?: string;
            credentials?: string;
          },
          command: Command,
        ) => {
          const flags = globalFlags(command);
          const body: Record<string, unknown> = { e164: opts.e164 };
          if (opts.provider) body.provider = opts.provider;
          if (opts.providerSid) body.provider_sid = opts.providerSid;
          if (opts.workflow) body.workflow_uuid = opts.workflow;
          if (opts.credentials) {
            try {
              body.credentials = JSON.parse(opts.credentials);
            } catch {
              throw new CliError('--credentials must be a valid JSON object.');
            }
          }
          const data = await makeClient(flags).phoneNumbers.importNumber(body);
          flags.json ? printJson(data) : printObject(data);
        },
      ),
    );

  numbers
    .command('release <uuid>')
    .description('Release (delete) a number')
    .action(
      action(async (uuid: string, _opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).phoneNumbers.release(uuid);
        if (flags.json) return printJson(data ?? { released: uuid });
        info(`Released number ${uuid}`);
      }),
    );
}
