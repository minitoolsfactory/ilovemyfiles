import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path of the test fixtures. */
export const FIXTURES = path.join(here, '..', 'fixtures');

/** Column at which the subject grid starts in the synthetic test gazettes. */
export const GRID = 40;

/** Width of one subject column in a fixed width gazette. */
export const PITCH = 7;

/**
 * Read a fixture file.
 *
 * @param {string} name
 * @returns {string}
 */
export function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8');
}

/**
 * Build a fixed width gazette for the parser tests.
 *
 * @param {Array<{ roll: string, gender?: string, name: string, codes: string[], marks?: string[], status?: string, comp?: string }>} records
 * @returns {string}
 */
export function makeGazette(records) {
  const lines = [];
  lines.push(' '.repeat(GRID) + 'MKS GR '.repeat(7));
  for (const record of records) {
    const head = `${record.roll}   ${record.gender ?? 'F'} ${record.name}`;
    const codes = record.codes.map(code => (code ? code.padStart(3, ' ') : '   ')).join('    ');
    let line = head.padEnd(GRID, ' ') + codes;
    line = line.padEnd(GRID + PITCH * 7 + 5, ' ') + (record.status ?? 'PASS');
    if (record.comp) line = line.padEnd(line.length + 19, ' ') + record.comp;
    lines.push(line);
    if (record.marks) {
      const cells = record.marks.map(cell => {
        const [marks, grade] = String(cell).split(' ');
        return `${(marks ?? '').padStart(3, ' ')} ${(grade ?? '').padEnd(2, ' ')}`;
      }).join(' ');
      lines.push(' '.repeat(GRID) + cells);
    }
  }
  return lines.join('\n');
}
