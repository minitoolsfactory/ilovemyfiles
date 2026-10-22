import test from 'node:test';
import assert from 'node:assert/strict';

import { parseGazette } from '../src/lib/cbse/parse-gazette.js';
import { buildSubjectTable, computeAnalytics } from '../src/lib/cbse/analytics.js';
import { validateDataset } from '../src/lib/cbse/validate.js';
import {
  csvCell,
  buildCsv,
  buildExportModel,
  buildCsvBundle,
  buildWorkbookSheets,
  buildReportSections,
  buildPdfReport,
  buildResultSheetPdf
} from '../src/lib/cbse/exporters.js';
import { readFixture } from './helpers/gazette-fixtures.js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

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

test('subject performance labels the valid-mark count as student count', () => {
  const { model: exported, analytics, dataset } = model();
  const sections = buildReportSections(analytics, dataset, [], { subjectCodes: [], candidates: [] });
  const performance = sections.find(section => section.title === 'Subject-wise performance');
  const bundle = buildCsvBundle(exported);

  assert.equal(performance.columns[3], 'Students');
  assert.ok(bundle['subjects.csv'].startsWith('Subject code,Subject name,Maximum used,Records,Students,'));
});

test('the candidate sheet carries the gender', () => {
  const { model: exported } = model();
  assert.equal(exported.candidateRows[0][2], 'F');
});

test('the candidate rows always carry the roll number and the name', () => {
  const row = model().model.candidateRows[0];
  assert.equal(row[0], '92000001');
  assert.equal(row[1], 'STUDENT 001');
  assert.equal(row[2], 'F');
  assert.equal(row[3], 'PASS');
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
  assert.ok(bundle['candidates.csv'].includes('STUDENT 001'), 'the candidate sheet carries the name');
  assert.ok(bundle['candidates.csv'].includes('92000001'), 'the candidate sheet carries the roll number');
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
  assert.equal(exported.candidateRows[0].length, 7 + analytics.subjectCodes.length, 'the identity, the gender, the result, the totals and one column per subject');
  assert.equal(exported.topRows[0].length, 8 + analytics.subjectCodes.length, 'the rank, the identity, the gender, the result, the totals and one column per subject');
});

test('a candidate who was not offered a subject gets a dash in that column', () => {
  const { model: exported, analytics } = model();
  const codes = analytics.subjectCodes;
  const first = exported.candidateRows[0];
  const code002 = codes.indexOf('002');
  const code119 = codes.indexOf('119');
  assert.equal(first[7 + code002], '88 A2', 'the mark is on the left and the grade on the right');
  assert.equal(first[7 + code119], '-', 'the subject the candidate did not take is a dash');
});

test('the absent candidate has a dash in every subject column', () => {
  const { model: exported, analytics } = model();
  const absent = exported.candidateRows.find(row => row[3] === 'ABSENT');
  assert.ok(absent, 'the gazette has an absent candidate');
  const cells = absent.slice(7, 7 + analytics.subjectCodes.length);
  assert.ok(cells.every(cell => cell === '-'));
});

test('a long name is broken over several lines without losing a character', async () => {
  const { wrapTextLines } = await import('../src/lib/cbse/exporters.js');
  const measure = value => value.length * 6;
  for (const name of ['ISHIKA PODDAR', 'UMATI KHATOON', 'PAYAL ADANIA', 'DIMPLE', 'NAZMIA', 'SNEHA', 'KHUSHI', 'KOMAL']) {
    const lines = wrapTextLines(name, measure, 40);
    assert.ok(lines.length >= 1, `${name} is printed`);
    assert.equal(lines.join('').replace(/\s+/g, ''), name.replace(/\s+/g, ''), `${name} keeps every character`);
  }
});

test('a name that fits is printed on one line', async () => {
  const { wrapTextLines } = await import('../src/lib/cbse/exporters.js');
  const measure = value => value.length * 6;
  assert.deepEqual(wrapTextLines('STUDENT 001', measure, 200), ['STUDENT 001']);
});

