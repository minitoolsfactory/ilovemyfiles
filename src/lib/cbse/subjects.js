/**
 * CBSE subject metadata, result status vocabulary and grade boundaries.
 *
 * The subject names and the published mark scales come from the CBSE subject
 * code knowledge base in `src/data/cbse-subjects.json`, which is built from
 * the official CBSE subject list and the board date sheets.
 *
 * IMPORTANT DATA-INTEGRITY RULE
 * ------------------------------
 * A subject code that is not in the knowledge base is surfaced to the user as
 * "Subject <code>" and flagged. It is never guessed.
 */

import subjectData from '../../data/cbse-subjects.json' with { type: 'json' };

/** The knowledge base, as shipped. */
export const CBSE_SUBJECT_DATA = subjectData;

/** Canonical result statuses used across the analyzer. */
export const RESULT_STATUS = {
  PASS: 'PASS',
  COMPARTMENT: 'COMPARTMENT',
  ESSENTIAL_REPEAT: 'ESSENTIAL_REPEAT',
  ABSENT: 'ABSENT',
  OTHER: 'OTHER'
};

/** Display metadata for each canonical status, in presentation order. */
export const STATUS_META = {
  [RESULT_STATUS.PASS]: { key: RESULT_STATUS.PASS, label: 'Passed', short: 'Pass', order: 1, tone: 'pass' },
  [RESULT_STATUS.COMPARTMENT]: { key: RESULT_STATUS.COMPARTMENT, label: 'Compartment', short: 'Comp', order: 2, tone: 'comp' },
  [RESULT_STATUS.ESSENTIAL_REPEAT]: { key: RESULT_STATUS.ESSENTIAL_REPEAT, label: 'Essential repeat', short: 'ERL', order: 3, tone: 'erl' },
  [RESULT_STATUS.ABSENT]: { key: RESULT_STATUS.ABSENT, label: 'Absent', short: 'Abs', order: 4, tone: 'absent' },
  [RESULT_STATUS.OTHER]: { key: RESULT_STATUS.OTHER, label: 'Other / unknown', short: 'Other', order: 5, tone: 'other' }
};

/** Statuses that mean "the candidate sat the examination". */
export const APPEARED_STATUSES = [RESULT_STATUS.PASS, RESULT_STATUS.COMPARTMENT, RESULT_STATUS.ESSENTIAL_REPEAT];

/**
 * Printed status tokens found in CBSE gazettes, mapped to canonical statuses.
 * Matching is case-insensitive and done on word boundaries.
 */
export const STATUS_TOKENS = [
  { token: 'PASS', status: RESULT_STATUS.PASS },
  { token: 'PASSED', status: RESULT_STATUS.PASS },
  { token: 'COMP', status: RESULT_STATUS.COMPARTMENT },
  { token: 'COMPT', status: RESULT_STATUS.COMPARTMENT },
  { token: 'COMPTT', status: RESULT_STATUS.COMPARTMENT },
  { token: 'COMPARTMENT', status: RESULT_STATUS.COMPARTMENT },
  { token: 'ERL', status: RESULT_STATUS.ESSENTIAL_REPEAT },
  { token: 'ESSENTIAL REPEAT', status: RESULT_STATUS.ESSENTIAL_REPEAT },
  { token: 'REPEAT', status: RESULT_STATUS.ESSENTIAL_REPEAT },
  { token: 'ABST', status: RESULT_STATUS.ABSENT },
  { token: 'ABSENT', status: RESULT_STATUS.ABSENT },
  // A senior secondary compartment gazette prints XXXX when the result is not
  // decided. It is a status of its own, so it is reported as "other".
  { token: 'XXXX', status: RESULT_STATUS.OTHER }
];

/** Marks scales that a gazette may print. Used to explain an inferred maximum. */
export const KNOWN_SCALES = [50, 80, 100];

/**
 * CBSE Class X grade boundaries, keyed by the printed maximum.
 * Used ONLY to check whether a printed grade agrees with the printed mark.
 * Grades are never used to infer a pass or a fail.
 */
export const GRADE_BOUNDARIES = {
  100: [
    { min: 93, grade: 'A1' }, { min: 81, grade: 'A2' }, { min: 69, grade: 'B1' },
    { min: 51, grade: 'B2' }, { min: 35, grade: 'C1' }, { min: 21, grade: 'C2' },
    { min: 11, grade: 'D1' }, { min: 1, grade: 'D2' }, { min: 0, grade: 'E' }
  ],
  80: [
    { min: 75, grade: 'A1' }, { min: 64, grade: 'A2' }, { min: 53, grade: 'B1' },
    { min: 42, grade: 'B2' }, { min: 33, grade: 'C1' }, { min: 25, grade: 'C2' },
    { min: 17, grade: 'D1' }, { min: 8, grade: 'D2' }, { min: 0, grade: 'E' }
  ]
};

