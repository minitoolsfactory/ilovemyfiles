/**
 * CBSE Class X (Secondary) subject metadata and result-status vocabulary.
 *
 * IMPORTANT DATA-INTEGRITY RULE
 * ------------------------------
 * Only subject codes that can be identified with confidence are listed in
 * `VERIFIED_SUBJECTS`. Every other code is surfaced to the user as
 * "Subject <code>" and flagged as unmapped. The analyzer never invents a
 * subject name, a maximum mark, a pass mark or a result status.
 *
 * `max` is the published maximum *theory* mark of the subject. Gazette files
 * that print a combined (theory + internal assessment) scale are detected at
 * runtime and reported as "scale inferred" rather than being silently
 * accepted or silently rejected.
 */

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
  { token: 'ABSENT', status: RESULT_STATUS.ABSENT }
];

/**
 * Verified CBSE Class X subject codes.
 *
 * `group` is used for grouping in the UI only.
 *
 * `max` is the published TOTAL mark scale of the subject, which is the scale a
 * gazette prints: an academic subject is 80 theory marks plus 20 marks of
 * internal assessment, so the gazette prints it out of 100. A skill subject is
 * 50 marks, and schools print it either out of 50 or out of 100, so it lists
 * both scales in `scales`.
 *
 * Codes that are not listed here are treated as unknown.
 */
export const VERIFIED_SUBJECTS = {
  '001': { name: 'Hindi (Course A)', max: 100, group: 'language' },
  '002': { name: 'Hindi (Course B)', max: 100, group: 'language' },
  '003': { name: 'English (Course A)', max: 100, group: 'language' },
  '004': { name: 'English (Course B)', max: 100, group: 'language' },
  '005': { name: 'English Core', max: 100, group: 'language' },
  '006': { name: 'Hindi (Course A) - old', max: 100, group: 'language' },
  '041': { name: 'Mathematics (Standard)', max: 100, group: 'mathematics' },
  '042': { name: 'Mathematics (Basic)', max: 100, group: 'mathematics' },
  '083': { name: 'Mathematics (Basic)', max: 100, group: 'mathematics' },
  '085': { name: 'Science', max: 100, group: 'science' },
  '086': { name: 'Social Science', max: 100, group: 'social-science' },
  '087': { name: 'Hindi (Course A)', max: 100, group: 'language' },
  '088': { name: 'Hindi (Course B)', max: 100, group: 'language' },
  '089': { name: 'Hindi (Course A)', max: 100, group: 'language' },
  '090': { name: 'Hindi (Course B)', max: 100, group: 'language' },
  '091': { name: 'English Core', max: 100, group: 'language' },
  '092': { name: 'Hindi', max: 100, group: 'language' },
  '097': { name: 'Foreign Language (Additional)', max: 100, group: 'language' },
  '098': { name: 'Foreign Language (Additional)', max: 100, group: 'language' },
  '122': { name: 'Skill Education', max: 50, scales: [50, 100], group: 'skill' },
  '222': { name: 'Skill Education', max: 50, scales: [50, 100], group: 'skill' },
  '301': { name: 'Skill Education', max: 50, scales: [50, 100], group: 'skill' },
  '302': { name: 'Skill Education', max: 50, scales: [50, 100], group: 'skill' },
  '303': { name: 'Skill Education', max: 50, scales: [50, 100], group: 'skill' },
  '304': { name: 'Skill Education', max: 50, scales: [50, 100], group: 'skill' },
  '313': { name: 'Skill Education', max: 50, scales: [50, 100], group: 'skill' },
  '314': { name: 'Skill Education', max: 50, scales: [50, 100], group: 'skill' },
  '315': { name: 'Skill Education', max: 50, scales: [50, 100], group: 'skill' },
  '401': { name: 'Skill Education', max: 50, scales: [50, 100], group: 'skill' },
  '413': { name: 'Skill Education', max: 50, scales: [50, 100], group: 'skill' },
  '414': { name: 'Skill Education', max: 50, scales: [50, 100], group: 'skill' },
  '415': { name: 'Skill Education', max: 50, scales: [50, 100], group: 'skill' },
  '416': { name: 'Skill Education', max: 50, scales: [50, 100], group: 'skill' },
  '417': { name: 'Skill Education', max: 50, scales: [50, 100], group: 'skill' },
  '418': { name: 'Skill Education', max: 50, scales: [50, 100], group: 'skill' }
};

/** Marks scales that a gazette may print. Used to explain an inferred maximum. */
export const KNOWN_SCALES = [50, 80, 100];

/**
 * CBSE Class X grade boundaries, keyed by the printed maximum.
 * Used ONLY to check whether a printed grade agrees with the printed mark.
 * Grades are never used to infer a pass or fail.
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
 * Resolve a subject code to display metadata.
 *
 * @param {string} code raw subject code
 * @param {{ overrides?: Record<string, { name?: string, max?: number }> }} [options]
 * @returns {{ code: string, name: string, nameSource: string, max: number|null, maxSource: string, publishedMax: number|null, publishedScales: number[], group: string, verified: boolean }}
 */
export function resolveSubject(code, options = {}) {
  const key = String(code ?? '').trim();
  const override = options.overrides?.[key] ?? {};
  const verified = Object.prototype.hasOwnProperty.call(VERIFIED_SUBJECTS, key);
  const base = verified ? VERIFIED_SUBJECTS[key] : null;
  const name = (override.name ?? base?.name ?? '').trim();
  const userMax = Number.isFinite(override.max) && override.max > 0 ? Math.round(override.max) : null;
  const max = userMax ?? (base?.max ?? null);
  const publishedScales = base
    ? [...new Set([base.max, ...(base.scales ?? [])])].filter(value => Number.isFinite(value)).sort((a, b) => a - b)
    : [];
  return {
    code: key,
    name: name || (key ? `Subject ${key}` : 'Unknown subject'),
    nameSource: override.name ? 'user' : (name ? 'verified' : 'unknown'),
    max,
    maxSource: userMax ? 'user' : (base?.max ? 'verified' : 'unknown'),
    publishedMax: base?.max ?? null,
    publishedScales,
    group: override.group ?? base?.group ?? 'other',
    verified
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
