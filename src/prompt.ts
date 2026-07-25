/**
 * Minimal interactive prompts built on Node's readline, so the CLI keeps a single
 * runtime dependency. `promptHidden` masks input for secrets like the API key.
 */

import { createInterface } from 'node:readline/promises';

/** Prompt for a line of input, returning the trimmed answer (or a default). */
export async function prompt(question: string, fallback?: string): Promise<string> {
  const suffix = fallback ? ` [${fallback}]` : '';
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${question}${suffix}: `)).trim();
    return answer || fallback || '';
  } finally {
    rl.close();
  }
}

/** Prompt without echoing the typed characters (for secrets). */
export async function promptHidden(question: string): Promise<string> {
  const input = process.stdin;
  const output = process.stdout;
  const rl = createInterface({ input, output });

  // Suppress echo: intercept readline's writes to the output while the answer is
  // being typed, so the secret is never shown on screen.
  const asMutable = rl as unknown as { _writeToOutput?: (text: string) => void };
  const original = asMutable._writeToOutput;
  let muted = false;
  asMutable._writeToOutput = (text: string): void => {
    if (muted) {
      // Still honour Enter so the prompt advances to a new line.
      if (text.includes('\n')) output.write('\n');
      return;
    }
    output.write(text);
  };

  try {
    const answering = rl.question(`${question}: `);
    muted = true;
    const answer = await answering;
    return answer.trim();
  } finally {
    asMutable._writeToOutput = original;
    rl.close();
  }
}
