import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGazette,
  splitLines,
  findStatus,
  detectGridFromHeader,
  detectGridFromData,
  extractMeta,
  applySubjectOverrides
} from '../src/lib/cbse/parse-gazette.js';

import { readFixture, makeGazette, GRID } from './helpers/gazette-fixtures.js';

test('splitLines keeps a blank marks line distinguishable from a separator', () => {
  const { lines } = splitLines('a\n   \nb\n');
  assert.equal(lines.length, 4);
  assert.equal(lines[1].length, 3, 'the blank marks line keeps its width');
  assert.equal(lines[2], 'b');
  assert.equal(lines[3], '', 'a trailing separator line is empty');
});

test('findStatus maps the printed CBSE status tokens', () => {
  assert.equal(findStatus('PASS').status, 'PASS');
  assert.equal(findStatus('COMP').status, 'COMPARTMENT');
  assert.equal(findStatus('ERL').status, 'ESSENTIAL_REPEAT');
  assert.equal(findStatus('ABST').status, 'ABSENT');
  assert.equal(findStatus('PENDING'), null);
  assert.equal(findStatus('PASSED').status, 'PASS');
});

test('findStatus does not match a status inside a longer word', () => {
  assert.equal(findStatus('PASSEDX'), null);
  assert.equal(findStatus('COMPANY'), null);
  assert.equal(findStatus('ABSTENTEE'), null);
});

test('extractMeta reads the board, examination, region and school', () => {
  const text = [
    'DATE:- 13-05-2025    C.B.S.E. - ALL INDIA SECONDARY SCHOOL EXAMINATION (MAIN)-2025      REGION: DELHI-WEST         PAGE:-       1',
    'SCHOOL : - 27572   GOVT GIRLS S S S NO 2 UTTAM NAGAR ND',
    'TOTAL CANDIDATES :   137 TOTAL PASS :   133 TOTAL COMPTT. :     3 TOTAL ESSENTIAL REPEAT :     0 TOTAL ABSENT :     1'
  ].join('\n');
  const { meta, printedSummary } = extractMeta(text.split('\n'));
  assert.equal(meta.board, 'CBSE');
  assert.equal(meta.examName, 'ALL INDIA SECONDARY SCHOOL EXAMINATION (MAIN)');
  assert.equal(meta.year, 2025);
  assert.equal(meta.class, 'X');
  assert.equal(meta.session, 'MAIN');
  assert.equal(meta.region, 'DELHI-WEST');
  assert.equal(meta.schoolCode, '27572');
  assert.equal(meta.schoolName, 'GOVT GIRLS S S S NO 2 UTTAM NAGAR ND');
  assert.equal(meta.gazetteDate, '2025-05-13');
  assert.equal(meta.pageCount, 1);
  assert.deepEqual(printedSummary, {
    totalCandidates: 137,
    totalPass: 133,
    compartment: 3,
    essentialRepeat: 0,
    absent: 1
  });
});

test('extractMeta does not read the gazette title as a school line', () => {
  const { meta } = extractMeta(['***** (SCHOOL / ROLL NO WISE GAZETTE) *****']);
  assert.equal(meta.schoolCode, '');
  assert.equal(meta.schoolName, '');
});

test('the fixed width grid is detected from the printed column header', () => {
  const lines = [
    'ROLL    F S NAME OF CANDIDATE       -----------------SUBJECTS-----------------------  RESULT            COMP',
    '                    MKS GR MKS GR MKS GR MKS GR MKS GR MKS GR MKS GR'
  ];
  const grid = detectGridFromHeader(lines);
  assert.deepEqual(grid, { start: 20, pitch: 7, count: 7, source: 'header' });
});

test('the grid falls back to the data when the header is missing', () => {
  const lines = [
    '92000001   F STUDENT 001        002    184    041    086    087    418    122     PASS',
    '92000002   F STUDENT 002        002    184    041    086    087    418    122     PASS'
  ];
  const grid = detectGridFromData(lines);
  assert.equal(grid.start, 32);
  assert.equal(grid.pitch, 7);
  assert.equal(grid.count, 7);
});

