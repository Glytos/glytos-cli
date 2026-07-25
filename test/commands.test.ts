import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildProgram } from '../src/cli.js';

interface Capture {
  request?: Request;
}

function stubFetch(body: string, capture: Capture): typeof fetch {
  return (async (input: RequestInfo | URL, requestInit?: RequestInit) => {
    capture.request = new Request(input, requestInit);
    return new Response(body, { status: 200 });
  }) as typeof fetch;
}

// Run the CLI with argv (after `node glytos`), capturing stdout and stubbing the
// network transport so no real request is made.
async function run(
  args: string[],
  responseBody: string,
): Promise<{ out: string; capture: Capture; exitCode: number | undefined }> {
  const capture: Capture = {};
  const priorFetch = globalThis.fetch;
  const priorWrite = process.stdout.write.bind(process.stdout);
  const priorExit = process.exitCode;
  process.exitCode = undefined;
  let out = '';

  globalThis.fetch = stubFetch(responseBody, capture);
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
    return { out, capture, exitCode: process.exitCode };
  } finally {
    globalThis.fetch = priorFetch;
    process.stdout.write = priorWrite;
    process.exitCode = priorExit;
  }
}

// Isolate the home directory so a real ~/.glytos/config.json can't inject state.
let home = '';
let priorHome: string | undefined;
let priorProfile: string | undefined;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'glytos-cli-cmd-'));
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

describe('calls create', () => {
  it('maps flags to the POST /calls body', async () => {
    const { capture, exitCode } = await run(
      ['calls', 'create', '--to', '+15550001111', '--agent', 'wf_1', '--from', '+15550002222', '--json'],
      '{"uuid":"call_1","status":"queued"}',
    );

    expect(exitCode).toBeUndefined();
    expect(capture.request?.method).toBe('POST');
    expect(new URL(capture.request!.url).pathname).toMatch(/\/calls$/);
    expect(await capture.request!.json()).toEqual({
      transport: 'phone',
      workflow_uuid: 'wf_1',
      to_number: '+15550001111',
      from_number: '+15550002222',
    });
  });

  it('prints raw JSON with --json', async () => {
    const { out } = await run(
      ['calls', 'create', '--to', '+15550001111', '--agent', 'wf_1', '--json'],
      '{"uuid":"call_1","status":"queued"}',
    );
    expect(JSON.parse(out)).toEqual({ uuid: 'call_1', status: 'queued' });
  });
});

describe('agents list', () => {
  it('renders a table from a paginated Page response', async () => {
    const { out } = await run(
      ['agents', 'list'],
      '{"items":[{"uuid":"wf_1","name":"Support","mode":"prompt","status":"published"}],"total":1}',
    );
    expect(out).toContain('UUID');
    expect(out).toContain('wf_1');
    expect(out).toContain('Support');
  });

  it('passes the API key as X-API-Key', async () => {
    const { capture } = await run(['agents', 'list'], '[]');
    expect(capture.request?.headers.get('X-API-Key')).toBe('gly_test');
    expect(new URL(capture.request!.url).pathname).toMatch(/\/workflows$/);
  });
});

describe('numbers search', () => {
  it('sends country and area code as query params', async () => {
    const { capture } = await run(
      ['numbers', 'search', '--country', 'US', '--area-code', '415', '--json'],
      '[]',
    );
    const url = new URL(capture.request!.url);
    expect(url.pathname).toMatch(/\/telephony\/numbers\/search$/);
    expect(url.searchParams.get('country')).toBe('US');
    expect(url.searchParams.get('area_code')).toBe('415');
  });
});

describe('webhooks create', () => {
  it('splits the comma-separated events into an array', async () => {
    const { capture } = await run(
      ['webhooks', 'create', '--url', 'https://hooks.example.com/glytos', '--events', 'call.completed, call.failed', '--json'],
      '{"id":1}',
    );
    expect(new URL(capture.request!.url).pathname).toMatch(/\/webhooks\/endpoints$/);
    expect(await capture.request!.json()).toEqual({
      url: 'https://hooks.example.com/glytos',
      events: ['call.completed', 'call.failed'],
    });
  });
});
