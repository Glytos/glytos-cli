import { readFile } from 'node:fs/promises';
import { Command } from 'commander';
import { action, CliError, globalFlags, makeClient } from '../context.js';
import { asRows, info, printJson, printObject, printTable } from '../output.js';

const ENTRY_COLUMNS: [string, string][] = [
  ['phone', 'PHONE'],
  ['source', 'SOURCE'],
  ['scope', 'SCOPE'],
  ['reason', 'REASON'],
  ['created_at', 'ADDED'],
];

/**
 * Read a list of numbers, one per line. Blank lines and `#` comments are skipped
 * so a file kept by hand does not have to be pristine.
 */
async function readNumbers(path: string): Promise<string[]> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    throw new CliError(`Could not read ${path}.`);
  }
  const numbers = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
  if (numbers.length === 0) {
    throw new CliError(`${path} held no numbers.`);
  }
  return numbers;
}

export function registerDnc(program: Command): void {
  const dnc = program
    .command('dnc')
    .description('Manage the numbers your organization must not call');

  dnc
    .command('list')
    .description('List suppressed numbers, newest first')
    .option('--search <phone>', 'Find one number, in any spelling')
    .option('--limit <n>', 'How many to return', (value) => Number(value))
    .option('--offset <n>', 'How many to skip', (value) => Number(value))
    .action(
      action(
        async (opts: { search?: string; limit?: number; offset?: number }, command: Command) => {
          const flags = globalFlags(command);
          const query: Record<string, string> = {};
          if (opts.search) query.search = opts.search;
          if (opts.limit !== undefined) query.limit = String(opts.limit);
          if (opts.offset !== undefined) query.offset = String(opts.offset);
          const data = (await makeClient(flags).dnc.list(query)) as { items?: unknown };
          if (flags.json) return printJson(data);
          printTable(asRows(data.items ?? data), ENTRY_COLUMNS);
        },
      ),
    );

  dnc
    .command('add <phone>')
    .description('Suppress a number, so no outbound call reaches it')
    .option('--reason <reason>', 'Why the number was suppressed')
    .action(
      action(async (phone: string, opts: { reason?: string }, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).dnc.add({ phone, reason: opts.reason });
        flags.json ? printJson(data) : printObject(data);
      }),
    );

  dnc
    .command('import')
    .description('Suppress many numbers at once, one per line in a text file')
    .requiredOption('--file <path>', 'File of phone numbers, one per line')
    .option('--reason <reason>', 'Why these numbers were suppressed')
    .action(
      action(async (opts: { file: string; reason?: string }, command: Command) => {
        const flags = globalFlags(command);
        const phones = await readNumbers(opts.file);
        const data = await makeClient(flags).dnc.import({ phones, reason: opts.reason });
        flags.json ? printJson(data) : printObject(data);
      }),
    );

  dnc
    .command('scope <phone> <scope>')
    .description('Set how far a suppression reaches: all, or marketing only')
    .action(
      action(async (phone: string, scope: string, _opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        if (scope !== 'all' && scope !== 'marketing') {
          throw new CliError('Scope must be "all" or "marketing".');
        }
        const data = await makeClient(flags).dnc.setScope(phone, scope);
        flags.json ? printJson(data) : printObject(data);
      }),
    );

  dnc
    .command('remove <phone>')
    .description('Take a number off the list, so it can be called again')
    .action(
      action(async (phone: string, _opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).dnc.remove(phone);
        if (flags.json) return printJson(data ?? { removed: phone });
        info(`Removed ${phone} from the do-not-call list`);
      }),
    );
}