test('a candidate keeps a blank subject slot instead of shifting the columns', () => {
  const text = makeGazette([
    {
      roll: '92000001',
      name: 'STUDENT 001',
      codes: ['002', '184', '041', '086', '087', '', '122'],
      marks: ['088 A2', '059 C2', '075 B1', '068 B2', '076 B2', '', '068 B1']
    }
  ]);
  const dataset = parseGazette(text, { datasetId: 't' });
  assert.equal(dataset.candidates.length, 1);
  const candidate = dataset.candidates[0];
  assert.equal(candidate.subjects.length, 7);
  assert.equal(candidate.subjects[5].code, '', 'the sixth slot is empty');
  assert.equal(candidate.subjects[6].code, '122', 'the seventh slot keeps its own code');
  assert.equal(candidate.subjects[6].marks.value, 68);
});

test('the marks and the grade of one subject stay together', () => {
  const text = makeGazette([
    {
      roll: '92000001',
      name: 'STUDENT 001',
      codes: ['002', '184', '041', '086', '087', '418', '122'],
      marks: ['088 A2', '059 C2', '075 B1', '068 B2', '076 B2', '084 B2', '068 B1']
    }
  ]);
  const dataset = parseGazette(text, { datasetId: 't' });
  const [first] = dataset.candidates;
  assert.deepEqual(first.subjects.map(subject => subject.marks.value), [88, 59, 75, 68, 76, 84, 68]);
  assert.deepEqual(first.subjects.map(subject => subject.grade.value), ['A2', 'C2', 'B1', 'B2', 'B2', 'B2', 'B1']);
});

test('an absent candidate is read without marks and keeps the printed status', () => {
  const text = makeGazette([
    {
      roll: '92000001',
      name: 'STUDENT 001',
      codes: ['002', '184', '041', '086', '087', '418', '122'],
      status: 'ABST'
    }
  ]);
  const dataset = parseGazette(text, { datasetId: 't' });
  const [candidate] = dataset.candidates;
  assert.equal(candidate.status, 'ABSENT');
  assert.equal(candidate.statusPrinted, true);
  assert.equal(candidate.statusRaw, 'ABST');
  assert.ok(candidate.subjects.every(subject => subject.marks.value === null));
});

test('a compartment record keeps the printed compartment subject', () => {
  const text = makeGazette([
    {
      roll: '92000001',
      name: 'STUDENT 001',
      codes: ['002', '184', '041', '086', '087', '418', '122'],
      marks: ['088 A2', '059 C2', '075 B1', '029 E', '076 B2', '084 B2', '068 B1'],
      status: 'COMP',
      comp: '086'
    }
  ]);
  const dataset = parseGazette(text, { datasetId: 't' });
  const [candidate] = dataset.candidates;
  assert.equal(candidate.status, 'COMPARTMENT');
  assert.deepEqual(candidate.compartmentSubjects, ['086']);
});

test('a record id is stable and is not built from the candidate name', () => {
  const dataset = parseGazette(readFixture('gazette-27572-2025.txt'), { datasetId: 'ds1' });
  const first = dataset.candidates[0];
  assert.equal(first.recordId, 'ds1:cand-0001');
  assert.ok(!first.recordId.includes('STUDENT'));
  const ids = new Set(dataset.candidates.map(candidate => candidate.recordId));
  assert.equal(ids.size, dataset.candidates.length);
});

test('the original values are kept next to the normalised values', () => {
  const dataset = parseGazette(readFixture('gazette-27572-2025.txt'), { datasetId: 'ds1' });
  const candidate = dataset.candidates[0];
  assert.equal(candidate.rollNo, candidate.rollNoRaw);
  assert.equal(candidate.name, 'STUDENT 001');
  assert.equal(candidate.nameRaw, 'F STUDENT 001');
  assert.equal(candidate.gender, 'F');
});

