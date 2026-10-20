import test from 'node:test';
import assert from 'node:assert/strict';

import {
  median,
  standardDeviation,
  round,
  resolveEffectiveMax,
  buildSubjectTable,
  computeAnalytics,
  applyFilters,
  aggregateScore,
  countBands,
  compareWithPrintedSummary,
  gradeAgrees,
  DEFAULT_BANDS
} from '../src/lib/cbse/analytics.js';
import { parseGazette } from '../src/lib/cbse/parse-gazette.js';
import { readFixture } from './helpers/gazette-fixtures.js';

function datasetFor(name = 'gazette-27572-2025.txt') {
  const dataset = parseGazette(readFixture(name), { datasetId: 'ds1' });
  dataset.subjectTable = buildSubjectTable(dataset);
  return dataset;
}

test('median handles an even and an odd count', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
});

test('the standard deviation is the sample standard deviation', () => {
  assert.equal(round(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9]), 4), 2.1381);
  assert.equal(standardDeviation([5]), null);
});

test('a verified maximum is used as published', () => {
  const result = resolveEffectiveMax({ max: 100, maxSource: 'verified', verified: true, code: '086' }, 94);
  assert.equal(result.max, 100);
  assert.equal(result.source, 'verified');
  assert.deepEqual(result.flags, []);
});

test('a gazette that prints a subject out of 100 is not flagged', () => {
  const result = resolveEffectiveMax({ max: 100, maxSource: 'verified', verified: true, code: '086', publishedScales: [100] }, 98);
  assert.equal(result.max, 100);
  assert.equal(result.source, 'verified');
  assert.deepEqual(result.flags, [], 'a subject printed on its published scale is not a problem');
});

test('a skill subject printed on either published scale is not flagged', () => {
  const result = resolveEffectiveMax({ max: 50, maxSource: 'verified', verified: true, code: '418', publishedScales: [50, 100] }, 95);
  assert.equal(result.max, 100);
  assert.equal(result.source, 'verified');
  assert.deepEqual(result.flags, []);
});

test('a scale that exceeds every published scale is inferred and flagged', () => {
  const result = resolveEffectiveMax({ max: 100, maxSource: 'verified', verified: true, code: '086', publishedScales: [100] }, 130);
  assert.equal(result.max, null);
  assert.equal(result.source, 'unknown');
  assert.ok(result.flags.includes('scale-inferred'));
  assert.ok(result.flags.includes('exceeds-published-max'));
  assert.ok(result.flags.includes('scale-unknown'));
});

test('an unmapped subject code is flagged and measured on the scale of the file', () => {
  const result = resolveEffectiveMax({ max: null, maxSource: 'unknown', verified: false, code: '999', publishedScales: [] }, 93);
  assert.equal(result.max, 100);
  assert.equal(result.source, 'inferred');
  assert.deepEqual(result.flags, ['unmapped-code'], 'there is no published scale to compare against');
});

test('the pass percentage uses the appeared candidates as the denominator', () => {
  const dataset = datasetFor();
  const analytics = computeAnalytics(dataset);
  assert.equal(analytics.totals.candidates, 137);
  assert.equal(analytics.totals.appeared, 136);
  assert.equal(analytics.totals.passPercentage, 97.79);
  assert.equal(analytics.totals.passPercentageOfAll, 97.08);
});

test('the appeared count removes only the absent candidates', () => {
  const dataset = datasetFor();
  const analytics = computeAnalytics(dataset);
  const { candidates, passed, compartment, essentialRepeat, absent, other, appeared } = analytics.totals;
  assert.equal(appeared, candidates - absent);
  assert.equal(passed + compartment + essentialRepeat + other + absent, candidates);
});

test('a filter on the result status only keeps that status', () => {
  const dataset = datasetFor();
  const filtered = applyFilters(dataset, { status: 'COMPARTMENT' });
  assert.equal(filtered.length, 3);
  assert.ok(filtered.every(candidate => candidate.status === 'COMPARTMENT'));
});

test('a filter on a subject keeps only the candidates that took it', () => {
  const dataset = datasetFor();
  const filtered = applyFilters(dataset, { subject: '241' });
  assert.equal(filtered.length, 104);
});

test('a filter on the year keeps the candidates of that year', () => {
  const dataset = datasetFor();
  assert.equal(applyFilters(dataset, { year: '2025' }).length, 137);
  assert.equal(applyFilters(dataset, { year: '2024' }).length, 0);
});

test('a score band filter uses the percentage of the marks available', () => {
  const dataset = datasetFor();
  const analytics = computeAnalytics(dataset);
  const scores = analytics.scores.map(entry => entry.percent);
  const low = scores.filter(value => value < 50).length;
  const filtered = applyFilters(dataset, { scoreMin: 50 });
  assert.equal(filtered.length, scores.length - low);
});

test('the aggregate score of a candidate uses the maximum of the subjects they were offered', () => {
  const dataset = datasetFor();
  const candidate = dataset.candidates.find(item => item.rollNo === '92000001');
  const score = aggregateScore(candidate, dataset.subjectTable);
  assert.equal(score.subjects, 7);
  assert.ok(score.percent > 0 && score.percent <= 100);
});

