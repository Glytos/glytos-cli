import { describe, expect, it } from 'vitest';
import { GlytosClient, GlytosError } from '../src/client.js';

interface Capture {
  request?: Request;
}

// A fetch stub that records the outgoing request and returns a fresh response each call.
function stubFetch(body: string, init: ResponseInit, capture?: Capture): typeof fetch {
  return (async (input: RequestInfo | URL, requestInit?: RequestInit) => {
    if (capture) capture.request = new Request(input, requestInit);
    return new Response(body, init);
  }) as typeof fetch;
}

describe('GlytosClient', () => {
  it('requires an api key', () => {
    expect(() => new GlytosClient({ apiKey: '' })).toThrow();
  });

  it('decodes json and sends auth headers', async () => {
    const capture: Capture = {};
    const client = new GlytosClient({
      apiKey: 'gly_test',
      environment: 'prod',
      fetch: stubFetch('[{"uuid":"wf_1"}]', { status: 200, headers: { 'x-request-id': 'req_1' } }, capture),
    });

    const agents = await client.workflows.list();

    expect(agents).toEqual([{ uuid: 'wf_1' }]);
    expect(capture.request?.headers.get('X-API-Key')).toBe('gly_test');
    expect(capture.request?.headers.get('X-Environment-Id')).toBe('prod');
    expect(capture.request?.method).toBe('GET');
    expect(capture.request?.url).toMatch(/\/workflows$/);
  });

  it('omits the environment header when unset', async () => {
    const capture: Capture = {};
    const client = new GlytosClient({
      apiKey: 'gly_test',
      fetch: stubFetch('[]', { status: 200 }, capture),
    });

    await client.workflows.list();

    expect(capture.request?.headers.get('X-Environment-Id')).toBeNull();
  });

  it('serializes a JSON body and sets Content-Type', async () => {
    const capture: Capture = {};
    const client = new GlytosClient({
      apiKey: 'gly_test',
      fetch: stubFetch('{"uuid":"wf_1"}', { status: 200 }, capture),
    });

    await client.calls.create({ transport: 'phone', workflow_uuid: 'wf_1', to_number: '+15550001111' });

    expect(capture.request?.method).toBe('POST');
    expect(new URL(capture.request!.url).pathname).toMatch(/\/calls$/);
    expect(capture.request?.headers.get('content-type')).toBe('application/json');
    expect(await capture.request!.json()).toEqual({
      transport: 'phone',
      workflow_uuid: 'wf_1',
      to_number: '+15550001111',
    });
  });

  it('drops null and undefined query parameters', async () => {
    const capture: Capture = {};
    const client = new GlytosClient({
      apiKey: 'gly_test',
      fetch: stubFetch('[]', { status: 200 }, capture),
    });

    await client.phoneNumbers.search({ country: 'US', area_code: undefined });

    expect(new URL(capture.request!.url).search).toBe('?country=US');
  });

  it('throws GlytosError on a non-2xx response', async () => {
    const client = new GlytosClient({
      apiKey: 'gly_test',
      fetch: stubFetch(
        '{"error":{"code":"not_found","message":"Nope"}}',
        { status: 404, headers: { 'x-request-id': 'req_2' } },
      ),
    });

    const error = await client.workflows.retrieve('missing').catch((e) => e);

    expect(error).toBeInstanceOf(GlytosError);
    expect(error.status).toBe(404);
    expect(error.code).toBe('not_found');
    expect(error.message).toBe('Nope');
    expect(error.requestId).toBe('req_2');
  });

  it('trims a trailing slash from the base URL', async () => {
    const capture: Capture = {};
    const client = new GlytosClient({
      apiKey: 'gly_test',
      baseUrl: 'https://api.example.com/api/v1/',
      fetch: stubFetch('[]', { status: 200 }, capture),
    });

    await client.workflows.list();

    expect(capture.request?.url).toBe('https://api.example.com/api/v1/workflows');
  });
});
