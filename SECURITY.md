# Security Policy

## Reporting a vulnerability

Please do not report security vulnerabilities through public issues. Instead, email
[security@glytos.com](mailto:security@glytos.com) with the details, and we will respond
promptly. We appreciate responsible disclosure and will credit you once a fix ships.

## Handling credentials

The CLI stores your API key in `~/.glytos/config.json`, written with owner-only
(`0600`) permissions. Treat this file, and any `GLYTOS_API_KEY` value, as a secret:
never commit it or paste it into shared logs. Run `glytos logout` to remove it.

## Supported versions

Security fixes are released for the latest published version.
