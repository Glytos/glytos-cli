import { readFile } from 'node:fs/promises';
import { Command } from 'commander';
import { action, CliError, globalFlags, makeClient } from '../context.js';
import { asRows, info, printJson, printObject, printTable } from '../output.js';

const CAMPAIGN_COLUMNS: [string, string][] = [
  ['uuid', 'UUID'],
  ['name', 'NAME'],
  ['status', 'STATUS'],
];

const CONTACT_COLUMNS: [string, string][] = [
  ['phone', 'PHONE'],
  ['status', 'STATUS'],
  ['session_uuid', 'SESSION'],
  ['error', 'ERROR'],
];

/** Read a CSV file, reporting the path rather than a bare ENOENT. */
async function readCsv(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    throw new CliError(`Could not read ${path}.`);
  }
}

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
    .requiredOption('--from <e164>', 'Caller-ID number, which you must already own')
    .option('--contacts-file <path>', 'CSV file of contacts to dial')
    .option('--contacts <numbers>', 'Comma-separated phone numbers to dial')
    .option('--schedule <iso>', 'Start at a moment in the future (ISO 8601)')
    .option('--window <start-end>', 'Dialing hours, e.g. 09:00-20:00')
    .option('--timezone <zone>', 'IANA zone the window is read in, e.g. Europe/Istanbul')
    .option(
      '--suppression <policy>',
      'How much of the do-not-call list applies: strict, transactional or ignore',
    )
    .option('--override-caller-requests', 'Also call people who asked not to be (needs ignore)')
    .action(
      action(
        async (
          opts: {
            name: string;
            agent: string;
            from: string;
            contactsFile?: string;
            contacts?: string;
            schedule?: string;
            window?: string;
            timezone?: string;
            suppression?: string;
            overrideCallerRequests?: boolean;
          },
          command: Command,
        ) => {
          const flags = globalFlags(command);
          const body: Record<string, unknown> = {
            name: opts.name,
            workflow_uuid: opts.agent,
            from_number: opts.from,
          };
          if (opts.contactsFile) body.contacts_csv = await readCsv(opts.contactsFile);
          if (opts.contacts) {
            body.contacts = opts.contacts
              .split(',')
              .map((phone) => phone.trim())
              .filter(Boolean);
          }
          if (opts.schedule) body.scheduled_at = opts.schedule;
          if (opts.window) {
            const [start, end] = opts.window.split('-');
            if (!start || !end) {
              throw new CliError('--window takes a range, e.g. 09:00-20:00.');
            }
            body.call_window_start = start;
            body.call_window_end = end;
          }
          if (opts.timezone) body.timezone = opts.timezone;
          if (opts.suppression) body.suppression_policy = opts.suppression;
          if (opts.overrideCallerRequests) body.override_caller_requests = true;

          const data = await makeClient(flags).campaigns.create(body);
          flags.json ? printJson(data) : printObject(data);
        },
      ),
    );

  campaigns
    .command('show <uuid>')
    .description("Show a campaign and each contact's outcome")
    .action(
      action(async (uuid: string, _opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = (await makeClient(flags).campaigns.retrieve(uuid)) as Record<string, unknown>;
        if (flags.json) return printJson(data);
        const { contacts, ...campaign } = data;
        printObject(campaign);
        if (Array.isArray(contacts) && contacts.length > 0) {
          printTable(asRows(contacts), CONTACT_COLUMNS);
        }
      }),
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

  campaigns
    .command('stop <uuid>')
    .description('Stop a campaign at the next contact; undialed contacts stay ready')
    .action(
      action(async (uuid: string, _opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).campaigns.stop(uuid);
        flags.json ? printJson(data) : printObject(data);
      }),
    );

  campaigns
    .command('update <uuid>')
    .description('Rename a campaign, or change when and within what hours it dials')
    .option('--name <name>', 'New campaign name')
    .option('--schedule <iso>', 'Start at a moment in the future (ISO 8601)')
    .option('--clear-schedule', 'Remove the schedule, returning the campaign to a draft')
    .option('--window <start-end>', 'Dialing hours, e.g. 09:00-20:00')
    .option('--timezone <zone>', 'IANA zone the window is read in, e.g. Europe/Istanbul')
    .action(
      action(
        async (
          uuid: string,
          opts: {
            name?: string;
            schedule?: string;
            clearSchedule?: boolean;
            window?: string;
            timezone?: string;
          },
          command: Command,
        ) => {
          const flags = globalFlags(command);
          if (opts.schedule && opts.clearSchedule) {
            throw new CliError('--schedule and --clear-schedule ask for opposite things.');
          }

          const body: Record<string, unknown> = {};
          if (opts.name) body.name = opts.name;
          // Sending null clears the schedule; leaving the key out leaves it
          // alone, so the two cases cannot share a code path.
          if (opts.clearSchedule) body.scheduled_at = null;
          else if (opts.schedule) body.scheduled_at = opts.schedule;
          if (opts.window) {
            const [start, end] = opts.window.split('-');
            if (!start || !end) {
              throw new CliError('--window takes a range, e.g. 09:00-20:00.');
            }
            body.call_window_start = start;
            body.call_window_end = end;
          }
          if (opts.timezone) body.timezone = opts.timezone;
          if (Object.keys(body).length === 0) {
            throw new CliError('Nothing to change. Pass at least one option.');
          }

          const data = await makeClient(flags).campaigns.update(uuid, body);
          flags.json ? printJson(data) : printObject(data);
        },
      ),
    );

  campaigns
    .command('duplicate <uuid>')
    .description('Copy a campaign and its contact list into a fresh draft; nothing dials')
    .option('--name <name>', "Name for the copy; defaults to the original's")
    .action(
      action(async (uuid: string, opts: { name?: string }, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).campaigns.duplicate(
          uuid,
          opts.name ? { name: opts.name } : {},
        );
        flags.json ? printJson(data) : printObject(data);
      }),
    );

  campaigns
    .command('export <uuid>')
    .description('Print the contacts and their outcomes as CSV')
    .action(
      action(async (uuid: string, _opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).campaigns.export(uuid);
        // CSV goes to stdout as it arrived, so it can be piped or redirected.
        // Wrapping it in a table would make the one format worth having here
        // unusable by anything downstream.
        process.stdout.write(typeof data === 'string' ? data : JSON.stringify(data) + '\n');
      }),
    );

  campaigns
    .command('delete <uuid>')
    .description('Delete a campaign and its contact list')
    .action(
      action(async (uuid: string, _opts: unknown, command: Command) => {
        const flags = globalFlags(command);
        const data = await makeClient(flags).campaigns.delete(uuid);
        if (flags.json) return printJson(data ?? { deleted: uuid });
        info(`Deleted campaign ${uuid}`);
      }),
    );

  campaigns
    .command('add-contacts <uuid>')
    .description('Append contacts to a campaign from a CSV file')
    .requiredOption('--file <path>', 'CSV file of contacts to append')
    .action(
      action(async (uuid: string, opts: { file: string }, command: Command) => {
        const flags = globalFlags(command);
        const csv = await readCsv(opts.file);
        const data = await makeClient(flags).campaigns.addContacts(uuid, { contacts_csv: csv });
        flags.json ? printJson(data) : printObject(data);
      }),
    );

  campaigns
    .command('preview-suppression')
    .description('How many of a contact list each do-not-call policy would reach')
    .requiredOption('--file <path>', 'CSV file of contacts to measure')
    .action(
      action(async (opts: { file: string }, command: Command) => {
        const flags = globalFlags(command);
        const csv = await readCsv(opts.file);
        const data = await makeClient(flags).campaigns.previewSuppression({ contacts_csv: csv });
        flags.json ? printJson(data) : printObject(data);
      }),
    );
}