test('a printed name is written in a readable case', async () => {
  const { titleCaseName } = await import('../src/lib/cbse/exporters.js');
  assert.equal(titleCaseName('ALL INDIA SECONDARY SCHOOL EXAMINATION (MAIN)'), 'All India Secondary School Examination (Main)');
  assert.equal(titleCaseName('CM SHRI SCHOOL UTTAM NAGAR ND'), 'CM Shri School Uttam Nagar ND');
  assert.equal(titleCaseName('SENIOR SCHOOL CERTIFICATE EXAMINATION (COMPTT)'), 'Senior School Certificate Examination (Comptt)');
  assert.equal(titleCaseName('DELHI-WEST'), 'Delhi-West');
  assert.equal(titleCaseName('CBSE'), 'CBSE');
  assert.equal(titleCaseName('ALL INDIA SCHOOL OF SCIENCE'), 'All India School of Science');
  assert.equal(titleCaseName(''), '');
});

test('the result sheet keeps later columns aligned when cells are wider than their defaults', async () => {
  const candidates = [
    {
      rollNo: '10000001',
      name: 'STUDENT ONE',
      gender: 'F',
      status: 'PASS',
      subjects: [{ code: '001', marks: { value: null, raw: '' }, grade: { value: 'COMPARTMENT', raw: '' } }]
    },
    {
      rollNo: '10000002',
      name: 'STUDENT TWO',
      gender: 'M',
      status: 'ESSENTIAL REPEAT',
      subjects: [{ code: '001', marks: { value: 70, raw: '' }, grade: { value: '', raw: '' } }]
    }
  ];
  const blob = await buildResultSheetPdf({}, {}, { candidates, meta: {} }, [], {
    candidates,
    subjectCodes: ['001'],
    subjectTable: [{ code: '001', max: 100 }],
    hasMarks: true
  });
  const pdf = await getDocument({ data: new Uint8Array(await blob.arrayBuffer()), useSystemFonts: true }).promise;
  const page = await pdf.getPage(1);
  const { items } = await page.getTextContent();
  const rowFor = rollNo => {
    const rollItem = items.find(item => item.str.includes(rollNo));
    assert.ok(rollItem);
    return items.filter(item => Math.abs(item.transform[5] - rollItem.transform[5]) < 0.01);
  };
  const first = rowFor('10000001');
  const second = rowFor('10000002');
  const rightEdge = item => item.transform[4] + item.width;
  const firstSubject = first.find(item => item.str.includes('COMPARTMENT'));
  const secondSubject = second.filter(item => item.str.includes('70')).sort((a, b) => a.transform[4] - b.transform[4])[0];
  const firstTotal = first.filter(item => item.str === '-').sort((a, b) => a.transform[4] - b.transform[4])[0];
  const secondTotal = second.filter(item => item.str.includes('70')).sort((a, b) => a.transform[4] - b.transform[4])[1];
  const firstStatus = first.find(item => item.str.includes('PASS'));
  const secondStatus = second.find(item => item.str.includes('REPEAT'));

  assert.ok(firstSubject);
  assert.ok(secondSubject);
  assert.ok(firstTotal);
  assert.ok(secondTotal);
  assert.ok(firstStatus);
  assert.ok(secondStatus);
  assert.ok(second.some(item => item.str.includes('ESSENTIAL')));
  assert.ok(Math.abs(rightEdge(firstSubject) - rightEdge(secondSubject)) < 0.01);
  assert.ok(Math.abs(rightEdge(firstTotal) - rightEdge(secondTotal)) < 0.01);
  assert.ok(Math.abs(rightEdge(firstStatus) - rightEdge(secondStatus)) < 0.01);
});

