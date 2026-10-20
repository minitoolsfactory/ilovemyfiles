import test from 'node:test';
import assert from 'node:assert/strict';

import { parseGazette } from '../src/lib/cbse/parse-gazette.js';
import { buildSubjectTable, computeAnalytics } from '../src/lib/cbse/analytics.js';
import { validateDataset, checkLabel } from '../src/lib/cbse/validate.js';
import { detectGradeBasis } from '../src/lib/cbse/grade-basis.js';
import { readFixture } from './helpers/gazette-fixtures.js';

function analyse(name) {
  const dataset = parseGazette(readFixture(name), { datasetId: 'ds1' });
  dataset.subjectTable = buildSubjectTable(dataset);
  const analytics = computeAnalytics(dataset);
  return { dataset, analytics, validation: validateDataset(dataset, analytics) };
}

function check(validation, id) {
  return validation.checks.find(entry => entry.id === id);
}

test('the clean gazette agrees with every printed total', () => {
  const { validation } = analyse('gazette-27572-2025.txt');
  for (const id of ['summary-totalCandidates', 'summary-totalPass', 'summary-compartment', 'summary-essentialRepeat', 'summary-absent']) {
    assert.equal(check(validation, id).status, 'pass', `${id} should pass`);
  }
});

test('the clean gazette has no duplicate roll numbers', () => {
  const { validation } = analyse('gazette-27572-2025.txt');
  assert.equal(check(validation, 'duplicate-rolls').status, 'pass');
});

test('a duplicated roll number is reported', () => {
  const { validation } = analyse('gazette-27572-2025-errors.txt');
  const entry = check(validation, 'duplicate-rolls');
  assert.equal(entry.status, 'fail');
  assert.ok(entry.detail.includes('92000002'));
});

test('a status that is not in the CBSE vocabulary is counted as other', () => {
  const { dataset, analytics } = analyse('gazette-27572-2025-errors.txt');
  assert.equal(analytics.totals.other, 1);
  const record = dataset.candidates.find(candidate => candidate.statusRaw === 'PENDING');
  assert.equal(record.status, 'OTHER');
  assert.equal(record.statusPrinted, false);
});

test('an unreadable result status is reported', () => {
  const { validation } = analyse('gazette-27572-2025-errors.txt');
  const entry = check(validation, 'result-status');
  assert.equal(entry.status, 'fail');
  assert.ok(entry.detail.includes('other'));
});

test('a mark above the maximum in force is reported', () => {
  const { validation } = analyse('gazette-27572-2025-errors.txt');
  const implausible = check(validation, 'marks-implausible');
  assert.equal(implausible.status, 'fail');
  assert.ok(implausible.count >= 1);
  const scale = check(validation, 'subject-scale');
  assert.equal(scale.status, 'warn');
  assert.ok(scale.detail.includes('maximum in the review step'));
});

test('a missing mark is reported and counted apart from the unreadable ones', () => {
  const { validation } = analyse('gazette-27572-2025-errors.txt');
  const entry = check(validation, 'missing-marks');
  assert.equal(entry.status, 'warn');
  assert.equal(entry.count, 1);
});

test('a record with a subject code that was not read is reported', () => {
  const { validation } = analyse('gazette-27572-2025-errors.txt');
  const entry = check(validation, 'subject-count');
  assert.equal(entry.status, 'warn');
  assert.ok(entry.detail.includes('fewer subject codes'));
});

test('a printed grade that does not follow a known CBSE table is reported as a warning', () => {
  const { validation } = analyse('gazette-27572-2025.txt');
  const entry = check(validation, 'grade-marks');
  assert.equal(entry.status, 'warn');
  assert.ok(entry.detail.includes('grade(s)'));
  assert.ok(entry.detail.includes('grading basis is not disclosed'));
  assert.ok(entry.detail.includes('never used to derive a result'));
});

test('the grading basis of a gazette is reported for every subject', () => {
  const { validation } = analyse('gazette-27572-2025.txt');
  const entry = check(validation, 'grade-basis');
  assert.equal(entry.status, 'warn');
  assert.ok(entry.count >= 1);
  assert.ok(entry.detail.includes('grading basis is not disclosed'));
});

test('a grade that follows a known CBSE table is checked against the mark', () => {
  const entries = [];
  for (let marks = 0; marks <= 100; marks += 1) {
    const grade = marks >= 93 ? 'A1' : marks >= 81 ? 'A2' : marks >= 69 ? 'B1' : marks >= 51 ? 'B2' : marks >= 35 ? 'C1' : marks >= 21 ? 'C2' : marks >= 11 ? 'D1' : marks >= 1 ? 'D2' : 'E';
    entries.push({ marks, grade });
  }
  const basis = detectGradeBasis(entries);
  assert.equal(basis.established, true);
  assert.equal(basis.max, 100);
  assert.equal(basis.rate, 1);
});

test('grades that follow no known CBSE table are never treated as established', () => {
  const entries = [];
  for (let marks = 30; marks <= 90; marks += 1) {
    entries.push({ marks, grade: marks >= 60 ? 'A1' : marks >= 45 ? 'B1' : 'C2' });
  }
  const basis = detectGradeBasis(entries);
  assert.equal(basis.established, false);
  assert.equal(basis.reason, 'no-known-table');
});

test('a subject with too few entries is never treated as established', () => {
  const basis = detectGradeBasis([{ marks: 80, grade: 'A1' }, { marks: 40, grade: 'C1' }]);
  assert.equal(basis.established, false);
  assert.equal(basis.reason, 'too-few-entries');
});

test('an unmapped subject code is reported so a name can be set for it', () => {
  const { validation } = analyse('gazette-27572-2025.txt');
  const entry = check(validation, 'subject-names');
  assert.equal(entry.status, 'warn');
  assert.ok(entry.count >= 1);
});

test('an unusual subject order is reported but the records are not realigned', () => {
  const { dataset, validation } = analyse('gazette-27572-2025.txt');
  const entry = check(validation, 'subject-order');
  assert.equal(entry.status, 'info');
  assert.ok(entry.count >= 1);
  const record = dataset.candidates.find(candidate => candidate.subjects[0].code === '184');
  assert.ok(record, 'the record with the different order keeps its own order');
  assert.equal(record.subjects[0].code, '184');
});

test('every check carries a status, a label and a detail', () => {
  const { validation } = analyse('gazette-27572-2025.txt');
  assert.ok(validation.checks.length >= 10);
  for (const entry of validation.checks) {
    assert.ok(['pass', 'warn', 'fail', 'info'].includes(entry.status), `${entry.id} status`);
    assert.ok(entry.label.length > 0, `${entry.id} label`);
    assert.ok(entry.detail.length > 0, `${entry.id} detail`);
  }
});

test('a warning code has a readable label', () => {
  assert.equal(checkLabel('result-status-unread'), 'No readable result status was found.');
  assert.equal(checkLabel('unknown-code'), 'unknown-code');
});
