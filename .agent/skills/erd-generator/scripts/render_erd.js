#!/usr/bin/env node
/**
 * Validates a Mermaid ERD file and compiles it to an SVG using @mermaid-js/mermaid-cli.
 *
 * Usage (run from the repository root):
 *   node .agent/skills/erd-generator/scripts/render_erd.js docs/architecture/schema.mmd
 *
 * Output:
 *   docs/architecture/erd.svg
 *
 * Exit codes:
 *   0 - compiled successfully (prints SUCCESS)
 *   1 - failed (prints SYNTAX_ERROR: followed by the stderr trace)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const OUTPUT_PATH = 'docs/architecture/erd.svg';

function fail(message) {
  console.error(`SYNTAX_ERROR: ${message}`);
  process.exit(1);
}

const inputArg = process.argv[2] ?? 'docs/architecture/schema.mmd';
const inputPath = resolve(process.cwd(), inputArg);
const outputPath = resolve(process.cwd(), OUTPUT_PATH);

if (!existsSync(inputPath)) {
  fail(`Input file not found: ${inputArg}`);
}

mkdirSync(dirname(outputPath), { recursive: true });

// Remove any stale SVG so a leftover file can never be mistaken for a fresh render.
rmSync(outputPath, { force: true });

const result = spawnSync(
  'npx',
  ['mmdc', '-i', inputPath, '-o', outputPath],
  { encoding: 'utf-8', shell: process.platform === 'win32' },
);

if (result.error) {
  fail(result.error.message);
}

if (result.status !== 0) {
  fail((result.stderr || result.stdout || 'Unknown mmdc failure').trim());
}

// mmdc can occasionally exit 0 without writing output; treat that as a failure too.
if (!existsSync(outputPath)) {
  fail((result.stderr || 'mmdc finished but no SVG was produced').trim());
}

console.log('SUCCESS');
process.exit(0);