/** Percentage-based fallback boundaries for scales that are not 80 or 100. */
const PERCENT_BOUNDARIES = [
  { min: 93, grade: 'A1' }, { min: 81, grade: 'A2' }, { min: 69, grade: 'B1' },
  { min: 51, grade: 'B2' }, { min: 35, grade: 'C1' }, { min: 21, grade: 'C2' },
  { min: 11, grade: 'D1' }, { min: 1, grade: 'D2' }, { min: 0, grade: 'E' }
];

/**
 * Normalise a class name to a key of the knowledge base.
 *
 * @param {string|null|undefined} className
 * @returns {'X'|'XII'|null}
 */
export function subjectClassKey(className) {
  const value = String(className ?? '').trim().toUpperCase();
  if (!value) return null;
  if (value === 'XII' || value === '12' || value.includes('SENIOR')) return 'XII';
  if (value === 'X' || value === '10' || value === 'IX' || value === 'IX-X' || value.includes('SECONDARY')) return 'X';
  return null;
}

/**
 * The subject table of a class.
 *
 * @param {string|null} className
 * @returns {Record<string, Object>|null}
 */
export function subjectTableFor(className) {
  const key = subjectClassKey(className);
  if (key) return subjectData.classes[key] ?? null;
  return null;
}

/**
 * The total mark a gazette prints for a subject: theory plus internal
 * assessment plus practical.
 *
 * @param {{ theory?: number, internal?: number, practical?: number }} subject
 * @returns {number}
 */
export function totalMarks(subject) {
  return (subject?.theory ?? 0) + (subject?.internal ?? 0) + (subject?.practical ?? 0);
}

/**
 * Look a subject code up in the knowledge base.
 *
 * @param {string} code
 * @param {string|null} className
 * @returns {{ entry: Object|null, classKey: string|null }}
 */
export function lookupSubject(code, className) {
  const key = String(code ?? '').trim();
  const preferred = subjectTableFor(className);
  if (preferred && preferred[key]) return { entry: preferred[key], classKey: subjectClassKey(className) };
  for (const [classKey, table] of Object.entries(subjectData.classes)) {
    if (table[key]) return { entry: table[key], classKey };
  }
  return { entry: null, classKey: null };
}

/**
 * Every subject of the knowledge base, optionally for one class.
 *
 * @param {string|null} [className]
 * @returns {Array<{ code: string, name: string, group: string, max: number, classKey: string }>}
 */
export function allSubjects(className = null) {
  const keys = className ? [subjectClassKey(className)].filter(Boolean) : Object.keys(subjectData.classes);
  const list = [];
  for (const classKey of keys) {
    const table = subjectData.classes[classKey] ?? {};
    for (const [code, entry] of Object.entries(table)) {
      list.push({
        code,
        name: entry.name,
        group: entry.group,
        max: totalMarks(entry),
        theory: entry.theory ?? 0,
        internal: entry.internal ?? 0,
        practical: entry.practical ?? 0,
        classKey
      });
    }
  }
  return list;
}

/**
 * Resolve a subject code to display metadata.
 *
 * @param {string} code raw subject code
 * @param {{ overrides?: Record<string, { name?: string, max?: number }>, className?: string|null }} [options]
 * @returns {{ code: string, name: string, nameSource: string, max: number|null, maxSource: string, publishedMax: number|null, publishedScales: number[], group: string, verified: boolean }}
 */
export function resolveSubject(code, options = {}) {
  const key = String(code ?? '').trim();
  const override = options.overrides?.[key] ?? {};
  const { entry, classKey } = lookupSubject(key, options.className ?? null);
  const name = (override.name ?? entry?.name ?? '').trim();
  const publishedMax = entry ? totalMarks(entry) : null;
  const userMax = Number.isFinite(override.max) && override.max > 0 ? Math.round(override.max) : null;
  const max = userMax ?? publishedMax;
  const publishedScales = publishedMax ? [publishedMax] : [];
  return {
    code: key,
    name: name || (key ? `Subject ${key}` : 'Unknown subject'),
    nameSource: override.name ? 'user' : (name ? 'verified' : 'unknown'),
    max,
    maxSource: userMax ? 'user' : (publishedMax ? 'verified' : 'unknown'),
    publishedMax,
    publishedScales,
    classKey,
    group: override.group ?? entry?.group ?? 'other',
    verified: Boolean(entry)
  };
}

/**
 * Grade implied by a mark for a given maximum.
 * Only used for the "does the printed grade agree with the printed mark" check.
 *
 * @param {number} marks
 * @param {number|null} max
 * @returns {string|null}
 */
export function gradeForMarks(marks, max) {
  if (!Number.isFinite(marks) || !Number.isFinite(max) || max <= 0) return null;
  const table = GRADE_BOUNDARIES[max] ?? PERCENT_BOUNDARIES.map(bound => ({
    min: Math.ceil((bound.min / 100) * max),
    grade: bound.grade
  }));
  for (const bound of table) {
    if (marks >= bound.min) return bound.grade;
  }
  return 'E';
}

/** Ordered list of the grade letters used by CBSE, for stable chart ordering. */
export const GRADE_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'E'];
