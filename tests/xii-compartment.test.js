/**
 * Regression tests for the senior secondary (Class XII) compartment gazette.
 *
 * That gazette has a different layout from the Class X one:
 *  - the subjects are printed one per line instead of one per column;
 *  - a printed flag sits between the roll number and the gender;
 *  - the result column can print XXXX, a result that is not decided;
 *  - the printed summary carries an OTHER total;
 *  - the grades are printed without the marks.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseGazette, detectVerticalLayout, detectGridFromHeader } from '../src/lib/cbse/parse-gazette.js';
import { buildSubjectTable, computeAnalytics, compareWithPrintedSummary } from '../src/lib/cbse/analytics.js';
import { validateDataset } from '../src/lib/cbse/validate.js';
import { readFixture } from './helpers/gazette-fixtures.js';

function analyse() {
  const dataset = parseGazette(readFixture('gazette-xii-2026-compartment.txt'), {
    datasetId: 'xii',
    sourceFileName: 'gazette-xii-2026-compartment.txt'
  });
  dataset.subjectTable = buildSubjectTable(dataset);
  const analytics = computeAnalytics(dataset);
  return { dataset, analytics, validation: validateDataset(dataset, analytics) };
}

test('the vertical layout is detected', () => {
  const lines = readFixture('gazette-xii-2026-compartment.txt').split(/\r?\n/);
  const grid = detectGridFromHeader(lines);
  assert.equal(detectVerticalLayout(lines, grid), true);
});

test('the gazette is read as a senior secondary compartment gazette', () => {
  const { dataset } = analyse();
  assert.equal(dataset.meta.layout, 'vertical');
  assert.equal(dataset.meta.board, 'CBSE');
  assert.equal(dataset.meta.class, 'XII');
  assert.equal(dataset.meta.year, 2026);
  assert.equal(dataset.meta.session, 'COMPTT');
  assert.equal(dataset.meta.region, 'DELHI-WEST');
  assert.equal(dataset.meta.schoolCode, '27572');
  assert.equal(dataset.meta.gazetteDate, '2026-08-12');
});

test('the printed flags stay out of the candidate name', () => {
  const { dataset } = analyse();
  const first = dataset.candidates[0];
  assert.equal(first.name, 'STUDENT 001');
  assert.equal(first.gender, 'F');
  assert.equal(first.flags, 'I');
  assert.ok(!first.name.includes('STUDENT 001 I'));
});

test('the subjects are read one per line', () => {
  const { dataset } = analyse();
  const first = dataset.candidates[0];
  assert.equal(first.subjects.length, 2);
  assert.equal(first.subjects[0].code, '041');
  assert.equal(first.subjects[1].code, '065');
  assert.equal(first.subjects[1].grade.value, 'B2');
});

test('the XXXX result is a status of its own', () => {
  const { dataset, analytics } = analyse();
  const withheld = dataset.candidates.filter(candidate => candidate.statusRaw === 'XXXX');
  assert.equal(withheld.length, 5);
  assert.equal(analytics.totals.other, 5);
});

test('the recalculated totals reproduce the printed summary', () => {
  const { dataset, analytics, validation } = analyse();
  assert.deepEqual(dataset.printedSummary, {
    totalCandidates: 12,
    totalPass: 6,
    compartment: 1,
    essentialRepeat: 0,
    absent: 0,
    other: 5
  });
  const rows = compareWithPrintedSummary(dataset, analytics);
  assert.ok(rows.every(row => row.match === true), JSON.stringify(rows));
  const summary = validation.checks.filter(check => check.id.startsWith('summary-'));
  assert.ok(summary.every(check => check.status === 'pass'));
});

test('a gazette that prints grades without marks is reported, not treated as broken', () => {
  const { validation } = analyse();
  const marks = validation.checks.find(check => check.id === 'missing-marks');
  assert.equal(marks.status, 'info');
  assert.match(marks.detail, /prints the subject grades without the marks/);
  const confidence = validation.checks.find(check => check.id === 'extraction-confidence');
  assert.equal(confidence.status, 'pass');
});

test('the grades of the gazette are counted', () => {
  const { analytics } = analyse();
  const grades = Object.fromEntries(analytics.gradeDistribution.map(entry => [entry.grade, entry.count]));
  assert.deepEqual(grades, { B2: 1, C2: 1, D1: 5, D2: 3, RTE: 2 });
});

test('the compartment candidate keeps its compartment subject', () => {
  const { dataset } = analyse();
  const compartment = dataset.candidates.find(candidate => candidate.status === 'COMPARTMENT');
  assert.deepEqual(compartment.compartmentSubjects, ['042']);
  assert.equal(compartment.subjects[1].grade.value, 'RTE');
});

test('the subject codes are named from the Class XII knowledge base', () => {
  const { dataset } = analyse();
  const names = Object.fromEntries(dataset.subjectTable.map(subject => [subject.code, subject.name]));
  assert.equal(names['041'], 'Mathematics');
  assert.equal(names['043'], 'Chemistry');
  assert.equal(names['002'], 'Hindi Elective');
  assert.equal(names['028'], 'Political Science');
  assert.equal(names['054'], 'Business Studies');
  assert.equal(names['065'], 'Informatics Practices');
});
