import { Command } from 'commander';
import { action, globalFlags, makeClient } from '../context.js';
import { asRows, info, printJson, printObject, printTable } from '../output.js';

const AGENT_COLUMNS: [string, string][] = [
  ['uuid', 'UUID'],
  ['name', 'NAME'],
  ['mode', 'MODE'],
  ['status', 'STATUS'],
];

export function registerAgents(program: Command): void {
  const agents = program.command('agents').description('Manage your voice/chat agents');

  agents
    .command('list')
    .description('List your agents')
    .action(
      action(async (_opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).workflows.list();
        if (flags.json) return printJson(data);
        printTable(asRows(data), AGENT_COLUMNS);
      }),
    );

  agents
    .command('get <uuid>')
    .description('Retrieve one agent by uuid')
    .action(
      action(async (uuid: string, _opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).workflows.retrieve(uuid);
        flags.json ? printJson(data) : printObject(data);
      }),
    );

  agents
    .command('create')
    .description('Create an agent')
    .requiredOption('--name <name>', 'Agent name')
    .option('--mode <mode>', 'Agent mode: prompt (default) or workflow')
    .action(
      action(async (opts: { name: string; mode?: string }, command: Command) => {
        const flags = globalFlags(command);
        const body: { name: string; mode?: string } = { name: opts.name };
        if (opts.mode) body.mode = opts.mode;
        const data = await makeClient(flags).workflows.create(body);
        flags.json ? printJson(data) : printObject(data);
      }),
    );

  agents
    .command('publish <uuid>')
    .description('Publish the current draft so the agent goes live')
    .action(
      action(async (uuid: string, _opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).workflows.publish(uuid);
        flags.json ? printJson(data) : printObject(data);
      }),
    );

  agents
    .command('delete <uuid>')
    .description('Delete an agent')
    .action(
      action(async (uuid: string, _opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).workflows.delete(uuid);
        if (flags.json) return printJson(data ?? { deleted: uuid });
        info(`Deleted agent ${uuid}`);
      }),
    );
}
