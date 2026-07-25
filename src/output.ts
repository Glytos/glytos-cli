/**
 * Human-friendly and machine-friendly output rendering.
 *
 * With `--json` the raw API payload is printed as pretty JSON. Otherwise the CLI
 * renders compact tables for lists and aligned key/value lines for single
 * objects.
 */

/** Unwrap a list response: a bare array, or a paginated `{ items: [...] }` Page. */
export function asRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === 'object') {
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items)) return items as Record<string, unknown>[];
  }
  return [];
}

export function printJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Render `rows` as an aligned text table over the given `columns` (each a
 * `[key, header]` pair). Missing keys render blank.
 */
export function printTable(rows: Record<string, unknown>[], columns: [string, string][]): void {
  if (rows.length === 0) {
    process.stdout.write('No results.\n');
    return;
  }

  const headers = columns.map(([, header]) => header);
  const widths = columns.map(([, header]) => header.length);
  const table = rows.map((row) =>
    columns.map(([key], i) => {
      const text = cell(row[key]);
      if (text.length > widths[i]!) widths[i] = text.length;
      return text;
    }),
  );

  const line = (cells: string[]): string =>
    cells.map((text, i) => text.padEnd(widths[i]!)).join('  ').replace(/\s+$/, '');

  process.stdout.write(line(headers) + '\n');
  process.stdout.write(widths.map((w) => '-'.repeat(w)).join('  ') + '\n');
  for (const cells of table) process.stdout.write(line(cells) + '\n');
}

/** Print a single object as aligned `key: value` lines. */
export function printObject(data: unknown): void {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    process.stdout.write(cell(data) + '\n');
    return;
  }
  const entries = Object.entries(data as Record<string, unknown>);
  const width = entries.reduce((max, [key]) => Math.max(max, key.length), 0);
  for (const [key, value] of entries) {
    process.stdout.write(`${(key + ':').padEnd(width + 1)} ${cell(value)}\n`);
  }
}

export function info(message: string): void {
  process.stdout.write(message + '\n');
}
