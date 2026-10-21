/**
 * Regression tests for the supplied CBSE gazette.
 *
 * The fixture is the school and roll-number-wise gazette of CBSE Class 10,
 * examination year 2025, school code 27572, with the printed summary
 *
 *   Total candidates: 137   Total pass: 133   Compartment: 3
 *   Essential repeat: 0     Absent: 1
 *
 * The candidate names, roll numbers and the school name were replaced with
 * synthetic values so that no student data is kept in the repository. The
 * printed layout, the subject codes, the marks, the grades, the result
 * statuses and the printed totals are unchanged.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseGazette } from '../src/lib/cbse/parse-gazette.js';
import { buildSubjectTable, computeAnalytics } from '../src/lib/cbse/analytics.js';
import { validateDataset } from '../src/lib/cbse/validate.js';
import { readFixture } from './helpers/gazette-fixtures.js';

const PRINTED = {
  totalCandidates: 137,
  totalPass: 133,
  compartment: 3,
  essentialRepeat: 0,
  absent: 1
};

function analyse(name = 'gazette-27572-2025.txt') {
  const dataset = parseGazette(readFixture(name), { datasetId: 'ds1', sourceFileName: name });
  dataset.subjectTable = buildSubjectTable(dataset);
  const analytics = computeAnalytics(dataset);
  return { dataset, analytics, validation: validateDataset(dataset, analytics) };
}

test('the gazette is recognised as CBSE Class 10 of the year 2025', () => {
  const { dataset } = analyse();
  assert.equal(dataset.meta.board, 'CBSE');
  assert.equal(dataset.meta.examName, 'ALL INDIA SECONDARY SCHOOL EXAMINATION (MAIN)');
  assert.equal(dataset.meta.year, 2025);
  assert.equal(dataset.meta.class, 'X');
  assert.equal(dataset.meta.session, 'MAIN');
  assert.equal(dataset.meta.region, 'DELHI-WEST');
  assert.equal(dataset.meta.schoolCode, '27572');
  assert.equal(dataset.meta.gazetteDate, '2025-05-13');
  assert.equal(dataset.meta.pageCount, 6);
  assert.equal(dataset.meta.layout, 'grid');
});

test('every candidate of the gazette is read', () => {
  const { dataset } = analyse();
  assert.equal(dataset.candidates.length, PRINTED.totalCandidates);
});

test('the printed summary of the gazette is read as printed', () => {
  const { dataset } = analyse();
  assert.deepEqual(dataset.printedSummary, PRINTED);
});

test('the recalculated totals reproduce the printed summary', () => {
  const { analytics } = analyse();
  assert.equal(analytics.totals.candidates, PRINTED.totalCandidates);
  assert.equal(analytics.totals.passed, PRINTED.totalPass);
  assert.equal(analytics.totals.compartment, PRINTED.compartment);
  assert.equal(analytics.totals.essentialRepeat, PRINTED.essentialRepeat);
  assert.equal(analytics.totals.absent, PRINTED.absent);
  assert.equal(analytics.totals.other, 0);
});

test('the pass percentage is stated with its denominator', () => {
  const { analytics } = analyse();
  assert.equal(analytics.totals.appeared, 136);
  assert.equal(analytics.totals.passPercentage, 97.79);
  assert.equal(analytics.totals.passPercentageOfAll, 97.08);
  assert.ok(analytics.definitions.appeared.includes('absent'));
  assert.ok(analytics.definitions.passPercentage.includes('appeared candidates'));
});

test('the validation reports that the gazette agrees with itself', () => {
  const { validation } = analyse();
  const summary = validation.checks.filter(entry => entry.id.startsWith('summary-'));
  assert.equal(summary.length, 5);
  assert.ok(summary.every(entry => entry.status === 'pass'));
});

test('the three compartment candidates are found with their subject', () => {
  const { dataset, analytics } = analyse();
  const compartment = dataset.candidates.filter(candidate => candidate.status === 'COMPARTMENT');
  assert.equal(compartment.length, 3);
  assert.ok(compartment.every(candidate => candidate.compartmentSubjects.length === 1));
  assert.deepEqual(analytics.compartmentSubjects, [{ code: '086', count: 3 }]);
});

test('the absent candidate is found and carries no marks', () => {
  const { dataset } = analyse();
  const absent = dataset.candidates.filter(candidate => candidate.status === 'ABSENT');
  assert.equal(absent.length, 1);
  assert.ok(absent[0].subjects.every(subject => subject.marks.value === null));
});

test('the seven subject slots are read for every candidate', () => {
  const { dataset } = analyse();
  assert.ok(dataset.candidates.every(candidate => candidate.subjects.length === 7));
});

test('two candidates were not offered one of the optional subjects', () => {
  const { dataset } = analyse();
  const short = dataset.candidates.filter(candidate => candidate.subjects.filter(subject => subject.code).length === 6);
  assert.equal(short.length, 2);
  for (const candidate of short) {
    assert.ok(candidate.subjects.some(subject => !subject.code), 'the empty slot is kept in place');
  }
});

test('the unusual subject orders of the gazette are preserved', () => {
  const { dataset } = analyse();
  const orders = new Set(dataset.candidates.map(candidate => candidate.subjects.map(subject => subject.code).join('|')));
  assert.ok(orders.size > 1, 'the gazette uses more than one subject order');
});

test('every roll number of the gazette is unique', () => {
  const { dataset } = analyse();
  const rolls = new Set(dataset.candidates.map(candidate => candidate.rollNo));
  assert.equal(rolls.size, dataset.candidates.length);
});

test('the subject table of the gazette lists the codes that were printed', () => {
  const { dataset } = analyse();
  const codes = dataset.subjectTable.map(subject => subject.code).sort();
  assert.deepEqual(codes, ['002', '004', '041', '086', '087', '119', '122', '184', '241', '303', '414', '418']);
});

test('the maximum of every subject is the scale the gazette itself prints', () => {
  const { dataset } = analyse();
  for (const subject of dataset.subjectTable) {
    const marks = dataset.candidates.flatMap(candidate =>
      candidate.subjects.filter(item => item.code === subject.code && item.marks.value !== null).map(item => item.marks.value));
    assert.ok(marks.length, `${subject.code} has marks`);
    const highest = Math.max(...marks);
    assert.ok(subject.max >= highest, `${subject.code} fits inside its maximum`);
    assert.ok(subject.max <= 100, `${subject.code} uses a known CBSE scale`);
  }
});

test('a subject printed on its published scale is not flagged', () => {
  const { dataset } = analyse();
  const flagged = dataset.subjectTable.filter(subject => subject.flags.includes('scale-inferred') || subject.flags.includes('exceeds-published-max'));
  assert.deepEqual(flagged.map(subject => subject.code), [], 'no subject needed an inferred scale');
});

test('every subject code of the gazette is named from the CBSE knowledge base', () => {
  const { dataset } = analyse();
  const names = Object.fromEntries(dataset.subjectTable.map(subject => [subject.code, subject.name]));
  assert.deepEqual(names, {
    '002': 'Hindi Course-A',
    '004': 'Punjabi',
    '041': 'Mathematics (Standard)',
    '086': 'Science',
    '087': 'Social Science',
    '119': 'Sanskrit (Communicative)',
    '122': 'Sanskrit',
    '184': 'English (Language and Literature)',
    '241': 'Mathematics (Basic)',
    '303': 'Urdu Course-B',
    '414': 'Apparel',
    '418': 'Physical Activity Trainer'
  });
});

test('no subject of the gazette needs a guessed name or an inferred scale', () => {
  const { dataset } = analyse();
  const flagged = dataset.subjectTable.filter(subject => subject.flags.length);
  assert.deepEqual(flagged.map(subject => subject.code), []);
  assert.ok(dataset.subjectTable.every(subject => subject.max === 100));
});

test('the same gazette read without the column alignment gives the same totals', () => {
  const dataset = parseGazette(readFixture('gazette-27572-2025-ocr.txt'), {
    datasetId: 'ds2',
    sourceFileName: 'gazette-27572-2025-ocr.txt'
  });
  dataset.subjectTable = buildSubjectTable(dataset);
  const analytics = computeAnalytics(dataset);
  assert.equal(analytics.totals.candidates, PRINTED.totalCandidates);
  assert.equal(analytics.totals.passed, PRINTED.totalPass);
  assert.equal(analytics.totals.compartment, PRINTED.compartment);
  assert.equal(analytics.totals.absent, PRINTED.absent);
  assert.equal(dataset.meta.layout, 'loose');
});

test('the token based read keeps the marks of the first candidate', () => {
  const dataset = parseGazette(readFixture('gazette-27572-2025-ocr.txt'), { datasetId: 'ds2' });
  const first = dataset.candidates[0];
  assert.equal(first.name, 'STUDENT 001');
  assert.deepEqual(first.subjects.map(subject => subject.marks.value), [88, 59, 75, 68, 76, 84, 68]);
  assert.deepEqual(first.subjects.map(subject => subject.grade.value), ['A2', 'C2', 'B1', 'B2', 'B2', 'B2', 'B1']);
});

test('the token based read is reported as less certain than the aligned read', () => {
  const aligned = parseGazette(readFixture('gazette-27572-2025.txt'), { datasetId: 'ds1' });
  const loose = parseGazette(readFixture('gazette-27572-2025-ocr.txt'), { datasetId: 'ds2' });
  const alignedMean = aligned.candidates.reduce((sum, candidate) => sum + candidate.confidence, 0) / aligned.candidates.length;
  const looseMean = loose.candidates.reduce((sum, candidate) => sum + candidate.confidence, 0) / loose.candidates.length;
  assert.ok(looseMean < alignedMean, 'the loose read is less confident');
});

test('the token based read finds the same subject codes as the aligned read', () => {
  const dataset = parseGazette(readFixture('gazette-27572-2025-ocr.txt'), { datasetId: 'ds2' });
  dataset.subjectTable = buildSubjectTable(dataset);
  const codes = dataset.subjectTable.map(subject => subject.code).sort();
  assert.deepEqual(codes, ['002', '004', '041', '086', '087', '119', '122', '184', '241', '303', '414', '418']);
});

test('a candidate name that ends in a number does not shift the subject codes', () => {
  const dataset = parseGazette(readFixture('gazette-27572-2025-ocr.txt'), { datasetId: 'ds2' });
  const record = dataset.candidates.find(candidate => candidate.rollNo === '92000033');
  assert.equal(record.name, 'STUDENT 033');
  assert.deepEqual(
    record.subjects.filter(subject => subject.code).map(subject => subject.code),
    ['184', '002', '041', '086', '087', '119']
  );
  assert.deepEqual(
    record.subjects.filter(subject => subject.code).map(subject => subject.marks.value),
    [60, 54, 48, 29, 37, 59]
  );
});
