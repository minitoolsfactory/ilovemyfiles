/**
 * CBSE result gazette parser.
 *
 * The parser turns the raw text of a CBSE school/roll-number-wise gazette into
 * a normalised dataset. It supports two source layouts:
 *
 *  1. `grid`   - a fixed-width (monospace) gazette, either a .txt export or the
 *                text layer of a text-based PDF. The subject grid is recovered
 *                from the printed column header ("MKS GR" / "SUB CD") and
 *                every cell is read at an exact column offset, so blank
 *                subject slots and unusual subject ordering survive intact.
 *  2. `loose`  - OCR output, where the monospace grid is unreliable. The parser
 *                falls back to token analysis and marks the result as
 *                lower-confidence.
 *
 * Design rules enforced here:
 *  - Original values are preserved next to normalised values.
 *  - A printed result status is recorded as printed. It is never inferred
 *    from marks.
 *  - Anything that could not be read with confidence is flagged, never guessed.
 *
 * @typedef {Object} ParsedSubject
 * @property {string} code            subject code as printed (may be empty)
 * @property {{ raw: string, value: number|null }} marks
 * @property {{ raw: string, value: string|null }} grade
 * @property {number} slot            column index of the subject
 * @property {string[]} warnings
 *
 * @typedef {Object} ParsedCandidate
 * @property {string} recordId        stable internal identifier
 * @property {string} rollNo
 * @property {string} name
 * @property {string} gender
 * @property {string} status          canonical status key
 * @property {string} statusRaw       status exactly as printed
 * @property {string[]} compartmentSubjects
 * @property {ParsedSubject[]} subjects
 * @property {number} confidence      0..1
 * @property {string[]} warnings
 *
 * @typedef {Object} ParsedDataset
 * @property {Object} meta
 * @property {ParsedCandidate[]} candidates
 * @property {Object} issues
 */

import {
  RESULT_STATUS,
  STATUS_META,
  STATUS_TOKENS,
  resolveSubject
} from './subjects.js';

const ROLL_PATTERN = /^(\d{6,12})(?=\s)/;
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
const STATUS_LOOKUP = new Map(STATUS_TOKENS.map(entry => [entry.token.toUpperCase(), entry.status]));

/**
 * @param {string} raw
 * @returns {string}
 */
function cleanText(raw) {
  return String(raw ?? '').replace(CONTROL_CHARS, '\n').replace(/\r\n?/g, '\n');
}

/**
 * Split raw text into logical lines, remembering which page each line came from.
 * Form feeds and repeated page headers are used to detect page boundaries.
 *
 * @param {string} text
 * @returns {{ lines: string[], pageOf: number[] }}
 */
export function splitLines(text) {
  const lines = [];
  const pageOf = [];
  let page = 1;
  const raw = cleanText(text).split('\n');
  for (const line of raw) {
    if (/^\s*PAGE\s*:-\s*\d+/i.test(line)) {
      const printed = Number((line.match(/PAGE\s*:-\s*(\d+)/i) ?? [])[1]);
      if (Number.isFinite(printed)) page = printed;
    }
    // Trailing whitespace is preserved: a blank-but-present marks line is a
    // meaningful signal (an absent candidate) and must be distinguishable
    // from a zero-length separator line.
    lines.push(line);
    pageOf.push(page);
  }
  return { lines, pageOf };
}

/**
 * Locate the printed result-status token in a line.
 *
 * @param {string} line
 * @returns {{ status: string, raw: string, index: number, end: number }|null}
 */
export function findStatus(line) {
  const upper = String(line ?? '').toUpperCase();
  let best = null;
  for (const [token, status] of STATUS_LOOKUP) {
    const index = upper.indexOf(token);
    if (index === -1) continue;
    if (!best || index < best.index) {
      const before = upper[index - 1] ?? ' ';
      const after = upper[index + token.length] ?? ' ';
      if (/\s/.test(before) && (/\s/.test(after) || after === '')) {
        best = { status, raw: line.slice(index, index + token.length), index, end: index + token.length };
      }
    }
  }
  return best;
}

/**
 * Detect the fixed-width subject grid from the printed column header.
 *
 * @param {string[]} lines
 * @returns {{ start: number, pitch: number, count: number, source: string }|null}
 */
