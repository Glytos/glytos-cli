import { createInterface } from 'node:readline/promises';
import { Command } from 'commander';
import type { GlytosClient } from '../client.js';
import { CliError, action, globalFlags, makeClient } from '../context.js';
import { info, printJson } from '../output.js';

interface ChatOptions {
  message?: string;
  session?: string;
  instructions?: string;
  stream?: boolean;
}

interface StartedSession {
  session_uuid?: string;
  messages?: { role?: string; content?: string }[];
}

interface Turn {
  messages?: { role?: string; content?: string }[];
}

export function registerChat(program: Command): void {
  program
    .command('chat <agent>')
    .description('Talk to a text agent from the terminal')
    .option('-m, --message <text>', 'Send one message and exit instead of staying interactive')
    .option('-s, --session <uuid>', 'Continue an existing conversation')
    .option('--instructions <text>', 'Extra context for this run only; never saved to the agent')
    .option('--no-stream', 'Wait for the whole reply instead of printing it as it is written')
    .action(
      action(async (agent: string, opts: ChatOptions, command: Command) => {
        const flags = globalFlags(command);
        const client = makeClient(flags);
        const sessionUuid = opts.session ?? (await openSession(client, agent, flags.json));

        if (opts.message !== undefined) {
          await runTurn(client, agent, sessionUuid, opts.message, opts, flags.json);
          return;
        }
        if (flags.json) {
          throw new CliError('--json needs --message; the interactive chat is not JSON output.');
        }
        await converse(client, agent, sessionUuid, opts);
      }),
    );
}

/** Open a conversation and print whatever the agent opened with. */
async function openSession(client: GlytosClient, agent: string, json?: boolean): Promise<string> {
  const started = (await client.threads.create(agent)) as StartedSession;
  const uuid = started.session_uuid;
  if (!uuid) throw new CliError('The API did not return a conversation id.');
  if (!json) {
    info(`Conversation ${uuid}`);
    printAssistant(started.messages);
  }
  return uuid;
}

/** One turn, streamed or buffered, printed for a human or as JSON. */
async function runTurn(
  client: GlytosClient,
  agent: string,
  sessionUuid: string,
  content: string,
  opts: ChatOptions,
  json?: boolean,
): Promise<void> {
  // Streaming prints as it arrives, so it has nothing coherent to hand --json.
  if (json || opts.stream === false) {
    const turn = (await client.threads.send(
      agent,
      sessionUuid,
      content,
      opts.instructions,
    )) as Turn;
    if (json) return printJson(turn);
    printAssistant(turn.messages);
    return;
  }

  let wrote = false;
  for await (const event of client.threads.stream(agent, sessionUuid, content, opts.instructions)) {
    if (event.type === 'token') {
      process.stdout.write(event.delta);
      wrote = wrote || event.delta.length > 0;
    } else if (event.type === 'error') {
      throw new CliError(event.message);
    }
  }
  if (wrote) process.stdout.write('\n');
}

/** Read lines until the user leaves, running each as a turn. */
async function converse(
  client: GlytosClient,
  agent: string,
  sessionUuid: string,
  opts: ChatOptions,
): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  info('Type a message, or /exit to leave.');
  try {
    for (;;) {
      const line = (await rl.question('> ')).trim();
      if (!line) continue;
      if (line === '/exit' || line === '/quit') return;
      await runTurn(client, agent, sessionUuid, line, opts);
    }
  } finally {
    rl.close();
  }
}

function printAssistant(messages: { role?: string; content?: string }[] | undefined): void {
  for (const message of messages ?? []) {
    if (message.role === 'assistant' && message.content) {
      process.stdout.write(`${message.content}\n`);
    }
  }
}
