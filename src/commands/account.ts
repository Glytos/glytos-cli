import { Command } from 'commander';
import { action, globalFlags, makeClient } from '../context.js';
import { asRows, info, printJson, printObject, printTable } from '../output.js';

const TRUNK_COLUMNS: [string, string][] = [
  ['uuid', 'UUID'],
  ['name', 'NAME'],
  ['sip_server', 'SERVER'],
  ['status', 'STATUS'],
  ['number_count', 'NUMBERS'],
];

interface Balance {
  balance?: number;
  currency?: string;
}

interface TrunkTest {
  ok?: boolean;
  detail?: string;
  reachable?: boolean;
}

export function registerAccount(program: Command): void {
  program
    .command('balance')
    .description('Show the credit balance')
    .action(
      action(async (_opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = (await makeClient(flags).billing.credits()) as Balance;
        if (flags.json) return printJson(data);
        info(`${data.balance ?? 0} ${data.currency ?? ''}`.trim());
      }),
    );

  program
    .command('usage')
    .description('Show aggregate usage and cost')
    .action(
      action(async (_opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).billing.usage();
        flags.json ? printJson(data) : printObject(data);
      }),
    );

  const trunks = program
    .command('trunks')
    .description('Check the SIP trunks carrying your numbers');

  trunks
    .command('list')
    .description('List your trunks and their registration state')
    .action(
      action(async (_opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).sipTrunks.list();
        if (flags.json) return printJson(data);
        printTable(asRows(data), TRUNK_COLUMNS);
      }),
    );

  trunks
    .command('test <trunkUuid>')
    .description('Re-check a trunk against its carrier now')
    .action(
      action(async (trunkUuid: string, _opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = (await makeClient(flags).sipTrunks.test(trunkUuid)) as TrunkTest;
        if (flags.json) {
          printJson(data);
        } else {
          // Reachable is worth saying out loud: a carrier that refused the
          // credentials is a different problem from one that never answered, and
          // only the first is worth changing the password over.
          const reach = data.reachable === false ? ' (carrier did not answer)' : '';
          info(`${data.ok ? 'ok' : 'not ok'}: ${data.detail ?? ''}${reach}`);
        }
        if (data.ok === false) process.exitCode = 1;
      }),
    );
}