export function detectGridFromHeader(lines) {
  for (const line of lines) {
    for (const marker of ['MKS GR', 'MKS  GR', 'MKSGR']) {
      const matches = [...line.matchAll(new RegExp(marker.replace(/ /g, '\\s+'), 'g'))];
      if (matches.length < 2) continue;
      const start = matches[0].index;
      const pitch = matches[1].index - start;
      if (pitch <= 0) continue;
      return { start, pitch, count: matches.length, source: 'header' };
    }
  }
  for (const line of lines) {
    const matches = [...line.matchAll(/SUB\s+CD/g)];
    if (matches.length < 2) continue;
    const start = matches[0].index;
    const pitch = matches[1].index - start;
    if (pitch <= 0) continue;
    return { start, pitch, count: matches.length, source: 'header' };
  }
  return null;
}

/**
 * Detect the subject grid from the data itself by finding the most common
 * (start, pitch) of the printed 3-digit subject codes.
 *
 * @param {string[]} lines
 * @returns {{ start: number, pitch: number, count: number, source: string }|null}
 */
export function detectGridFromData(lines) {
  const histogram = new Map();
  for (const line of lines) {
    const rollMatch = ROLL_PATTERN.exec(line);
    if (!rollMatch) continue;
    // Ignore the roll number itself, it is not a subject code.
    const matches = [...line.slice(rollMatch[0].length).matchAll(/\d{3}/g)];
    if (matches.length < 2) continue;
    const positions = matches.map(match => match.index + rollMatch[0].length);

    // A candidate name can contain a three digit number, so the subject codes
    // are the longest run of tokens that share the most common gap.
    const gaps = new Map();
    for (let i = 1; i < positions.length; i += 1) {
      const gap = positions[i] - positions[i - 1];
      gaps.set(gap, (gaps.get(gap) ?? 0) + 1);
    }
    let pitch = 0;
    let best = -1;
    for (const [gap, weight] of gaps) {
      if (weight > best) {
        best = weight;
        pitch = gap;
      }
    }
    if (pitch <= 0) continue;

    let start = positions[0];
    let count = 1;
    let runStart = positions[0];
    let runCount = 1;
    for (let i = 1; i < positions.length; i += 1) {
      if (positions[i] - positions[i - 1] === pitch) {
        runCount += 1;
      } else {
        runStart = positions[i];
        runCount = 1;
      }
      if (runCount > count) {
        count = runCount;
        start = runStart;
      }
    }
    if (count < 2) continue;

    const key = `${start}:${pitch}:${count}`;
    histogram.set(key, (histogram.get(key) ?? 0) + 1);
  }
  let best = null;
  for (const [key, weight] of histogram) {
    if (!best || weight > best.weight) best = { key, weight };
  }
  if (!best) return null;
  const [start, pitch, count] = best.key.split(':').map(Number);
  return { start, pitch, count, source: 'data' };
}

/**
 * Read the printed subject code out of a fixed-width cell.
 *
 * @param {string} cell
 * @returns {string}
 */
function readCodeCell(cell) {
  const match = cell.match(/^\s*(\d{3})(?=\s|$)/);
  return match ? match[1] : '';
}

/**
 * Read the printed marks and grade out of a fixed-width cell.
 *
 * @param {string} cell
 * @returns {{ marks: string, grade: string }}
 */
function readMarkCell(cell) {
  const trimmed = cell.trim();
  if (!trimmed) return { marks: '', grade: '' };
  const withMarks = trimmed.match(/^(\d{1,3})\s*([A-Za-z]{1,3}\d?)?$/);
  if (withMarks) return { marks: withMarks[1], grade: (withMarks[2] ?? '').toUpperCase() };
  const gradeOnly = trimmed.match(/^([A-Za-z]{1,3}\d?)$/);
  if (gradeOnly) return { marks: '', grade: gradeOnly[1].toUpperCase() };
  return { marks: '', grade: '' };
}

/**
 * Split the "name and flags" part of a record.
 *
 * @param {string} raw
 * @returns {{ name: string, gender: string }}
 */
function splitNameAndFlags(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return { name: '', gender: '' };
  const tokens = value.split(/\s+/);
  let gender = '';
  let rest = tokens;
  if ((tokens[0] === 'F' || tokens[0] === 'M') && tokens.length > 1) {
    gender = tokens[0];
    rest = tokens.slice(1);
  }
  return { name: rest.join(' ').trim(), gender };
}

