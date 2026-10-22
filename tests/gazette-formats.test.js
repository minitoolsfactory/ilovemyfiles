/**
 * Regression tests for every gazette format the analyzer supports.
 *
 * The fixtures are anonymised copies of real CBSE gazettes:
 *
 * | fixture | examination | layout | what makes it different |
 * | --- | --- | --- | --- |
 * | `gazette-x-2025-marks-grades.txt` | Class X, main, 2025 | columns | marks and grades |
 * | `gazette-x-2026-marks-grades.txt` | Class X, main, 2026 | columns | marks and grades, a subject printed as AB, an essential repeat |
 * | `gazette-x-2026-marks-only.txt` | Class X, main, 2026 | columns | marks without any grade |
 * | `gazette-x-2025-compartment.txt` | Class X, compartment, 2025 | columns | only the compartment subjects, an XXXX result |
 * | `gazette-xii-2026-compartment.txt` | Class XII, compartment, 2026 | vertical | one subject per line, grades only, XXXX results |
 * | `gazette-xii-2025-compartment.txt` | Class XII, compartment, 2025 | vertical | one subject per line |
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseGazette } from '../src/lib/cbse/parse-gazette.js';
import { buildReportSections } from '../src/lib/cbse/exporters.js';
import { buildSubjectTable, computeAnalytics, compareWithPrintedSummary } from '../src/lib/cbse/analytics.js';
import { validateDataset } from '../src/lib/cbse/validate.js';
import { readFixture } from './helpers/gazette-fixtures.js';

function analyse(name) {
  const dataset = parseGazette(readFixture(name), { datasetId: 't', sourceFileName: name });
  dataset.subjectTable = buildSubjectTable(dataset);
  const analytics = computeAnalytics(dataset);
  return { dataset, analytics, validation: validateDataset(dataset, analytics) };
}

const FORMATS = [
  {
    file: 'gazette-x-2025-marks-grades.txt',
    layout: 'grid',
    className: 'X',
    year: 2025,
    session: 'MAIN',
    totals: { totalCandidates: 137, totalPass: 133, compartment: 3, essentialRepeat: 0, absent: 1 },
    statusCounts: { PASS: 133, COMPARTMENT: 3, ABSENT: 1 }
  },
  {
    file: 'gazette-x-2026-marks-grades.txt',
    layout: 'grid',
    className: 'X',
    year: 2026,
    session: 'MAIN',
    totals: { totalCandidates: 209, totalPass: 208, compartment: 0, essentialRepeat: 1, absent: 0 },
    statusCounts: { PASS: 208, ESSENTIAL_REPEAT: 1 }
  },
  {
    file: 'gazette-x-2026-marks-only.txt',
    layout: 'grid',
    className: 'X',
    year: 2026,
    session: 'MAIN',
    totals: { totalCandidates: 209, totalPass: 203, compartment: 5, essentialRepeat: 1, absent: 0 },
    statusCounts: { PASS: 203, COMPARTMENT: 5, ESSENTIAL_REPEAT: 1 }
  },
  {
    file: 'gazette-x-2025-compartment.txt',
    layout: 'grid',
    className: 'X',
    year: 2025,
    session: 'COMPTT',
    totals: { totalCandidates: 4, totalPass: 1, compartment: 2, essentialRepeat: 0, absent: 0, other: 1 },
    statusCounts: { PASS: 1, COMPARTMENT: 2, OTHER: 1 }
  },
  {
    file: 'gazette-xii-2026-compartment.txt',
    layout: 'vertical',
    className: 'XII',
    year: 2026,
    session: 'COMPTT',
    totals: { totalCandidates: 12, totalPass: 6, compartment: 1, essentialRepeat: 0, absent: 0, other: 5 },
    statusCounts: { PASS: 6, COMPARTMENT: 1, OTHER: 5 }
  },
  {
    file: 'gazette-xii-2025-compartment.txt',
    layout: 'vertical',
    className: 'XII',
    year: 2025,
    session: 'COMPTT',
    totals: { totalCandidates: 1, totalPass: 1, compartment: 0, essentialRepeat: 0, absent: 0 },
    statusCounts: { PASS: 1 }
  }
];

for (const format of FORMATS) {
  test(`${format.file} is read as a ${format.className} ${format.year} ${format.session} gazette`, () => {
    const { dataset } = analyse(format.file);
    assert.equal(dataset.meta.layout, format.layout);
    assert.equal(dataset.meta.class, format.className);
    assert.equal(dataset.meta.year, format.year);
    assert.equal(dataset.meta.session, format.session);
    assert.equal(dataset.meta.board, 'CBSE');
    assert.equal(dataset.meta.region, 'DELHI-WEST');
    assert.equal(dataset.meta.schoolCode, '27572');
  });

  test(`${format.file} reproduces the printed summary`, () => {
    const { dataset, analytics } = analyse(format.file);
    for (const [key, value] of Object.entries(format.totals)) {
      assert.equal(dataset.printedSummary[key], value, `printed ${key}`);
    }
    const counts = {};
    for (const candidate of dataset.candidates) {
      counts[candidate.status] = (counts[candidate.status] ?? 0) + 1;
    }
    for (const [status, value] of Object.entries(format.statusCounts)) {
      assert.equal(counts[status] ?? 0, value, `recalculated ${status}`);
    }
    const rows = compareWithPrintedSummary(dataset, analytics);
    assert.ok(rows.every(row => row.match === true), JSON.stringify(rows));
  });

  test(`${format.file} keeps the candidate names clean`, () => {
    const { dataset } = analyse(format.file);
    for (const candidate of dataset.candidates) {
      assert.ok(candidate.name, 'every record has a name');
      assert.ok(!/^[IMF]\s/.test(candidate.name), `the flags are not part of the name: ${candidate.name}`);
      assert.match(candidate.name, /^STUDENT \d{3}$/);
    }
  });
}

test('a gazette that prints marks and grades reads both', () => {
  const { dataset } = analyse('gazette-x-2025-marks-grades.txt');
  const first = dataset.candidates[0];
  assert.equal(first.subjects.length, 7);
  assert.equal(first.subjects[0].code, '002');
  assert.equal(first.subjects[0].marks.value, 88);
  assert.equal(first.subjects[0].grade.value, 'A2');
  assert.equal(first.subjects[0].absent, false);
});

test('a gazette that prints the marks without the grades reads the marks', () => {
  const { dataset } = analyse('gazette-x-2026-marks-only.txt');
  const first = dataset.candidates[0];
  assert.equal(first.subjects.length, 7);
  assert.equal(first.subjects[0].code, '002');
  assert.equal(first.subjects[0].marks.value, 59);
  assert.equal(first.subjects[0].grade.value, null);
});

test('a subject printed as AB is absent for that subject and keeps its grade', () => {
  const { dataset, validation } = analyse('gazette-x-2026-marks-grades.txt');
  const absent = dataset.candidates.flatMap(candidate => candidate.subjects.filter(subject => subject.absent));
  assert.ok(absent.length > 0, 'the gazette prints AB for some subjects');
  const subject = absent[0];
  assert.equal(subject.marks.value, null);
  assert.equal(subject.marks.raw, 'AB');
  assert.equal(subject.grade.value, 'E');
  const check = validation.checks.find(entry => entry.id === 'subjects-not-appeared');
  assert.equal(check.status, 'info');
  assert.ok(check.count > 0);
});

test('a gazette that lists only the compartment subjects keeps the empty slots', () => {
  const { dataset } = analyse('gazette-x-2025-compartment.txt');
  const candidate = dataset.candidates.find(entry => entry.compartmentSubjects.length) ?? dataset.candidates[0];
  assert.equal(candidate.subjects[0].code, '086');
  assert.equal(candidate.subjects[0].marks.value, 29);
  assert.equal(candidate.subjects[0].grade.value, 'E');
  assert.equal(candidate.compartmentSubjects.length, 1);
  assert.ok(candidate.subjects.slice(1).every(subject => !subject.code), 'the other slots stay empty');
});

test('the vertical gazette reads one subject per line', () => {
  const { dataset } = analyse('gazette-xii-2026-compartment.txt');
  const candidate = dataset.candidates[0];
  assert.equal(candidate.subjects.length, 2);
  assert.equal(candidate.subjects[0].code, '041');
  assert.equal(candidate.subjects[1].code, '065');
  assert.equal(candidate.subjects[1].grade.value, 'B2');
  assert.equal(candidate.subjects[0].marks.value, null, 'the vertical gazette prints no marks');
});

test('the XXXX result is reported as other and not as a pass', () => {
  const { dataset, analytics } = analyse('gazette-xii-2026-compartment.txt');
  const withheld = dataset.candidates.filter(candidate => candidate.statusRaw === 'XXXX');
  assert.equal(withheld.length, 5);
  assert.equal(analytics.totals.other, 5);
  assert.equal(analytics.totals.passed, 6);
});

test('the essential repeat status is read from the printed words', () => {
  const { dataset, analytics } = analyse('gazette-x-2026-marks-grades.txt');
  const repeat = dataset.candidates.filter(candidate => candidate.status === 'ESSENTIAL_REPEAT');
  assert.equal(repeat.length, 1);
  assert.equal(repeat[0].statusRaw, 'ESSENTIAL REPEAT');
  assert.equal(analytics.totals.essentialRepeat, 1);
});

test('the report of a grades only gazette shows the grade distribution', () => {
  const { dataset, analytics } = analyse('gazette-xii-2026-compartment.txt');
  const sections = buildReportSections(analytics, dataset, [], {
    candidates: dataset.candidates,
    subjectCodes: analytics.subjectCodes,
    subjectTable: analytics.subjects,
    hasMarks: analytics.subjects.some(subject => subject.valid > 0)
  });
  const subjectSection = sections.find(section => section.title.startsWith('Subject-wise'));
  assert.equal(subjectSection.title, 'Subject-wise grade distribution');
  assert.ok(subjectSection.columns.includes('Grades printed'));
  const mathematics = subjectSection.rows.find(row => row[0] === '041');
  assert.equal(mathematics[1], 'Mathematics');
  assert.match(mathematics[4], /RTE/);
});

test('the report carries the candidate records with their names', () => {
  const { dataset, analytics } = analyse('gazette-xii-2026-compartment.txt');
  const sections = buildReportSections(analytics, dataset, [], {
    candidates: dataset.candidates,
    subjectCodes: analytics.subjectCodes,
    subjectTable: analytics.subjects,
    hasMarks: analytics.subjects.some(subject => subject.valid > 0)
  });
  const records = sections.find(section => section.title === 'Candidate records');
  assert.ok(records, 'the report has a candidate records section');
  assert.deepEqual(records.columns.slice(0, 4), ['Roll number', 'Name', 'Gender', 'Result']);
  assert.equal(records.rows.length, dataset.candidates.length);
  assert.equal(records.rows[0][1], 'STUDENT 001');
  assert.ok(!records.columns.includes('Total'), 'a gazette without marks has no total column');
});

test('the report of a gazette with marks keeps the total and the percentage', () => {
  const { dataset, analytics } = analyse('gazette-x-2025-marks-grades.txt');
  const sections = buildReportSections(analytics, dataset, [], {
    candidates: dataset.candidates,
    subjectCodes: analytics.subjectCodes,
    subjectTable: analytics.subjects,
    hasMarks: analytics.subjects.some(subject => subject.valid > 0)
  });
  const records = sections.find(section => section.title === 'Candidate records');
  assert.ok(records.columns.includes('Total'));
  assert.ok(records.columns.includes('Percentage'));
  const subjectSection = sections.find(section => section.title.startsWith('Subject-wise'));
  assert.equal(subjectSection.title, 'Subject-wise performance');
});

test('the class is split by the gender printed in the gazette', () => {
  const { analytics } = analyse('gazette-x-2026-marks-grades.txt');
  assert.equal(analytics.genderBreakdown.length, 1);
  const girls = analytics.genderBreakdown[0];
  assert.equal(girls.key, 'F');
  assert.equal(girls.label, 'Girls');
  assert.equal(girls.candidates, 209);
  assert.equal(girls.passed, 208);
  assert.equal(girls.appeared, 209);
  assert.equal(girls.passPercentage, 99.52);
});

test('the gender is reported when the gazette prints none', () => {
  const { dataset, validation } = analyse('gazette-x-2026-marks-grades.txt');
  const check = validation.checks.find(entry => entry.id === 'gender-printed');
  assert.equal(check.status, 'pass');
  assert.equal(check.count, 0);
  assert.ok(dataset.candidates.every(candidate => candidate.gender === 'F'));
});

test('every report table has as many cells in a row as it has headings', () => {
  for (const file of ['gazette-x-2025-marks-grades.txt', 'gazette-xii-2026-compartment.txt', 'gazette-x-2026-marks-only.txt']) {
    const { dataset, analytics } = analyse(file);
    const hasMarks = analytics.subjects.some(subject => subject.valid > 0);
    const sections = buildReportSections(analytics, dataset, [], {
      candidates: dataset.candidates,
      subjectCodes: analytics.subjectCodes,
      subjectTable: analytics.subjects,
      hasMarks
    });
    for (const section of sections) {
      if (section.type !== 'table') continue;
      for (const row of section.rows) {
        assert.equal(row.length, section.columns.length, `${file}: ${section.title} row has ${row.length} cells for ${section.columns.length} headings`);
      }
    }
  }
});

test('the candidate records of the report carry the roll, the name and the gender', () => {
  const { dataset, analytics } = analyse('gazette-x-2026-marks-grades.txt');
  const sections = buildReportSections(analytics, dataset, [], {
    candidates: dataset.candidates,
    subjectCodes: analytics.subjectCodes,
    subjectTable: analytics.subjects,
    hasMarks: true
  });
  const records = sections.find(section => section.title === 'Candidate records');
  const [roll, name, gender, result] = records.rows[0];
  assert.equal(roll, '97000001');
  assert.equal(name, 'STUDENT 001');
  assert.equal(gender, 'F');
  assert.equal(result, 'PASS');
});