test('an absent candidate has no aggregate score', () => {
  const dataset = datasetFor();
  const candidate = dataset.candidates.find(item => item.status === 'ABSENT');
  const score = aggregateScore(candidate, dataset.subjectTable);
  assert.equal(score.percent, null);
});

test('score bands count every value exactly once', () => {
  const bands = DEFAULT_BANDS;
  const counted = countBands([0, 10, 55, 99.9, 100], 100, bands);
  assert.equal(counted.reduce((sum, band) => sum + band.count, 0), 5);
});

test('the subject table keeps the missing and unreadable marks apart from the valid ones', () => {
  const dataset = datasetFor();
  const entry = dataset.subjectTable.find(subject => subject.code === '002');
  assert.equal(entry.occurrences, 137);
  assert.equal(entry.valid + entry.missing + entry.invalid + entry.absent, 137);
});

test('the grade distribution counts every printed grade', () => {
  const dataset = datasetFor();
  const analytics = computeAnalytics(dataset);
  const total = analytics.gradeDistribution.reduce((sum, entry) => sum + entry.count, 0);
  const printed = dataset.candidates.reduce((sum, candidate) =>
    sum + candidate.subjects.filter(subject => subject.marks.value !== null && subject.grade.value).length, 0);
  assert.equal(total, printed);
});

test('the printed summary is compared with the recalculated figures', () => {
  const dataset = datasetFor();
  const analytics = computeAnalytics(dataset);
  const rows = compareWithPrintedSummary(dataset, analytics);
  assert.equal(rows.length, 5);
  assert.ok(rows.every(row => row.match === true));
});

test('a printed grade is only compared with the CBSE boundaries for the maximum in force', () => {
  assert.equal(gradeAgrees(95, 'A1', 100), true);
  assert.equal(gradeAgrees(95, 'A2', 100), false);
  assert.equal(gradeAgrees(78, 'A1', 80), true);
  assert.equal(gradeAgrees(78, 'A2', 80), false);
  assert.equal(gradeAgrees(50, 'A1', null), null);
  assert.equal(gradeAgrees(50, null, 100), null);
});

test('every printed subject mark is counted in the subject level score bands', () => {
  const dataset = datasetFor();
  const analytics = computeAnalytics(dataset);
  const total = analytics.markBandDistribution.reduce((sum, band) => sum + band.count, 0);
  const printed = dataset.candidates.reduce((sum, candidate) =>
    sum + candidate.subjects.filter(subject => subject.marks.value !== null).length, 0);
  assert.equal(total, printed);
  assert.equal(analytics.markBandDistribution.length, analytics.scoreDistribution.length);
});

test('the subject level score bands and the candidate level bands are different views', () => {
  const dataset = datasetFor();
  const analytics = computeAnalytics(dataset);
  const candidateTotal = analytics.scoreDistribution.reduce((sum, band) => sum + band.count, 0);
  const markTotal = analytics.markBandDistribution.reduce((sum, band) => sum + band.count, 0);
  assert.ok(markTotal > candidateTotal);
  assert.notDeepEqual(
    analytics.scoreDistribution.map(band => band.count),
    analytics.markBandDistribution.map(band => band.count)
  );
});

test('the top candidates are ranked by their percentage of the marks available', () => {
  const dataset = datasetFor();
  const analytics = computeAnalytics(dataset);
  assert.equal(analytics.topPerformers.length, 10);
  const percentages = analytics.topPerformers.map(entry => entry.percent);
  assert.deepEqual(percentages, [...percentages].sort((a, b) => b - a));
  assert.ok(analytics.topPerformers[0].percent >= analytics.topPerformers[9].percent);
});

test('the top candidates carry the marks of every subject they were offered', () => {
  const dataset = datasetFor();
  const analytics = computeAnalytics(dataset);
  const entry = analytics.topPerformers[0];
  assert.ok(entry.subjects.length > 0);
  assert.ok(entry.subjects.every(subject => subject.code && subject.name));
  const total = entry.subjects.reduce((sum, subject) => sum + (subject.marks ?? 0), 0);
  assert.equal(total, entry.total);
});

test('candidates with the same percentage share a rank', () => {
  const dataset = datasetFor();
  const analytics = computeAnalytics(dataset);
  const ranks = analytics.topPerformers.map(entry => entry.rank);
  assert.equal(ranks[0], 1);
  for (let index = 1; index < analytics.topPerformers.length; index += 1) {
    const previous = analytics.topPerformers[index - 1];
    const current = analytics.topPerformers[index];
    if (previous.percent === current.percent) assert.equal(current.rank, previous.rank);
    else assert.ok(current.rank > previous.rank);
  }
});

test('the number of top candidates can be changed', () => {
  const dataset = datasetFor();
  const analytics = computeAnalytics(dataset, { topCount: 5 });
  assert.equal(analytics.topPerformers.length, 5);
  const twenty = computeAnalytics(dataset, { topCount: 20 });
  assert.equal(twenty.topPerformers.length, 20);
});

test('an absent candidate is never in the top candidates', () => {
  const dataset = datasetFor();
  const analytics = computeAnalytics(dataset);
  const absent = dataset.candidates.filter(candidate => candidate.status === 'ABSENT').map(candidate => candidate.recordId);
  assert.ok(absent.length > 0);
  assert.ok(analytics.topPerformers.every(entry => !absent.includes(entry.recordId)));
});