/**
 * Extract examination metadata from the gazette header, school line and summary.
 *
 * @param {string[]} lines
 * @returns {{ meta: Object, printedSummary: Object|null }}
 */
export function extractMeta(lines) {
  const meta = {
    board: '',
    examName: '',
    year: null,
    class: '',
    classSource: 'unknown',
    session: '',
    region: '',
    schoolCode: '',
    schoolName: '',
    gazetteDate: '',
    gazetteDateRaw: '',
    pageCount: 0
  };
  let printedSummary = null;

  for (const line of lines) {
    const header = line.match(
      /DATE\s*:?\s*-?\s*(\d{1,2})-(\d{1,2})-(\d{4})\s+(.*?)\s+REGION\s*:?\s*-?\s*(.*?)\s+PAGE\s*:?\s*-?\s*(\d+)/i
    );
    if (header) {
      const [, day, month, year, examRaw, region] = header;
      if (!meta.gazetteDate) {
        meta.gazetteDateRaw = `${day}-${month}-${year}`;
        const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
        if (!Number.isNaN(parsed.getTime())) meta.gazetteDate = parsed.toISOString().slice(0, 10);
      }
      const dash = examRaw.indexOf(' - ');
      const board = dash > -1 ? examRaw.slice(0, dash) : '';
      let name = dash > -1 ? examRaw.slice(dash + 3) : examRaw;
      const yearMatch = name.match(/[-–—]\s*(\d{4})\s*$/);
      if (yearMatch) {
        meta.year = Number(yearMatch[1]);
        name = name.slice(0, yearMatch.index).trim();
      }
      if (board) meta.board = board.replace(/\./g, '').toUpperCase();
      if (name && !meta.examName) meta.examName = name.trim();
      if (region && !meta.region) meta.region = region.trim();
      const session = name.match(/\(([^)]+)\)/);
      if (session && !meta.session) meta.session = session[1].trim().toUpperCase();
      if (/SENIOR\s+SECONDARY/i.test(name)) {
        meta.class = 'XII';
        meta.classSource = 'exam-name';
      } else if (/SECONDARY/i.test(name)) {
        meta.class = 'X';
        meta.classSource = 'exam-name';
      }
      meta.pageCount = Math.max(meta.pageCount, Number(header[6]) || 0);
      continue;
    }

    const school = line.match(/^\s*SCHOOL\s*:?\s*-?\s*(\S+)\s+(.*)$/i);
    if (school && !meta.schoolCode) {
      meta.schoolCode = school[1].trim();
      meta.schoolName = school[2].trim();
      continue;
    }

    if (/TOTAL\s+CANDIDATES/i.test(line)) {
      const pick = (re) => {
        const found = line.match(re);
        return found ? Number(found[1]) : null;
      };
      printedSummary = {
        totalCandidates: pick(/TOTAL\s+CANDIDATES\s*:?\s*-?\s*(\d+)/i),
        totalPass: pick(/TOTAL\s+PASS\s*:?\s*-?\s*(\d+)/i),
        compartment: pick(/TOTAL\s+COMP[A-Z]*\s*\.?\s*:?\s*-?\s*(\d+)/i),
        essentialRepeat: pick(/TOTAL\s+ESSENTIAL\s+REPEAT\s*:?\s*-?\s*(\d+)/i),
        absent: pick(/TOTAL\s+ABSENT\s*:?\s*-?\s*(\d+)/i)
      };
      continue;
    }
  }

  return { meta, printedSummary };
}

/**
 * Score how well a grid matches the printed records and their marks lines.
 *
 * @param {string[]} lines
 * @param {{ start: number, pitch: number, count: number }} grid
 * @returns {{ codes: number, marks: number|null }}
 */
export function scoreGrid(lines, grid) {
  const recordIndexes = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (ROLL_PATTERN.test(lines[index])) recordIndexes.push(index);
  }
  if (!recordIndexes.length) return { codes: 0, marks: null };

  let codeHits = 0;
  let markLines = 0;
  let markHits = 0;
  for (const index of recordIndexes) {
    const line = lines[index];
    if (/^\s*\d{3}(?=\s|$)/.test(line.slice(grid.start, grid.start + 3))) codeHits += 1;
    const next = lines[index + 1] ?? '';
    if (next.trim() && !ROLL_PATTERN.test(next)) {
      markLines += 1;
      if (/^\s*\d{1,3}\s+[A-Za-z]{1,3}\d?(?=\s|$)/.test(next.slice(grid.start, grid.start + 5))) markHits += 1;
    }
  }
  return {
    codes: codeHits / recordIndexes.length,
    marks: markLines ? markHits / markLines : null
  };
}

