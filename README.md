# @glytos/cli

[![CI](https://github.com/Glytos/glytos-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Glytos/glytos-cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@glytos/cli)](https://www.npmjs.com/package/@glytos/cli)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

The official command-line interface for the [Glytos](https://glytos.com) voice-AI
platform. Manage agents, place calls, provision phone numbers, run campaigns, and
inspect sessions and webhooks - all from your terminal.

Self-contained and dependency-light: one runtime dependency (`commander`) and a
small embedded API client built on the global `fetch`.

## Install

```bash
npm install -g @glytos/cli
```

Requires Node.js 18+ (uses the global `fetch`).

## Authentication

Log in once to save your credentials to `~/.glytos/config.json` (written with
owner-only `0600` permissions):

```bash
glytos login
# API key: ****************
# Base URL [https://api.glytos.com/api/v1]:
# Environment (dev/staging/prod, blank for default):
```

The CLI resolves each setting in this order (first match wins):

| Setting | Flag | Environment variable | Config file |
| --- | --- | --- | --- |
| API key | `--api-key` | `GLYTOS_API_KEY` | `apiKey` |
| Base URL | `--base-url` | `GLYTOS_BASE_URL` | `baseUrl` |
| Environment | `--environment` | `GLYTOS_ENVIRONMENT` | `environment` |

So you can skip `glytos login` entirely in CI:

```bash
GLYTOS_API_KEY=gly_live_... glytos agents list
```

Remove the saved credentials with `glytos logout`.

## Usage

```
glytos [global options] <command> [subcommand] [options]
```

Global options apply to every command:

- `--api-key <key>` - override the resolved API key
- `--base-url <url>` - override the API base URL
- `--environment <env>` - act in `dev`, `staging`, `prod`, or an environment uuid
- `--json` - print the raw JSON response instead of a formatted table

### Agents

```bash
glytos agents list
glytos agents get <uuid>
glytos agents create --name "Support bot" --mode prompt
glytos agents publish <uuid>
glytos agents delete <uuid>
```

### Calls

```bash
glytos calls create --to +15551234567 --agent <uuid> [--from +15557654321]
glytos calls list
glytos calls get <uuid>
```

### Phone numbers

```bash
glytos numbers search --country US --area-code 415
glytos numbers list
glytos numbers import --e164 +15551234567 --provider twilio --workflow <uuid>
glytos numbers release <uuid>
```

### Campaigns

```bash
glytos campaigns list
glytos campaigns create --name "July outreach" --agent <uuid> --from +15551234567
glytos campaigns start <uuid>
```

### Sessions and logs

```bash
glytos sessions        # list sessions across your agents
glytos logs            # alias for `sessions`
```

### Webhooks

```bash
glytos webhooks list
glytos webhooks create --url https://hooks.example.com/glytos --events call.completed,call.failed
```

## JSON output

Every command supports `--json` for scripting:

```bash
glytos agents list --json | jq '.items[].uuid'
```

## Errors

API errors are printed as a single clean line (never a stack trace) and the CLI
exits with a non-zero status:

```
Error [not_found] 404: No agent with that uuid (request req_abc123)
```

## License

MIT
