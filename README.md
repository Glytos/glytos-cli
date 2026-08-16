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

### Chat

Talk to a text agent from the terminal. The reply streams in as it is written:

```bash
glytos chat <agent-uuid>                          # interactive; /exit to leave
glytos chat <agent-uuid> -m "What are your hours?"  # one message and out
glytos chat <agent-uuid> -m "Rate this" --instructions "Score 1-5, reply as JSON."
glytos chat <agent-uuid> -m "again" --session <session-uuid>   # continue one
glytos chat <agent-uuid> -m "hi" --no-stream --json            # full reply as JSON
```

`--instructions` applies to that run only and is never saved to the agent.

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
glytos campaigns create --name "July outreach" --agent <uuid> --from +15551234567 \
  --contacts-file leads.csv --window 09:00-20:00 --timezone Europe/Istanbul
glytos campaigns show <uuid>          # every contact and what became of it
glytos campaigns start <uuid>
glytos campaigns stop <uuid>          # ends at the next contact; the rest stay ready
glytos campaigns add-contacts <uuid> --file more-leads.csv
glytos campaigns delete <uuid>
```

`--from` must be a number you have already connected. The phone column in the CSV
is found by its header or by which column holds phone numbers; every other column
travels with that contact, so `{{name}}` in the agent's prompt means the person
being called. Add `--schedule 2026-03-01T09:00:00Z` to start in the future.

### Do not call

Every outbound call is checked against this list first, campaigns and
`glytos calls create` alike. Agents add to it themselves when someone asks not to
be contacted again.

```bash
glytos dnc list --search 0555
glytos dnc add +15551234567 --reason "asked on a call"
glytos dnc import --file suppressed.txt      # one number per line
glytos dnc scope +15551234567 marketing      # still allow transactional calls
glytos dnc remove +15551234567
```

A campaign can narrow how much of the list applies with `--suppression
transactional` or `--suppression ignore`. Measure it first:

```bash
glytos campaigns preview-suppression --file leads.csv
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

### Test suites

Replay saved conversations against an agent to catch prompt regressions. `run`
exits non-zero when a case fails, so it can gate a pipeline:

```bash
glytos suites list
glytos suites run <suite-uuid>
```

Running the suite runs the agent, so it spends credit.

### Account and carriers

```bash
glytos balance                  # credit balance
glytos usage                    # aggregate usage and cost
glytos trunks list              # SIP trunks and their registration state
glytos trunks test <trunk-uuid> # re-check one against its carrier now
```

`trunks test` reports whether the carrier answered at all, separately from
whether the trunk works. A carrier that refused the credentials is a different
problem from one that never replied, and only the first is worth a new password.
It also exits non-zero when the trunk is not usable.

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