/**
 * Choose the grid that actually matches the records.
 *
 * @param {string[]} lines
 * @param {Object[]} grids
 * @returns {{ grid: Object|null, reason: string }}
 */
function chooseGrid(lines, grids) {
  let best = null;
  for (const grid of grids) {
    if (!grid) continue;
    const score = scoreGrid(lines, grid);
    const value = score.codes + (score.marks ?? 0);
    if (!best || value > best.value) best = { grid, score, value };
  }
  if (!best) return { grid: null, reason: 'no-grid' };
  if (best.score.codes < 0.6) return { grid: null, reason: 'codes-do-not-match' };
  if (best.score.marks !== null && best.score.marks < 0.5) return { grid: null, reason: 'marks-do-not-match' };
  return { grid: best.grid, reason: 'matched' };
}

/**
 * Parse a gazette from raw text.
 *
 * @param {string} rawText
 * @param {Object} [options]
 * @param {string} [options.sourceFileName]
 * @param {string} [options.datasetId]
 * @param {'auto'|'grid'|'loose'} [options.layout]
 * @param {Object} [options.subjectOverrides]
 * @returns {ParsedDataset}
 */
export function parseGazette(rawText, options = {}) {
  const { lines, pageOf } = splitLines(rawText);
  const { meta, printedSummary } = extractMeta(lines);
  const datasetId = options.datasetId ?? 'ds-1';
  const issues = [];

  const headerGrid = detectGridFromHeader(lines);
  const dataGrid = detectGridFromData(lines);
  let grid = null;
  let layout = options.layout && options.layout !== 'auto' ? options.layout : 'auto';

  if (layout === 'auto') {
    const chosen = chooseGrid(lines, [headerGrid, dataGrid]);
    grid = chosen.grid;
    layout = grid ? 'grid' : 'loose';
    if (headerGrid && dataGrid && headerGrid.start !== dataGrid.start) {
      issues.push({
        code: 'grid-mismatch',
        severity: 'warning',
        message: `The printed column header and the records disagree (header column ${headerGrid.start}, records column ${dataGrid.start}). The layout that matches the records was used.`
      });
    }
    if (!grid) {
      issues.push({
        code: 'grid-unusable',
        severity: 'warning',
        message: 'The printed columns could not be matched to the records, so token-based parsing was used instead.'
      });
    }
  } else if (layout === 'grid') {
    grid = headerGrid ?? dataGrid;
    if (!grid) {
      layout = 'loose';
      issues.push({
        code: 'grid-missing',
        severity: 'warning',
        message: 'No fixed-width column layout could be detected, so token-based parsing was used instead.'
      });
    }
  }

  const candidates = layout === 'grid'
    ? parseFixedWidth(lines, pageOf, grid, datasetId, issues)
    : parseLoose(lines, pageOf, datasetId, issues);

  if (!candidates.length) {
    issues.push({
      code: 'no-records',
      severity: 'error',
      message: 'No candidate records could be read from this file.'
    });
  }

  const subjectOrder = deriveSubjectOrder(candidates);

  return {
    meta: {
      ...meta,
      sourceFileName: options.sourceFileName ?? '',
      importedAt: options.importedAt ?? new Date().toISOString(),
      layout,
      grid: grid ? { start: grid.start, pitch: grid.pitch, count: grid.count, source: grid.source } : null
    },
    candidates,
    printedSummary,
    subjectOrder,
    issues
  };
}

/**
 * @param {ParsedCandidate[]} candidates
 * @returns {string[]}
 */
