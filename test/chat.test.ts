import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildProgram } from '../src/cli.js';

// The chat command makes more than one request per invocation (open a conversation,
// then run the turn), so the stub answers from a queue and records every request.
async function run(
  args: string[],
  responses: (string | Response)[],
): Promise<{ out: string; requests: Request[] }> {
  const requests: Request[] = [];
  const queue = [...responses];
  const priorFetch = globalThis.fetch;
  const priorWrite = process.stdout.write.bind(process.stdout);
  const priorExit = process.exitCode;
  process.exitCode = undefined;
  let out = '';

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new Request(input, init));
    const next = queue.shift() ?? '{}';
    return typeof next === 'string' ? new Response(next, { status: 200 }) : next;
  }) as typeof fetch;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    out += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;

  try {
    await buildProgram().parseAsync([
      'node',
      'glytos',
      '--api-key',
      'gly_test',
      '--base-url',
      'https://api.example.com/api/v1',
      ...args,
    ]);
    return { out, requests };
  } finally {
    globalThis.fetch = priorFetch;
    process.stdout.write = priorWrite;
    process.exitCode = priorExit;
  }
}

const sse = (text: string): Response =>
  new Response(text, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });

let home = '';
let priorHome: string | undefined;
let priorProfile: string | undefined;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'glytos-cli-chat-'));
  priorHome = process.env.HOME;
  priorProfile = process.env.USERPROFILE;
  process.env.HOME = home;
  process.env.USERPROFILE = home;
});

afterEach(() => {
  process.env.HOME = priorHome;
  process.env.USERPROFILE = priorProfile;
  rmSync(home, { recursive: true, force: true });
});

describe('chat', () => {
  it('opens a conversation, then runs the turn on it', async () => {
    const { requests } = await run(
      ['chat', 'wf_1', '--message', 'hello', '--json'],
      ['{"session_uuid":"ses_1","messages":[]}', '{"messages":[]}'],
    );

    expect(new URL(requests[0]!.url).pathname).toMatch(/\/workflows\/wf_1\/sessions$/);
    expect(new URL(requests[1]!.url).pathname).toMatch(/\/workflows\/wf_1\/sessions\/ses_1\/messages$/);
    expect(await requests[1]!.json()).toEqual({ content: 'hello' });
  });

  it('carries per-turn instructions on the turn, not on the agent', async () => {
    const { requests } = await run(
      ['chat', 'wf_1', '-m', 'rate this', '--instructions', 'Score 1-5.', '--json'],
      ['{"session_uuid":"ses_1","messages":[]}', '{"messages":[]}'],
    );

    expect(await requests[1]!.json()).toEqual({
      content: 'rate this',
      additional_instructions: 'Score 1-5.',
    });
  });

  it('skips opening a conversation when one is given', async () => {
    const { requests } = await run(
      ['chat', 'wf_1', '-m', 'again', '--session', 'ses_9', '--json'],
      ['{"messages":[]}'],
    );

    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]!.url).pathname).toMatch(/\/sessions\/ses_9\/messages$/);
  });

  it('streams the reply by default, printing deltas as they arrive', async () => {
    const { out, requests } = await run(
      ['chat', 'wf_1', '-m', 'tell me'],
      [
        '{"session_uuid":"ses_1","messages":[{"role":"assistant","content":"Hi"}]}',
        sse('event: token\ndata: {"delta":"He"}\n\nevent: token\ndata: {"delta":"llo"}\n\nevent: done\ndata: {"status":"completed"}\n\n'),
      ],
    );

    expect(new URL(requests[1]!.url).pathname).toMatch(/\/messages\/stream$/);
    expect(requests[1]!.headers.get('accept')).toBe('text/event-stream');
    expect(out).toContain('Hi');
    expect(out).toContain('Hello');
  });

  it('waits for the whole reply with --no-stream', async () => {
    const { out, requests } = await run(
      ['chat', 'wf_1', '-m', 'tell me', '--no-stream'],
      [
        '{"session_uuid":"ses_1","messages":[]}',
        '{"messages":[{"role":"assistant","content":"All of it"}]}',
      ],
    );

    expect(new URL(requests[1]!.url).pathname).not.toMatch(/\/stream$/);
    expect(out).toContain('All of it');
  });
});
