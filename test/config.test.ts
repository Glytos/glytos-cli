import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BASE_URL, clearConfig, loadConfig, resolveConfig, saveConfig } from '../src/config.js';

// Redirect the home directory to a throwaway dir so tests never read or write
// the real ~/.glytos/config.json.
let home = '';
let priorHome: string | undefined;
let priorProfile: string | undefined;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'glytos-cli-'));
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

describe('resolveConfig precedence', () => {
  it('prefers a flag over env and stored config', () => {
    saveConfig({ apiKey: 'stored_key', baseUrl: 'https://stored/api/v1' });
    const resolved = resolveConfig(
      { apiKey: 'flag_key' },
      { GLYTOS_API_KEY: 'env_key' } as NodeJS.ProcessEnv,
    );
    expect(resolved.apiKey).toBe('flag_key');
  });

  it('prefers env over stored config', () => {
    saveConfig({ apiKey: 'stored_key' });
    const resolved = resolveConfig({}, { GLYTOS_API_KEY: 'env_key' } as NodeJS.ProcessEnv);
    expect(resolved.apiKey).toBe('env_key');
  });

  it('falls back to the stored config', () => {
    saveConfig({ apiKey: 'stored_key', environment: 'staging' });
    const resolved = resolveConfig({}, {} as NodeJS.ProcessEnv);
    expect(resolved.apiKey).toBe('stored_key');
    expect(resolved.environment).toBe('staging');
  });

  it('defaults the base URL when nothing sets it', () => {
    const resolved = resolveConfig({}, {} as NodeJS.ProcessEnv);
    expect(resolved.baseUrl).toBe(DEFAULT_BASE_URL);
    expect(resolved.apiKey).toBeUndefined();
  });
});

describe('config file persistence', () => {
  it('round-trips through save and load', () => {
    const path = saveConfig({ apiKey: 'gly_abc', baseUrl: 'https://x/api/v1', environment: 'dev' });
    expect(loadConfig()).toEqual({ apiKey: 'gly_abc', baseUrl: 'https://x/api/v1', environment: 'dev' });

    const contents = readFileSync(path, 'utf8');
    expect(JSON.parse(contents)).toMatchObject({ apiKey: 'gly_abc' });
  });

  it('writes the file with owner-only permissions on POSIX', () => {
    if (process.platform === 'win32') return; // POSIX modes are not meaningful on Windows.
    const path = saveConfig({ apiKey: 'gly_abc' });
    const mode = statSync(path).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('clears the stored config', () => {
    saveConfig({ apiKey: 'gly_abc' });
    expect(clearConfig()).toBe(true);
    expect(loadConfig()).toEqual({});
    expect(clearConfig()).toBe(false);
  });
});