function deriveSubjectOrder(candidates) {
  const counts = new Map();
  for (const candidate of candidates) {
    const codes = candidate.subjects.map(subject => subject.code).filter(Boolean);
    const key = codes.join('|');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = [];
  let bestWeight = -1;
  for (const [key, weight] of counts) {
    if (weight > bestWeight) {
      bestWeight = weight;
      best = key ? key.split('|') : [];
    }
  }
  return best;
}

/**
 * Parse a fixed-width gazette.
 *
 * @param {string[]} lines
 * @param {number[]} pageOf
 * @param {{ start: number, pitch: number, count: number }} grid
 * @param {string} datasetId
 * @param {Object[]} issues
 * @returns {ParsedCandidate[]}
 */
function parseFixedWidth(lines, pageOf, grid, datasetId, issues) {
  const candidates = [];
  let sequence = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const rollMatch = ROLL_PATTERN.exec(line);
    if (!rollMatch) continue;
    const rollNo = rollMatch[1];
    const regionEnd = grid.start + grid.pitch * grid.count;
    const prefix = line.slice(rollMatch[0].length, grid.start);
    const codeRegion = line.slice(grid.start, regionEnd);
    const tail = line.slice(regionEnd);

    const statusHit = findStatus(tail);
    const statusRaw = statusHit
      ? statusHit.raw.trim()
      : (tail.trim().split(/\s+/).filter(Boolean).pop() ?? '');
    const status = statusHit ? statusHit.status : RESULT_STATUS.OTHER;

    // The compartment subject code follows the status token when printed.
    const compartmentSubjects = [];
    if (statusHit) {
      const after = tail.slice(statusHit.end);
      const compMatch = after.match(/\b(\d{3})\b/);
      if (compMatch && status === RESULT_STATUS.COMPARTMENT) compartmentSubjects.push(compMatch[1]);
    }

    // The marks line is the following line, when it is not another record.
    const nextLine = lines[index + 1] ?? '';
    const nextIsRecord = ROLL_PATTERN.test(nextLine);
    const marksLine = nextIsRecord ? '' : nextLine;
    const hasMarksLine = Boolean(marksLine.trim()) || (!nextIsRecord && marksLine.length > 0);

    const subjects = [];
    for (let slot = 0; slot < grid.count; slot += 1) {
      const offset = grid.start + slot * grid.pitch;
      const code = readCodeCell(codeRegion.slice(slot * grid.pitch, slot * grid.pitch + grid.pitch));
      const mark = readMarkCell(hasMarksLine ? marksLine.slice(offset, offset + grid.pitch) : '');
      subjects.push(buildSubject({ code }, mark, slot));
    }

    const { name, gender } = splitNameAndFlags(prefix);
    const warnings = [];
    if (!statusHit) {
      warnings.push('result-status-unread');
      issues.push({ code: 'status-unread', severity: 'warning', message: `Roll number ${rollNo} has no readable result status.` });
    }
    if (!name) warnings.push('name-unread');
    if (hasMarksLine && status !== RESULT_STATUS.ABSENT) {
      const withMarks = subjects.filter(subject => subject.marks.value !== null).length;
      if (!withMarks) warnings.push('marks-unread');
    }
    if (status === RESULT_STATUS.ABSENT && hasMarksLine && marksLine.trim()) {
      warnings.push('absent-with-marks');
    }

    candidates.push({
      recordId: `${datasetId}:cand-${String(sequence + 1).padStart(4, '0')}`,
      sequence: sequence + 1,
      rollNo,
      rollNoRaw: rollNo,
      name,
      nameRaw: prefix.trim(),
      gender,
      status,
      statusRaw,
      statusPrinted: Boolean(statusHit),
      statusSource: statusHit ? 'printed' : 'unreadable',
      compartmentSubjects,
      subjects,
      page: pageOf[index] ?? 1,
      line: index + 1,
      confidence: scoreConfidence({ name, statusHit, subjects, hasMarksLine, status }),
      warnings
    });
    sequence += 1;
  }

  return candidates;
}

/**
 * Parse an OCR (non fixed-width) gazette using token analysis.
 *
 * @param {string[]} lines
 * @param {number[]} pageOf
 * @param {string} datasetId
 * @param {Object[]} issues
 * @returns {ParsedCandidate[]}
 */
