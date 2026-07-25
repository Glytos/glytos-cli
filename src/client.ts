/**
 * Self-contained, fetch-based Glytos API client embedded in the CLI.
 *
 * This mirrors the `request()` contract of the `@glytos/node` SDK (base URL,
 * `X-API-Key` + optional `X-Environment-Id` auth, and the `{ error: { code,
 * message } }` envelope) without depending on the SDK package, so the CLI ships
 * as a single self-contained tool.
 */

const DEFAULT_BASE_URL = 'https://api.glytos.com/api/v1';

export interface ClientOptions {
  /** Organization API key (starts with `gly_`). */
  apiKey: string;
  /** API base URL. Defaults to the public API. */
  baseUrl?: string;
  /** Environment to act in: `dev`, `staging`, `prod`, or an environment uuid. */
  environment?: string;
  /** Custom fetch implementation. Defaults to the global `fetch` (Node 18+). */
  fetch?: typeof fetch;
}

type Primitive = string | number | boolean;
export type Query = Record<string, Primitive | undefined | null>;

export interface RequestOptions {
  query?: Query;
  body?: unknown;
}

/** Thrown on any non-2xx API response. Carries the API error `code` and status. */
export class GlytosError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | undefined;

  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.name = 'GlytosError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

const enc = encodeURIComponent;

class Workflows {
  constructor(private readonly client: GlytosClient) {}

  list(query?: Query): Promise<unknown> {
    return this.client.request('GET', '/workflows', { query });
  }

  retrieve(uuid: string): Promise<unknown> {
    return this.client.request('GET', `/workflows/${enc(uuid)}`);
  }

  create(body: { name: string; mode?: string }): Promise<unknown> {
    return this.client.request('POST', '/workflows', { body });
  }

  publish(uuid: string): Promise<unknown> {
    return this.client.request('POST', `/workflows/${enc(uuid)}/publish`);
  }

  delete(uuid: string): Promise<unknown> {
    return this.client.request('DELETE', `/workflows/${enc(uuid)}`);
  }
}

class Calls {
  constructor(private readonly client: GlytosClient) {}

  create(body: Record<string, unknown>): Promise<unknown> {
    return this.client.request('POST', '/calls', { body });
  }

  list(query?: Query): Promise<unknown> {
    return this.client.request('GET', '/calls', { query });
  }

  retrieve(uuid: string): Promise<unknown> {
    return this.client.request('GET', `/calls/${enc(uuid)}`);
  }
}

class PhoneNumbers {
  constructor(private readonly client: GlytosClient) {}

  search(query: Query): Promise<unknown> {
    return this.client.request('GET', '/telephony/numbers/search', { query });
  }

  list(): Promise<unknown> {
    return this.client.request('GET', '/telephony/numbers');
  }

  importNumber(body: Record<string, unknown>): Promise<unknown> {
    return this.client.request('POST', '/telephony/numbers/import', { body });
  }

  release(uuid: string): Promise<unknown> {
    return this.client.request('DELETE', `/telephony/numbers/${enc(uuid)}`);
  }
}

class Campaigns {
  constructor(private readonly client: GlytosClient) {}

  list(): Promise<unknown> {
    return this.client.request('GET', '/telephony/campaigns');
  }

  create(body: Record<string, unknown>): Promise<unknown> {
    return this.client.request('POST', '/telephony/campaigns', { body });
  }

  start(uuid: string): Promise<unknown> {
    return this.client.request('POST', `/telephony/campaigns/${enc(uuid)}/start`);
  }
}

class Sessions {
  constructor(private readonly client: GlytosClient) {}

  list(query?: Query): Promise<unknown> {
    return this.client.request('GET', '/sessions', { query });
  }
}

class Webhooks {
  constructor(private readonly client: GlytosClient) {}

  list(): Promise<unknown> {
    return this.client.request('GET', '/webhooks/endpoints');
  }

  create(body: { url: string; events: string[] }): Promise<unknown> {
    return this.client.request('POST', '/webhooks/endpoints', { body });
  }
}

export class GlytosClient {
  readonly workflows: Workflows;
  readonly calls: Calls;
  readonly phoneNumbers: PhoneNumbers;
  readonly campaigns: Campaigns;
  readonly sessions: Sessions;
  readonly webhooks: Webhooks;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly environment?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ClientOptions) {
    if (!options.apiKey) throw new Error('Glytos: an apiKey is required');
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.environment = options.environment;
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new Error('Glytos: no global fetch found; upgrade to Node 18+');
    }
    this.fetchImpl = fetchImpl;

    this.workflows = new Workflows(this);
    this.calls = new Calls(this);
    this.phoneNumbers = new PhoneNumbers(this);
    this.campaigns = new Campaigns(this);
    this.sessions = new Sessions(this);
    this.webhooks = new Webhooks(this);
  }

  /**
   * Low-level request against any API endpoint. Path is relative to the API base
   * (e.g. `"/workflows"`). Throws `GlytosError` on a non-2xx response.
   */
  async request<T = unknown>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
      Accept: 'application/json',
    };
    if (this.environment) headers['X-Environment-Id'] = this.environment;
    const init: RequestInit = { method, headers };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }

    const response = await this.fetchImpl(url.toString(), init);
    const requestId = response.headers.get('x-request-id') ?? undefined;
    const text = await response.text();
    const data = text ? safeParse(text) : undefined;

    if (!response.ok) {
      const error = (data as { error?: { code?: string; message?: string } } | undefined)?.error;
      throw new GlytosError(
        response.status,
        error?.code ?? 'error',
        error?.message ?? (response.statusText || 'Request failed'),
        requestId,
      );
    }
    return data as T;
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