test('a name that starts with a single letter is not read as a gender flag', () => {
  const text = makeGazette([
    {
      roll: '92000001',
      gender: '',
      name: 'A BASEEMA',
      codes: ['002', '184', '041', '086', '087', '418', '122'],
      marks: ['088 A2', '059 C2', '075 B1', '068 B2', '076 B2', '084 B2', '068 B1']
    }
  ]);
  const dataset = parseGazette(text, { datasetId: 't' });
  const [candidate] = dataset.candidates;
  assert.equal(candidate.gender, '');
  assert.equal(candidate.name, 'A BASEEMA');
});

test('a record with no readable status is flagged instead of being given a result', () => {
  const text = [
    ' '.repeat(GRID) + 'MKS GR '.repeat(7),
    '92000001   F STUDENT 001'.padEnd(GRID, ' ') + ['002', '184', '041', '086', '087', '418', '122'].map(code => code.padStart(3, ' ')).join('    '),
    ' '.repeat(GRID) + ['088 A2', '059 C2', '075 B1', '068 B2', '076 B2', '084 B2', '068 B1'].map(cell => cell.padStart(3, ' ')).join('    ')
  ].join('\n');
  const dataset = parseGazette(text, { datasetId: 't' });
  const [candidate] = dataset.candidates;
  assert.equal(candidate.status, 'OTHER');
  assert.equal(candidate.statusPrinted, false);
  assert.ok(candidate.warnings.includes('result-status-unread'));
});

test('the token based parser reads a gazette whose columns were lost', () => {
  const text = [
    '92000001 F STUDENT 001 002 184 041 086 087 418 122 PASS',
    '088 A2 059 C2 075 B1 068 B2 076 B2 084 B2 068 B1',
    '92000002 F STUDENT 002 002 184 041 086 087 418 122 COMP 086',
    '070 C1 064 C2 053 C1 053 C1 060 C2 068 D1 055 D1'
  ].join('\n');
  const dataset = parseGazette(text, { datasetId: 't', layout: 'loose' });
  assert.equal(dataset.meta.layout, 'loose');
  assert.equal(dataset.candidates.length, 2);
  assert.equal(dataset.candidates[0].status, 'PASS');
  assert.equal(dataset.candidates[1].status, 'COMPARTMENT');
  assert.deepEqual(dataset.candidates[1].compartmentSubjects, ['086']);
  assert.equal(dataset.candidates[0].subjects[0].marks.value, 88);
  assert.equal(dataset.candidates[0].subjects[0].grade.value, 'A2');
});

test('the token based parser keeps a name that contains a number', () => {
  const text = [
    '92000001 F STUDENT 001 002 184 041 086 087 418 122 PASS',
    '088 A2 059 C2 075 B1 068 B2 076 B2 084 B2 068 B1'
  ].join('\n');
  const dataset = parseGazette(text, { datasetId: 't', layout: 'loose' });
  const [candidate] = dataset.candidates;
  assert.equal(candidate.name, 'STUDENT 001');
  assert.deepEqual(candidate.subjects.map(subject => subject.code), ['002', '184', '041', '086', '087', '418', '122']);
});

test('a subject map can be corrected by the reviewer', () => {
  const dataset = parseGazette(readFixture('gazette-27572-2025.txt'), { datasetId: 'ds1' });
  const updated = applySubjectOverrides(dataset, { '184': { name: 'English', max: 100 } });
  const entry = updated.subjects.find(subject => subject.code === '184');
  assert.equal(entry.resolved.name, 'English');
  assert.equal(entry.resolved.nameSource, 'user');
  assert.equal(entry.resolved.max, 100);
});

test('a file with no records is reported instead of being read as an empty result', () => {
  const dataset = parseGazette('nothing useful here\njust some text\n', { datasetId: 't' });
  assert.equal(dataset.candidates.length, 0);
  assert.ok(dataset.issues.some(issue => issue.code === 'no-records' && issue.severity === 'error'));
});
