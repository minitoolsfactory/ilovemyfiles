import fs from 'node:fs';
import path from 'node:path';

/**
 * Build an anonymised copy of a gazette.
 *
 * The candidate names and the roll numbers are replaced with synthetic ones
 * and the line lengths are kept, so the printed columns stay where they are.
 */
export function anonymiseGazette(source, target) {
  const lines = fs.readFileSync(source, 'utf8').split(/\r?\n/);
  const rolls = new Map();
  let sequence = 0;
  const out = lines.map(line => {
    const match = /^(\d{8})([\s\S]*)$/.exec(line);
    if (!match) return line;
    const [, roll, rest] = match;
    if (!rolls.has(roll)) {
      sequence += 1;
      rolls.set(roll, `9${String(7000000 + sequence)}`);
    }
    const nameMatch = /^(\s+(?:[A-Z]\s+)?[FM]\s+)([A-Z][A-Z ]*?)(\s{2,})([\s\S]*)$/.exec(rest);
    if (!nameMatch) return rolls.get(roll) + rest;
    const [, head, name, pad, tail] = nameMatch;
    const label = `STUDENT ${String(sequence).padStart(3, '0')}`;
    const gap = pad.length - (label.length - name.length);
    if (gap < 0) throw new Error(`the name does not fit the column in ${source}`);
    return rolls.get(roll) + head + label + ' '.repeat(gap) + tail;
  });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, out.join('\n'), 'utf8');
  return { records: sequence, length: out.join('\n').length };
}
