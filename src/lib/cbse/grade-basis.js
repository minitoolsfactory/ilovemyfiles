/**
 * Grade basis detection for CBSE gazettes.
 *
 * A gazette prints a mark and a grade in every subject cell. The file usually
 * does NOT say which quantity the grade was awarded on: the printed mark can
 * be a theory mark, a theory mark plus internal assessment, or a mark on a
 * combined scale. A grade can therefore look inconsistent with the printed
 * mark without the extraction being wrong.
 *
 * Instead of guessing, this module measures the printed pairs: for every
 * subject it tries the known CBSE grade tables and reports the table (the
 * "basis") that the printed grades actually follow. A subject is only called
 * established when the printed grades match a known table for almost every
 * entry. Subjects that match no known table are reported as undisclosed, and
 * their grades are printed as they are, never re-derived.
 *
 * @typedef {Object} GradeBasisResult
 * @property {boolean} established  true when a known CBSE table explains the grades
 * @property {string}  reason       why no basis could be established
 * @property {number}  max          the maximum the basis was found on
 * @property {number}  checked      how many printed entries were compared
 * @property {number}  agree        how many of them matched
 * @property {number}  rate         agreement as a fraction between 0 and 1
 */

import { gradeForMarks } from './subjects.js';

/**
 * Maximums a CBSE subject is known to be printed on. The grade tables for 50,
 * 80 and 100 are the published CBSE boundaries; the other values are tried
 * with the percentage boundaries so an unusual scale can still be recognised.
 */
export const CANDIDATE_MAXIMA = [40, 50, 60, 70, 80, 90, 95, 100, 120];

/** How many printed entries a subject needs before a basis is believed. */
export const MIN_ENTRIES = 10;

/** How many different grades a subject needs before a basis is believed. */
export const MIN_GRADES = 3;

/** Share of entries that have to match before a basis is believed. */
export const AGREEMENT_THRESHOLD = 0.95;

/**
 * Compare the printed grades of one subject with the CBSE table of `max`.
 *
 * @param {{ marks: number, grade: string }[]} entries
 * @param {number} max
 * @returns {{ checked: number, agree: number, rate: number }}
 */
export function compareWithBasis(entries, max) {
  let checked = 0;
  let agree = 0;
  for (const entry of entries) {
    if (!Number.isFinite(entry?.marks) || !entry?.grade) continue;
    checked += 1;
    if (gradeForMarks(entry.marks, max) === entry.grade) agree += 1;
  }
  return { checked, agree, rate: checked ? agree / checked : 0 };
}

/**
 * Find the grade table the printed grades of one subject follow.
 *
 * @param {{ marks: number, grade: string }[]} entries
 * @param {{ maxima?: number[], minEntries?: number, minGrades?: number, threshold?: number }} [options]
 * @returns {GradeBasisResult}
 */
export function detectGradeBasis(entries, options = {}) {
  const usable = (entries ?? []).filter(entry => Number.isFinite(entry?.marks) && entry?.grade);
  const grades = new Set(usable.map(entry => entry.grade));
  const minEntries = options.minEntries ?? MIN_ENTRIES;
  const minGrades = options.minGrades ?? MIN_GRADES;
  const threshold = options.threshold ?? AGREEMENT_THRESHOLD;

  if (usable.length < minEntries || grades.size < minGrades) {
    return {
      established: false,
      reason: usable.length < minEntries ? 'too-few-entries' : 'too-few-grades',
      max: null,
      checked: usable.length,
      agree: 0,
      rate: 0
    };
  }

  const maxima = [...new Set([...(options.maxima ?? CANDIDATE_MAXIMA), ...(options.extraMaxima ?? [])])];
  let best = null;
  for (const max of maxima) {
    const result = compareWithBasis(usable, max);
    if (!result.checked) continue;
    if (!best || result.rate > best.rate) best = { max, ...result };
  }

  if (!best) {
    return { established: false, reason: 'no-candidate-scale', max: null, checked: 0, agree: 0, rate: 0 };
  }
  if (best.rate < threshold) {
    return {
      established: false,
      reason: 'no-known-table',
      max: best.max,
      checked: best.checked,
      agree: best.agree,
      rate: best.rate
    };
  }
  return {
    established: true,
    reason: 'matched',
    max: best.max,
    checked: best.checked,
    agree: best.agree,
    rate: best.rate
  };
}

/**
 * Detect the grade basis of every subject in a dataset.
 *
 * @param {Object} dataset parsed dataset with a `subjectTable`
 * @param {{ minEntries?: number, minGrades?: number, threshold?: number }} [options]
 * @returns {{ subjects: Object[], established: number, undisclosed: number, checked: number, agree: number }}
 */
export function analyseGradeBasis(dataset, options = {}) {
  const byCode = new Map();
  for (const candidate of dataset.candidates ?? []) {
    for (const subject of candidate.subjects) {
      if (!subject.code || subject.marks.value === null || !subject.grade.value) continue;
      if (!byCode.has(subject.code)) byCode.set(subject.code, []);
      byCode.get(subject.code).push({ marks: subject.marks.value, grade: subject.grade.value });
    }
  }

  const table = dataset.subjectTable ?? [];
  const subjects = [];
  let checked = 0;
  let agree = 0;
  let established = 0;
  let undisclosed = 0;

  for (const [code, entries] of byCode) {
    const entry = table.find(item => item.code === code);
    const extra = entry?.max ? [entry.max] : [];
    const result = detectGradeBasis(entries, { ...options, extraMaxima: extra });
    subjects.push({ code, entries: entries.length, ...result });
    if (result.established) {
      established += 1;
      checked += result.checked;
      agree += result.agree;
    } else {
      undisclosed += 1;
    }
  }

  return {
    subjects,
    established,
    undisclosed,
    checked,
    agree,
    rate: checked ? agree / checked : 0
  };
}