function parseLoose(lines, pageOf, datasetId, issues) {
  const recordLines = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!ROLL_PATTERN.test(line)) continue;
    if (!findStatus(line)) continue;
    recordLines.push(index);
  }

  // The number of mark/grade pairs on a marks line is the most reliable
  // measure of the subject count, because a marks line only ever holds
  // pairs. The count of numeric tokens on a code line is used as a fallback
  // and can be too high when a candidate name contains a number.
  const pairCounts = new Map();
  const numericCounts = new Map();
  for (const index of recordLines) {
    const line = lines[index];
    const statusHit = findStatus(line);
    const beforeStatus = line.slice(0, statusHit ? statusHit.index : line.length);
    const tokens = beforeStatus.trim().split(/\s+/).filter(Boolean);
    let numeric = 0;
    for (let i = tokens.length - 1; i >= 1; i -= 1) {
      if (/^\d{3}$/.test(tokens[i])) numeric += 1;
      else break;
    }
    numericCounts.set(numeric, (numericCounts.get(numeric) ?? 0) + 1);
    pairCounts.set(readMarkPairs(lines, index).length, (pairCounts.get(readMarkPairs(lines, index).length) ?? 0) + 1);
  }
  let expected = 0;
  let bestWeight = -1;
  for (const [count, weight] of pairCounts) {
    if (count > 0 && weight > bestWeight) {
      bestWeight = weight;
      expected = count;
    }
  }
  if (!expected) {
    for (const [count, weight] of numericCounts) {
      if (weight > bestWeight) {
        bestWeight = weight;
        expected = count;
      }
    }
  }

  const candidates = [];
  let sequence = 0;

  for (const index of recordLines) {
    const line = lines[index];
    const rollMatch = ROLL_PATTERN.exec(line);
    const rollNo = rollMatch[1];
    const statusHit = findStatus(line);
    const status = statusHit ? statusHit.status : RESULT_STATUS.OTHER;
    const statusRaw = statusHit
      ? statusHit.raw.trim()
      : (line.trim().split(/\s+/).filter(Boolean).pop() ?? '');

    const beforeStatus = line.slice(0, statusHit ? statusHit.index : line.length);
    const tokens = beforeStatus.trim().split(/\s+/).filter(Boolean);
    const numericTokens = [];
    for (let i = tokens.length - 1; i >= 1; i -= 1) {
      if (/^\d{3}$/.test(tokens[i])) numericTokens.unshift(tokens[i]);
      else break;
    }
    const pairs = readMarkPairs(lines, index);
    // The last subject code is printed above the last mark, so the codes are
    // aligned from the right. A name that ends in a number would otherwise
    // push every code one slot to the left.
    const codeCount = pairs.length && pairs.length <= numericTokens.length ? pairs.length : expected;
    const codes = numericTokens.slice(-codeCount);
    const nameTokens = tokens.slice(1, Math.max(1, tokens.length - codes.length));
    const { name, gender } = splitNameAndFlags(nameTokens.join(' '));

    const compartmentSubjects = [];
    if (status === RESULT_STATUS.COMPARTMENT && statusHit) {
      const after = line.slice(statusHit.end);
      const compMatch = after.match(/\b(\d{3})\b/);
      if (compMatch) compartmentSubjects.push(compMatch[1]);
    }

    const subjects = [];
    for (let slot = 0; slot < expected; slot += 1) {
      const code = codes[slot] ?? '';
      const pair = pairs[slot];
      subjects.push(buildSubject(
        { code },
        { marks: pair ? pair.marks : '', grade: pair ? pair.grade : '' },
        slot
      ));
    }

    const warnings = [];
    if (codes.length < expected) {
      warnings.push('subject-count-low');
      issues.push({
        code: 'subject-count-low',
        severity: 'warning',
        message: `Roll number ${rollNo}: expected ${expected} subject codes but found ${codes.length}.`
      });
    }
    if (pairs.length && pairs.length !== expected) {
      warnings.push('marks-count-mismatch');
    }
    if (!name) warnings.push('name-unread');

    candidates.push({
      recordId: `${datasetId}:cand-${String(sequence + 1).padStart(4, '0')}`,
      sequence: sequence + 1,
      rollNo,
      rollNoRaw: rollNo,
      name,
      nameRaw: nameTokens.join(' '),
      gender,
      status,
      statusRaw,
      statusPrinted: Boolean(statusHit),
      statusSource: statusHit ? 'printed' : 'unreadable',
      compartmentSubjects,
      subjects,
      page: pageOf[index] ?? 1,
      line: index + 1,
      confidence: scoreConfidence({ name, statusHit, subjects, hasMarksLine: pairs.length > 0, status }) * 0.8,
      warnings
    });
    sequence += 1;
  }

  issues.push({
    code: 'loose-layout',
    severity: 'info',
    message: 'Token-based parsing was used. Confirm the subject order and marks in the review step before publishing any figure.'
  });

  return candidates;
}

