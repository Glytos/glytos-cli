import { Command } from 'commander';
import { action, globalFlags, makeClient } from '../context.js';
import { asRows, info, printJson, printTable } from '../output.js';

const SUITE_COLUMNS: [string, string][] = [
  ['uuid', 'UUID'],
  ['name', 'NAME'],
  ['workflow_uuid', 'AGENT'],
];

const RESULT_COLUMNS: [string, string][] = [
  ['name', 'CASE'],
  ['passed', 'PASSED'],
  ['reason', 'REASON'],
];

interface SuiteRun {
  passed?: boolean;
  total?: number;
  passed_count?: number;
  results?: unknown;
}

export function registerSuites(program: Command): void {
  const suites = program
    .command('suites')
    .description('Replay saved conversations against an agent, to catch regressions');

  suites
    .command('list')
    .description('List your test suites')
    .action(
      action(async (_opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).testSuites.list();
        if (flags.json) return printJson(data);
        printTable(asRows(data), SUITE_COLUMNS);
      }),
    );

  suites
    .command('run <suiteUuid>')
    .description('Run every case and report which passed')
    .action(
      action(async (suiteUuid: string, _opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = (await makeClient(flags).testSuites.run(suiteUuid)) as SuiteRun;
        if (flags.json) {
          printJson(data);
        } else {
          printTable(asRows(data.results ?? []), RESULT_COLUMNS);
          info(`${data.passed_count ?? 0} of ${data.total ?? 0} cases passed`);
        }
        // A failing suite exits non-zero so it can gate a pipeline. Running the
        // suite succeeded either way, so this is a verdict rather than an error,
        // and the results are printed before it is set.
        if (data.passed === false) process.exitCode = 1;
      }),
    );
}
