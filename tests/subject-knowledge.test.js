import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CBSE_SUBJECT_DATA,
  allSubjects,
  lookupSubject,
  resolveSubject,
  subjectClassKey,
  subjectTableFor,
  totalMarks
} from '../src/lib/cbse/subjects.js';

test('the knowledge base holds both classes', () => {
  assert.deepEqual(Object.keys(CBSE_SUBJECT_DATA.classes).sort(), ['X', 'XII']);
  assert.ok(Object.keys(CBSE_SUBJECT_DATA.classes.X).length > 80);
  assert.ok(Object.keys(CBSE_SUBJECT_DATA.classes.XII).length > 100);
});

test('a class name is mapped to a key of the knowledge base', () => {
  assert.equal(subjectClassKey('X'), 'X');
  assert.equal(subjectClassKey('XII'), 'XII');
  assert.equal(subjectClassKey('10'), 'X');
  assert.equal(subjectClassKey('12'), 'XII');
  assert.equal(subjectClassKey('SECONDARY'), 'X');
  assert.equal(subjectClassKey('SENIOR SECONDARY'), 'XII');
  assert.equal(subjectClassKey(''), null);
  assert.equal(subjectClassKey(null), null);
});

test('the class X codes of the sample gazette carry the official name', () => {
  assert.equal(lookupSubject('002', 'X').entry.name, 'Hindi Course-A');
  assert.equal(lookupSubject('085', 'X').entry.name, 'Hindi Course-B');
  assert.equal(lookupSubject('086', 'X').entry.name, 'Science');
  assert.equal(lookupSubject('087', 'X').entry.name, 'Social Science');
  assert.equal(lookupSubject('041', 'X').entry.name, 'Mathematics (Standard)');
  assert.equal(lookupSubject('241', 'X').entry.name, 'Mathematics (Basic)');
  assert.equal(lookupSubject('184', 'X').entry.name, 'English (Language and Literature)');
  assert.equal(lookupSubject('122', 'X').entry.name, 'Sanskrit');
  assert.equal(lookupSubject('414', 'X').entry.name, 'Apparel');
  assert.equal(lookupSubject('418', 'X').entry.name, 'Physical Activity Trainer');
});

test('the same code means a different subject in a different class', () => {
  assert.equal(lookupSubject('002', 'X').entry.name, 'Hindi Course-A');
  assert.equal(lookupSubject('002', 'XII').entry.name, 'Hindi Elective');
  assert.equal(lookupSubject('241', 'X').entry.name, 'Mathematics (Basic)');
  assert.equal(lookupSubject('241', 'XII').entry.name, 'Applied Mathematics');
});

test('the total a gazette prints is theory plus internal assessment plus practical', () => {
  assert.equal(totalMarks({ theory: 80, internal: 20 }), 100);
  assert.equal(totalMarks({ theory: 50, practical: 50 }), 100);
  assert.equal(totalMarks({ theory: 30, internal: 20, practical: 50 }), 100);
  assert.equal(totalMarks({}), 0);
});

test('every subject of the knowledge base is printed on a scale of 100', () => {
  for (const subject of allSubjects()) {
    assert.equal(subject.max, 100, `${subject.classKey} ${subject.code} ${subject.name}`);
  }
});

test('a subject code that is not in the knowledge base is not guessed', () => {
  const subject = resolveSubject('999', { className: 'X' });
  assert.equal(subject.verified, false);
  assert.equal(subject.name, 'Subject 999');
  assert.equal(subject.max, null);
  assert.equal(subject.nameSource, 'unknown');
});

test('a code outside the class falls back to the other class', () => {
  const subject = resolveSubject('843', { className: 'X' });
  assert.equal(subject.verified, true);
  assert.equal(subject.name, 'Artificial Intelligence');
});

test('a reviewer can override the name and the maximum', () => {
  const subject = resolveSubject('002', { className: 'X', overrides: { '002': { name: 'Hindi', max: 80 } } });
  assert.equal(subject.name, 'Hindi');
  assert.equal(subject.nameSource, 'user');
  assert.equal(subject.max, 80);
  assert.equal(subject.maxSource, 'user');
  assert.deepEqual(subject.publishedScales, [100]);
});

test('the class table is returned for a class name', () => {
  const table = subjectTableFor('X');
  assert.ok(table['041']);
  assert.equal(subjectTableFor('nonsense'), null);
});

test('the library can be listed for one class or for all of them', () => {
  const all = allSubjects();
  const classX = allSubjects('X');
  assert.ok(all.length > classX.length);
  assert.ok(classX.every(subject => subject.classKey === 'X'));
});
