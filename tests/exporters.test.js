import test from 'node:test';
import assert from 'node:assert/strict';

import { parseGazette } from '../src/lib/cbse/parse-gazette.js';
import { buildSubjectTable, computeAnalytics } from '../src/lib/cbse/analytics.js';
import { validateDataset } from '../src/lib/cbse/validate.js';
import {
  csvCell,
  buildCsv,
  anonymise,
  buildExportModel,
  buildCsvBundle,
  buildWorkbookSheets
} from '../src/lib/cbse/exporters.js';
import { readFixture } from './helpers/gazette-fixtures.js';

function model(includeIdentities = false) {
  const dataset = parseGazette(readFixture('gazette-27572-2025.txt'), { datasetId: 'ds1', sourceFileName: 'gazette-27572-2025.txt' });
  dataset.subjectTable = buildSubjectTable(dataset);
  const analytics = computeAnalytics(dataset);
  const validation = validateDataset(dataset, analytics);
  return {
    dataset,
    analytics,
    validation,
    model: buildExportModel(analytics, dataset, validation.checks, { includeIdentities })
  };
}

test('a value with a comma or a quote is escaped in a CSV cell', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"');
  assert.equal(csvCell(null), '');
});

test('a CSV document has a header and one line per row', () => {
  const csv = buildCsv(['a', 'b'], [[1, 2], [3, 4]]);
  assert.equal(csv, 'a,b\r\n1,2\r\n3,4\r\n');
});

test('an anonymised record hides the name and masks the roll number', () => {
  const anonymised = anonymise({ rollNo: '92000001', name: 'STUDENT 001' }, 4);
  assert.equal(anonymised.name, 'Withheld');
  assert.ok(!anonymised.roll.includes('00001'));
  assert.equal(anonymised.id, 'Candidate 005');
});

test('the export model carries the source file, the import date and the definitions', () => {
  const { model: exported } = model();
  const summary = Object.fromEntries(exported.summaryRows);
  assert.equal(summary['Source file'], 'gazette-27572-2025.txt');
  assert.ok(summary['Imported at']);
  assert.equal(summary['Total candidates'], 137);
  assert.equal(summary['Pass percentage (of appeared)'], '97.79%');
  assert.equal(summary['Pass percentage (of all candidates)'], '97.08%');
});

test('the subject rows carry the maximum in force and the main figures', () => {
  const { model: exported } = model();
  const row = exported.subjectRows.find(entry => entry[0] === '086');
  assert.equal(row[1], 'Science');
  assert.equal(row[2], 100);
  assert.equal(row[3], 137, 'the number of candidates the code appears for');
  assert.equal(row[4], 136, 'the number of valid marks');
});

test('the candidate rows keep the identity out until it is unlocked', () => {
  const locked = model(false).model;
  const lockedRow = locked.candidateRows[0];
  assert.equal(lockedRow[0], 'Withheld');
  assert.equal(lockedRow[1], 'Withheld');
  assert.equal(lockedRow[2], 'PASS');

  const unlocked = model(true).model;
  const unlockedRow = unlocked.candidateRows[0];
  assert.equal(unlockedRow[0], '92000001');
  assert.equal(unlockedRow[1], 'STUDENT 001');
  assert.equal(unlockedRow[2], 'PASS');
});

test('the CSV bundle holds the main tables only', () => {
  const bundle = buildCsvBundle(model().model);
  assert.deepEqual(Object.keys(bundle).sort(), [
    'candidates.csv',
    'printed-summary.csv',
    'score-bands.csv',
    'subjects.csv',
    'summary.csv',
    'top-candidates.csv'
  ]);
  assert.ok(bundle['summary.csv'].includes('Source file'));
  assert.ok(bundle['candidates.csv'].includes('Withheld'));
  assert.ok(bundle['score-bands.csv'].includes('Subject marks in the band'));
});

test('the workbook has one sheet per table', () => {
  const sheets = buildWorkbookSheets(model().model);
  assert.deepEqual(sheets.map(sheet => sheet.name), [
    'Summary',
    'Subjects',
    'Candidates',
    'Top candidates',
    'Score bands',
    'Printed summary'
  ]);
  assert.ok(sheets[0].rows.length > 10);
});

test('every subject code of the gazette gets its own column', () => {
  const { model: exported, analytics } = model();
  assert.ok(analytics.subjectCodes.length >= 10, 'the gazette has many subject codes');
  assert.equal(exported.subjectHeaders.length, analytics.subjectCodes.length);
  assert.equal(exported.candidateRows[0].length, 6 + analytics.subjectCodes.length);
  assert.equal(exported.topRows[0].length, 7 + analytics.subjectCodes.length);
});

test('a candidate who was not offered a subject gets a dash in that column', () => {
  const { model: exported, analytics } = model();
  const codes = analytics.subjectCodes;
  const first = exported.candidateRows[0];
  const code002 = codes.indexOf('002');
  const code119 = codes.indexOf('119');
  assert.equal(first[6 + code002], '88 A2', 'the mark is on the left and the grade on the right');
  assert.equal(first[6 + code119], '-', 'the subject the candidate did not take is a dash');
});

test('the absent candidate has a dash in every subject column', () => {
  const { model: exported, analytics } = model();
  const absent = exported.candidateRows.find(row => row[2] === 'ABSENT');
  assert.ok(absent, 'the gazette has an absent candidate');
  const cells = absent.slice(6, 6 + analytics.subjectCodes.length);
  assert.ok(cells.every(cell => cell === '-'));
});