/**
 * Read the mark/grade pairs that follow a record line.
 *
 * @param {string[]} lines
 * @param {number} index
 * @returns {Array<{ marks: string, grade: string }>}
 */
function readMarkPairs(lines, index) {
  const pairs = [];
  let cursor = index + 1;
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (!line.trim()) break;
    if (ROLL_PATTERN.test(line)) break;
    const tokens = line.trim().split(/\s+/);
    const rowPairs = [];
    let ok = true;
    for (let i = 0; i < tokens.length; i += 1) {
      if (/^\d{1,3}$/.test(tokens[i])) {
        const grade = tokens[i + 1] && /^[A-Za-z]{1,2}\d?$/.test(tokens[i + 1]) ? tokens[i + 1] : '';
        rowPairs.push({ marks: tokens[i], grade });
        i += 1;
      } else {
        ok = false;
        break;
      }
    }
    if (!ok || !rowPairs.length) break;
    pairs.push(...rowPairs);
    cursor += 1;
  }
  return pairs;
}

/**
 * @param {{ code: string, marks: string, grade: string }} codeCell
 * @param {{ code: string, marks: string, grade: string }} markCell
 * @param {number} slot
 * @returns {ParsedSubject}
 */
function buildSubject(codeCell, markCell, slot) {
  const warnings = [];
  const code = (codeCell.code ?? '').trim();
  const marksRaw = (markCell.marks ?? '').trim();
  const gradeRaw = (markCell.grade ?? '').trim().toUpperCase();
  const marksValue = /^\d{1,3}$/.test(marksRaw) ? Number(marksRaw) : null;
  if (marksRaw && marksValue === null) warnings.push('marks-not-numeric');
  if (code && !/^\d{3}$/.test(code)) warnings.push('subject-code-unread');
  return {
    slot,
    code,
    codeRaw: codeCell.code ?? '',
    marks: { raw: marksRaw, value: marksValue },
    grade: { raw: gradeRaw, value: gradeRaw || null },
    warnings
  };
}

/**
 * @param {{ name: string, statusHit: Object|null, subjects: ParsedSubject[], hasMarksLine: boolean, status: string }} input
 * @returns {number}
 */
function scoreConfidence({ name, statusHit, subjects, hasMarksLine, status }) {
  let score = 1;
  if (!name) score -= 0.35;
  if (!statusHit) score -= 0.3;
  if (status === RESULT_STATUS.ABSENT) {
    return Math.max(0.05, Math.min(1, score - 0.1));
  }
  if (!hasMarksLine) {
    score -= 0.3;
    return Math.max(0.05, Math.min(1, score));
  }
  const coded = subjects.filter(subject => subject.code).length;
  const marked = subjects.filter(subject => subject.marks.value !== null).length;
  if (coded) score -= 0.25 * (1 - coded / subjects.length);
  if (marked) score -= 0.25 * (1 - marked / subjects.length);
  const ungraded = subjects.filter(subject => subject.marks.value !== null && !subject.grade.value).length;
  if (ungraded) score -= 0.1 * (ungraded / Math.max(1, marked));
  return Math.max(0.05, Math.min(1, Number(score.toFixed(3))));
}

/**
 * Attach resolved subject metadata to a parsed dataset.
 *
 * @param {ParsedDataset} dataset
 * @param {Record<string, { name?: string, max?: number }>} [overrides]
 * @returns {ParsedDataset}
 */
export function applySubjectOverrides(dataset, overrides = {}) {
  const subjects = new Map();
  for (const candidate of dataset.candidates) {
    for (const subject of candidate.subjects) {
      if (!subject.code) continue;
      const resolved = resolveSubject(subject.code, { overrides });
      const existing = subjects.get(subject.code) ?? { code: subject.code, resolved, observedMax: 0, count: 0, missing: 0 };
      existing.count += 1;
      if (subject.marks.value !== null) {
        existing.observedMax = Math.max(existing.observedMax, subject.marks.value);
      } else {
        existing.missing += 1;
      }
      subjects.set(subject.code, existing);
    }
  }
  return { ...dataset, subjects: [...subjects.values()] };
}

/**
 * Build a human readable label for a canonical status.
 *
 * @param {string} status
 * @returns {string}
 */
export function statusLabel(status) {
  return STATUS_META[status]?.label ?? 'Other / unknown';
}
