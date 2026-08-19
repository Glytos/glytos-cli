# Changelog

All notable changes to this project are documented in this file. The format is based
on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-08-19

### Added

- `glytos campaigns update`, `duplicate` and `export`. `update` takes `--name`,
  `--schedule`, `--clear-schedule`, `--window` and `--timezone`, and refuses a
  call that would change nothing. `export` writes CSV to stdout unchanged, so it
  can be piped or redirected.

## [0.4.0] - 2026-08-17

### Added

- `glytos suites list` and `glytos suites run <uuid>` - replay saved
  conversations against an agent. `run` exits non-zero when a case fails, so a
  pipeline can gate on it; the results are printed first either way.
- `glytos balance` and `glytos usage` - the credit balance and the aggregate,
  without piping a raw request through `jq`.
- `glytos trunks list` and `glytos trunks test <uuid>` - SIP trunk registration
  state, and re-checking one against its carrier. `test` reports whether the
  carrier answered at all, separately from whether the trunk works, and exits
  non-zero when it does not.

The rest of the API surface is deliberately not mirrored here: the SDKs cover it,
and a command line is the wrong shape for editing integration credentials or
automation templates.

## [0.3.0] - 2026-08-09

### Added

- `glytos dnc` - the numbers your organization must not call: `list`, `add`,
  `import`, `scope`, `remove`. Every outbound call is checked against this list,
  campaigns and `glytos calls create` alike.
- `glytos campaigns show`, `stop`, `delete`, `add-contacts` and
  `preview-suppression`.
- `glytos campaigns create` gained `--contacts-file` (a CSV of contacts),
  `--schedule`, `--window`, `--timezone`, `--suppression` and
  `--override-caller-requests`.

### Changed

- `glytos campaigns create --contacts` takes comma-separated phone numbers. It
  took a JSON array of objects, which the API rejects with a 422.

## [0.2.1] - 2026-08-02

### Fixed

- `glytos --version` reported the previous release. It now reads the version from
  the package manifest, so it can no longer drift.

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