test('the result sheet uses landscape and keeps a typical subject set on one row', async () => {
  const subjectCodes = ['002', '184', '241', '086', '087', '414', '122', '303', '004', '041'];
  const candidates = [{
    rollNo: '10000001',
    name: 'STUDENT ONE',
    gender: 'F',
    status: 'PASS',
    subjects: subjectCodes.map((code, index) => ({
      code,
      marks: { value: 60 + index, raw: '' },
      grade: { value: 'A1', raw: '' }
    }))
  }];
  const blob = await buildResultSheetPdf({}, {}, { candidates, meta: {} }, [], {
    candidates,
    subjectCodes,
    subjectTable: subjectCodes.map(code => ({ code, max: 100, valid: 1 })),
    hasMarks: true
  });
  const pdf = await getDocument({ data: new Uint8Array(await blob.arrayBuffer()), useSystemFonts: true }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const { items } = await page.getTextContent();
  const roll = items.find(item => item.str.includes('10000001'));

  assert.ok(viewport.width > viewport.height, 'the result sheet is landscape');
  assert.ok(items.some(item => item.str.includes('MyFiles. | CBSE Result Sheet')), 'the branded footer includes the report title');
  assert.ok(items.some(item => item.str === 'Page 1 of 1'), 'the footer retains the page count');
  assert.ok(roll);
  const row = items.filter(item => Math.abs(item.transform[5] - roll.transform[5]) < 0.01);
  for (let index = 0; index < subjectCodes.length; index += 1) {
    assert.ok(row.some(item => item.str.includes(String(index + 60))), `subject ${subjectCodes[index]} is on the candidate row`);
  }
  const firstSubjectHeader = items.find(item => item.str === subjectCodes[0]);
  const firstSubjectValue = row.find(item => item.str.includes('60 A1'));
  assert.ok(firstSubjectHeader);
  assert.ok(firstSubjectValue);
  assert.ok(Math.abs(
    firstSubjectHeader.transform[4] + firstSubjectHeader.width
      - firstSubjectValue.transform[4] - firstSubjectValue.width
  ) < 0.01, 'the subject value is beneath its own header');
  const rightmostCell = Math.max(...row.map(item => item.transform[4] + item.width));
  assert.ok(Math.abs(rightmostCell - (viewport.width - 34)) < 2, 'the table uses the available page width');
  assert.ok(row.some(item => item.str.includes('PASS')), 'the result status shares the candidate row');
  assert.ok(row.some(item => item.str.includes('%')), 'the percentage shares the candidate row');
});

test('the result sheet uses two full-width subject rows when the subject list is long', async () => {
  const subjectCodes = Array.from({ length: 20 }, (_, index) => String(index + 101));
  const candidates = [{
    rollNo: '10000001',
    name: 'STUDENT ONE',
    gender: 'F',
    status: 'PASS',
    subjects: subjectCodes.map((code, index) => ({
      code,
      marks: { value: 50 + index, raw: '' },
      grade: { value: 'A1', raw: '' }
    }))
  }];
  const blob = await buildResultSheetPdf({}, {}, { candidates, meta: {} }, [], {
    candidates,
    subjectCodes,
    subjectTable: subjectCodes.map(code => ({ code, max: 100, valid: 1 })),
    hasMarks: true
  });
  const pdf = await getDocument({ data: new Uint8Array(await blob.arrayBuffer()), useSystemFonts: true }).promise;
  const page = await pdf.getPage(1);
  const { items } = await page.getTextContent();
  const subjectRows = [...new Set(
    items.filter(item => item.str.includes('A1')).map(item => Math.round(item.transform[5] * 100) / 100)
  )];
  const lastSubjectHeader = items.find(item => item.str === subjectCodes[19]);
  const lastSubjectValue = items
    .filter(item => item.transform[5] === subjectRows[1] && item.str === 'A1')
    .sort((a, b) => b.transform[4] - a.transform[4])[0];

  assert.equal(subjectRows.length, 2, 'all subjects fit into two candidate rows');
  assert.ok(lastSubjectHeader);
  assert.ok(lastSubjectValue);
  assert.ok(Math.abs(
    lastSubjectHeader.transform[4] + lastSubjectHeader.width
      - lastSubjectValue.transform[4] - lastSubjectValue.width
  ) < 2, 'the continued subject value stays under its header');
});

test('the summary report footer includes MyFiles branding and page numbering', async () => {
  const { dataset, analytics, validation, model: exported } = model();
  const blob = await buildPdfReport(exported, analytics, dataset, validation.checks, {
    candidates: [],
    subjectCodes: [],
    subjectTable: [],
    hasMarks: true
  });
  const pdf = await getDocument({ data: new Uint8Array(await blob.arrayBuffer()), useSystemFonts: true }).promise;
  const page = await pdf.getPage(1);
  const { items } = await page.getTextContent();

  assert.ok(items.some(item => item.str === 'MyFiles. | CBSE Result Analysis Report'));
  assert.ok(items.some(item => item.str === `Page 1 of ${pdf.numPages}`));
});
