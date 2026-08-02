# Changelog

All notable changes to this project are documented in this file. The format is based
on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-08-02

### Added

- `glytos chat <agent>` - talk to a text agent from the terminal, interactively or
  with a single `--message`. The reply streams by default (`--no-stream` waits for
  it whole), `--session` continues an existing conversation, and `--instructions`
  adds context for that run only.

## [0.1.0] - 2026-07-25

### Added

- Initial release of the `glytos` command-line interface.
- `glytos login` / `glytos logout` to store credentials in `~/.glytos/config.json`
  (owner-only `0600` permissions).
- Credential resolution from `--api-key` / `GLYTOS_API_KEY` / config file, with the
  base URL and environment resolved the same way.
- Commands: `agents` (list/get/create/publish/delete), `calls` (create/list/get),
  `numbers` (search/list/import/release), `campaigns` (list/create/start),
  `sessions` and its `logs` alias, and `webhooks` (list/create).
- Global `--json` flag for raw JSON output; formatted tables otherwise.
- Clean API error reporting from the error envelope (no stack traces on 4xx).
- Self-contained embedded API client built on the global `fetch` (single runtime
  dependency: `commander`).
