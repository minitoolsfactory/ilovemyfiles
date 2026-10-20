import test from 'node:test';
import assert from 'node:assert/strict';

import { parseGazette } from '../src/lib/cbse/parse-gazette.js';
import { buildSubjectTable, computeAnalytics } from '../src/lib/cbse/analytics.js';
import { validateDataset } from '../src/lib/cbse/validate.js';
import { applyCorrections, countCorrections } from '../src/lib/cbse/corrections.js';
import { readFixture } from './helpers/gazette-fixtures.js';

function datasetFor(name = 'gazette-27572-2025-errors.txt') {
  const dataset = parseGazette(readFixture(name), { datasetId: 'ds1' });
  dataset.subjectTable = buildSubjectTable(dataset);
  return dataset;
}

test('a dataset without corrections is returned unchanged', () => {
  const dataset = datasetFor();
  assert.equal(applyCorrections(dataset, {}), dataset);
});

test('a corrected name is used and the warning is cleared', () => {
  const dataset = datasetFor();
  const target = dataset.candidates.find(candidate => candidate.warnings.includes('name-unread'))
    ?? dataset.candidates[0];
  const corrected = applyCorrections(dataset, { [target.recordId]: { name: 'NEW NAME' } });
  const record = corrected.candidates.find(candidate => candidate.recordId === target.recordId);
  assert.equal(record.name, 'NEW NAME');
  assert.ok(!record.warnings.includes('name-unread'));
  assert.equal(dataset.candidates.find(candidate => candidate.recordId === target.recordId).name, target.name, 'the printed value is untouched');
});

test('a corrected result status is marked as corrected and not as printed', () => {
  const dataset = datasetFor();
  const target = dataset.candidates.find(candidate => candidate.status === 'OTHER');
  assert.ok(target, 'the fixture has a record with an unreadable status');
  const corrected = applyCorrections(dataset, { [target.recordId]: { status: 'PASS' } });
  const record = corrected.candidates.find(candidate => candidate.recordId === target.recordId);
  assert.equal(record.status, 'PASS');
  assert.equal(record.statusSource, 'corrected');
  assert.equal(record.statusPrinted, true);
  assert.equal(record.statusRaw, 'PENDING', 'the printed text is kept');
  assert.equal(record.correctedStatus, 'PASS');
});

test('a printed status is marked as printed', () => {
  const dataset = datasetFor('gazette-27572-2025.txt');
  const record = dataset.candidates.find(candidate => candidate.status === 'PASS');
  assert.equal(record.statusSource, 'printed');
});

test('a corrected record no longer needs a manual review', () => {
  const dataset = datasetFor();
  const target = dataset.candidates.find(candidate => candidate.status === 'OTHER');
  const corrected = applyCorrections(dataset, { [target.recordId]: { status: 'PASS' } });
  corrected.subjectTable = buildSubjectTable(corrected);
  const analytics = computeAnalytics(corrected);
  const validation = validateDataset(corrected, analytics);
  assert.equal(analytics.totals.other, 0);
  assert.equal(analytics.totals.passed, 133);
  const entry = validation.checks.find(check => check.id === 'result-status');
  assert.equal(entry.status, 'pass');
});

test('the corrections are counted', () => {
  assert.equal(countCorrections({}), 0);
  assert.equal(countCorrections({ a: { name: 'x' }, b: { status: 'PASS' } }), 2);
});
