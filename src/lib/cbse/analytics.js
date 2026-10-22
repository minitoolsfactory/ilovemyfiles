/**
 * Analytics for CBSE gazette datasets.
 *
 * Every percentage produced here carries an explicit denominator so that a
 * reader can tell exactly what is being counted. Absent candidates are never
 * folded into an "appeared" figure, and result statuses are never inferred
 * from marks.
 */

import {
  RESULT_STATUS,
  STATUS_META,
  GRADE_ORDER,
  KNOWN_SCALES,
  GENDER_LABELS,
  genderKey,
  gradeForMarks,
  resolveSubject
} from './subjects.js';

/** Default score bands, expressed as a percentage of the subject maximum. */
export const DEFAULT_BANDS = [
  { id: 'b0', label: '0-9%', min: 0, max: 10 },
  { id: 'b1', label: '10-19%', min: 10, max: 20 },
  { id: 'b2', label: '20-29%', min: 20, max: 30 },
  { id: 'b3', label: '30-39%', min: 30, max: 40 },
  { id: 'b4', label: '40-49%', min: 40, max: 50 },
  { id: 'b5', label: '50-59%', min: 50, max: 60 },
  { id: 'b6', label: '60-69%', min: 60, max: 70 },
  { id: 'b7', label: '70-79%', min: 70, max: 80 },
  { id: 'b8', label: '80-89%', min: 80, max: 90 },
  { id: 'b9', label: '90-100%', min: 90, max: 100.0001 }
];

/** How many candidates the top performer table lists by default. */
export const TOP_PERFORMERS = 10;

/**
 * @param {number[]} values
 * @returns {number} median
 */
export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * @param {number[]} values
 * @returns {number|null} sample standard deviation
 */
export function standardDeviation(values) {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * @param {number} value
 * @param {number} digits
 * @returns {number}
 */
export function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Resolve the effective maximum for a subject, and say how it was resolved.
 *
 * The gazette does not print a maximum column, so the maximum in force is the
 * published scale of the subject when the printed marks fit it, and otherwise
 * the smallest known scale that fits the printed marks. The value that is used
 * is always the one the file itself implies, so a gazette that prints a
 * subject out of 100 is measured out of 100.
 *
 * @param {{ max: number|null, maxSource: string, verified: boolean, code: string, publishedScales?: number[] }} subject
 * @param {number} observedMax
 * @returns {{ max: number|null, source: string, flags: string[] }}
 */
export function resolveEffectiveMax(subject, observedMax) {
  const flags = [];
  if (!subject.verified) flags.push('unmapped-code');
  const published = subject.publishedScales?.length
    ? subject.publishedScales
    : (Number.isFinite(subject.max) ? [subject.max] : []);

  if (!published.length) {
    // No published scale to compare against: the scale comes from the file.
    if (observedMax > 0) {
      const scale = KNOWN_SCALES.find(value => value >= observedMax);
      if (scale) return { max: scale, source: 'inferred', flags };
      flags.push('scale-unknown');
      return { max: null, source: 'unknown', flags };
    }
    flags.push('max-unknown');
    return { max: null, source: 'unknown', flags };
  }

  const fitting = published.find(scale => observedMax <= scale);
  if (fitting !== undefined) {
    return { max: fitting, source: 'verified', flags };
  }

  // The printed marks are above every published scale of the subject.
  const scale = KNOWN_SCALES.find(value => value >= observedMax);
  flags.push('scale-inferred', 'exceeds-published-max');
  if (scale) return { max: scale, source: 'inferred', flags };
  flags.push('scale-unknown');
  return { max: null, source: 'unknown', flags };
}

/**
 * Build the per-subject table for a dataset.
 *
 * @param {Object} dataset parsed dataset
 * @param {Record<string, { name?: string, max?: number }>} [overrides]
 * @returns {Object[]}
 */
export function buildSubjectTable(dataset, overrides = {}) {
  const table = new Map();
  for (const candidate of dataset.candidates) {
    for (const subject of candidate.subjects) {
      if (!subject.code) continue;
      if (!table.has(subject.code)) {
        table.set(subject.code, {
          code: subject.code,
          resolved: resolveSubject(subject.code, { overrides, className: dataset.meta?.class ?? null }),
          occurrences: 0,
          marks: [],
          grades: new Map(),
          missing: 0,
          invalid: 0,
          absent: 0,
          orderVariants: new Set(),
          records: []
        });
      }
      const entry = table.get(subject.code);
      entry.occurrences += 1;
      entry.orderVariants.add(subject.slot);
      entry.records.push(candidate.recordId);
      if (candidate.status === RESULT_STATUS.ABSENT) {
        entry.absent += 1;
        continue;
      }
      if (subject.marks.value === null) {
        if (subject.marks.raw) entry.invalid += 1;
        else entry.missing += 1;
        continue;
      }
      entry.marks.push(subject.marks.value);
      const grade = subject.grade.value ?? '(none)';
      entry.grades.set(grade, (entry.grades.get(grade) ?? 0) + 1);
    }
  }

  return [...table.values()].map(entry => {
    const observedMax = entry.marks.length ? Math.max(...entry.marks) : 0;
    const effective = resolveEffectiveMax(entry.resolved, observedMax);
    const sorted = [...entry.marks].sort((a, b) => a - b);
    const avg = entry.marks.length ? entry.marks.reduce((sum, value) => sum + value, 0) / entry.marks.length : null;
    return {
      code: entry.code,
      name: entry.resolved.name,
      nameSource: entry.resolved.nameSource,
      verified: entry.resolved.verified,
      group: entry.resolved.group,
      publishedMax: entry.resolved.publishedMax,
      publishedScales: entry.resolved.publishedScales,
      max: effective.max,
      maxSource: effective.source,
      flags: effective.flags,
      occurrences: entry.occurrences,
      valid: entry.marks.length,
      missing: entry.missing,
      invalid: entry.invalid,
      absent: entry.absent,
      average: round(avg),
      averagePercent: avg != null && effective.max ? round((avg / effective.max) * 100) : null,
      median: round(median(entry.marks)),
      minimum: sorted.length ? sorted[0] : null,
      maximum: sorted.length ? sorted[sorted.length - 1] : null,
      stdDev: round(standardDeviation(entry.marks)),
      gradeCounts: Object.fromEntries([...entry.grades.entries()].sort((a, b) => gradeOrder(a[0]) - gradeOrder(b[0]))),
      slots: [...entry.orderVariants].sort((a, b) => a - b)
    };
  }).sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * @param {string} grade
 * @returns {number}
 */
function gradeOrder(grade) {
  const index = GRADE_ORDER.indexOf(grade);
  return index === -1 ? GRADE_ORDER.length : index;
}

/**
 * Apply the user's filter set to a dataset.
 *
 * @param {Object} dataset
 * @param {Object} filters
 * @returns {Object[]} filtered candidates
 */
export function applyFilters(dataset, filters = {}) {
  const {
    year = null,
    className = null,
    school = null,
    region = null,
    subject = null,
    status = null,
    grade = null,
    scoreMin = null,
    scoreMax = null
  } = filters;
  const meta = dataset.meta ?? {};
  const subjectTable = dataset.subjectTable ?? [];

  return dataset.candidates.filter(candidate => {
    if (year != null && String(meta.year ?? '') !== String(year)) return false;
    if (className != null && String(meta.class ?? '') !== String(className)) return false;
    if (school != null && String(meta.schoolCode ?? '') !== String(school)) return false;
    if (region != null && String(meta.region ?? '') !== String(region)) return false;
    if (status && candidate.status !== status) return false;
    if (subject) {
      const match = candidate.subjects.find(item => item.code === subject);
      if (!match) return false;
      if (grade && (match.grade.value ?? '(none)') !== grade) return false;
    } else if (grade) {
      const match = candidate.subjects.find(item => (item.grade.value ?? '(none)') === grade);
      if (!match) return false;
    }
    if (scoreMin != null || scoreMax != null) {
      const score = aggregateScore(candidate, subjectTable);
      if (score.percent == null) return false;
      if (scoreMin != null && score.percent < scoreMin) return false;
      if (scoreMax != null && score.percent > scoreMax) return false;
    }
    return true;
  });
}

/**
 * Aggregate score of a candidate over the subject set they were offered.
 *
 * @param {Object} candidate
 * @param {Object[]} subjectTable
 * @returns {{ total: number|null, available: number|null, percent: number|null, subjects: number }}
 */
export function aggregateScore(candidate, subjectTable = []) {
  const maxByCode = new Map(subjectTable.map(entry => [entry.code, entry.max]));
  let total = 0;
  let available = 0;
  let subjects = 0;
  for (const subject of candidate.subjects) {
    if (!subject.code) continue;
    subjects += 1;
    if (subject.marks.value === null) continue;
    const max = maxByCode.get(subject.code);
    if (!max) continue;
    total += subject.marks.value;
    available += max;
  }
  return {
    // A gazette that prints the grades without the marks has no total.
    total: available ? total : null,
    available: available || null,
    percent: available ? round((total / available) * 100) : null,
    subjects
  };
}

/**
 * Every subject code of a dataset, in the order the gazette prints them.
 *
 * The order is the order of the columns of the first candidate, followed by
 * any code that only shows up later in the file. It is used to lay out the
 * per subject columns of the student and top candidate tables, so every
 * candidate is measured against the same set of columns.
 *
 * @param {Object} dataset
 * @returns {string[]}
 */
export function subjectCodeOrder(dataset) {
  const codes = [];
  const seen = new Set();
  for (const candidate of dataset?.candidates ?? []) {
    for (const subject of candidate.subjects ?? []) {
      if (!subject.code || seen.has(subject.code)) continue;
      seen.add(subject.code);
      codes.push(subject.code);
    }
  }
  return codes;
}

/**
 * Compute every figure the dashboard needs.
 *
 * @param {Object} dataset parsed dataset (with `subjectTable` applied)
 * @param {Object} [options]
 * @param {Object[]} [options.filters]
 * @param {Object[]} [options.bands]
 * @returns {Object}
 */
export function computeAnalytics(dataset, options = {}) {
  const filters = options.filters ?? {};
  const bands = options.bands?.length ? options.bands : DEFAULT_BANDS;
  const subjectTable = dataset.subjectTable ?? [];
  const candidates = applyFilters(dataset, filters);
  const total = candidates.length;

  const statusCounts = {};
  for (const key of Object.values(RESULT_STATUS)) statusCounts[key] = 0;
  for (const candidate of candidates) {
    statusCounts[candidate.status] = (statusCounts[candidate.status] ?? 0) + 1;
  }

  const absent = statusCounts[RESULT_STATUS.ABSENT] ?? 0;
  const appeared = total - absent;
  const passed = statusCounts[RESULT_STATUS.PASS] ?? 0;
  const compartment = statusCounts[RESULT_STATUS.COMPARTMENT] ?? 0;
  const essentialRepeat = statusCounts[RESULT_STATUS.ESSENTIAL_REPEAT] ?? 0;
  const other = statusCounts[RESULT_STATUS.OTHER] ?? 0;

  // The split of the class by the gender printed in the gazette.
  const genderBreakdown = [...new Set(candidates.map(candidate => genderKey(candidate.gender)))].sort().map(key => {
    const group = candidates.filter(candidate => genderKey(candidate.gender) === key);
    const groupPassed = group.filter(candidate => candidate.status === RESULT_STATUS.PASS).length;
    const groupCompartment = group.filter(candidate => candidate.status === RESULT_STATUS.COMPARTMENT).length;
    const groupAbsent = group.filter(candidate => candidate.status === RESULT_STATUS.ABSENT).length;
    const groupOther = group.filter(candidate => candidate.status === RESULT_STATUS.OTHER).length;
    const groupAppeared = group.length - groupAbsent;
    const groupScores = group
      .map(candidate => aggregateScore(candidate, subjectTable))
      .filter(score => score.percent != null);
    return {
      key,
      label: GENDER_LABELS[key] ?? 'Not printed',
      candidates: group.length,
      passed: groupPassed,
      compartment: groupCompartment,
      absent: groupAbsent,
      other: groupOther,
      appeared: groupAppeared,
      passPercentage: groupAppeared ? round((groupPassed / groupAppeared) * 100) : null,
      average: groupScores.length
        ? round(groupScores.reduce((sum, score) => sum + score.percent, 0) / groupScores.length)
        : null
    };
  });

  const statusDistribution = Object.values(RESULT_STATUS)
    .map(key => ({
      key,
      label: STATUS_META[key].label,
      count: statusCounts[key] ?? 0,
      share: total ? round(((statusCounts[key] ?? 0) / total) * 100) : 0
    }))
    .filter(entry => entry.count > 0);

  // Subject level statistics, restricted to the filtered candidates.
  const perSubject = subjectTable.map(entry => {
    const marks = [];
    const grades = new Map();
    let missing = 0;
    let invalid = 0;
    let absent = 0;
    let notAppeared = 0;
    for (const candidate of candidates) {
      const subject = candidate.subjects.find(item => item.code === entry.code);
      if (!subject) continue;
      if (candidate.status === RESULT_STATUS.ABSENT) { absent += 1; continue; }
      if (subject.marks.value === null) {
        if (subject.absent) notAppeared += 1;
        else if (subject.marks.raw) invalid += 1;
        else missing += 1;
        // A gazette that prints the grades without the marks still has grades.
        if (subject.grade.value) grades.set(subject.grade.value, (grades.get(subject.grade.value) ?? 0) + 1);
        continue;
      }
      marks.push(subject.marks.value);
      const grade = subject.grade.value ?? '(none)';
      grades.set(grade, (grades.get(grade) ?? 0) + 1);
    }
    const avg = marks.length ? marks.reduce((sum, value) => sum + value, 0) / marks.length : null;
    const sorted = [...marks].sort((a, b) => a - b);
    return {
      ...entry,
      valid: marks.length,
      missing,
      invalid,
      absent,
      notAppeared,
      average: round(avg),
      averagePercent: avg != null && entry.max ? round((avg / entry.max) * 100) : null,
      median: round(median(marks)),
      minimum: sorted.length ? sorted[0] : null,
      maximum: sorted.length ? sorted[sorted.length - 1] : null,
      stdDev: round(standardDeviation(marks)),
      gradeCounts: Object.fromEntries([...grades.entries()].sort((a, b) => gradeOrder(a[0]) - gradeOrder(b[0]))),
      bandCounts: countBands(marks, entry.max, bands)
    };
  });

  // Overall grade distribution.
  const overallGrades = new Map();
  for (const candidate of candidates) {
    if (candidate.status === RESULT_STATUS.ABSENT) continue;
    for (const subject of candidate.subjects) {
      if (!subject.code) continue;
      // A gazette that prints the grades without the marks still has a grade.
      if (subject.marks.value === null && !subject.grade.value) continue;
      const grade = subject.grade.value ?? '(none)';
      overallGrades.set(grade, (overallGrades.get(grade) ?? 0) + 1);
    }
  }
  const gradeDistribution = [...overallGrades.entries()]
    .map(([grade, count]) => ({ grade, count }))
    .sort((a, b) => gradeOrder(a.grade) - gradeOrder(b.grade));

  // Candidate level scores.
  const scored = candidates.map(candidate => {
    const score = aggregateScore(candidate, subjectTable);
    const graded = candidate.subjects.filter(subject => subject.code && subject.grade.value).length;
    return {
      recordId: candidate.recordId,
      rollNo: candidate.rollNo,
      name: candidate.name,
      gender: candidate.gender,
      status: candidate.status,
      graded,
      ...score
    };
  });
  const scores = scored.filter(entry => entry.percent != null);
  // A gazette that prints the grades without the marks has no score to rank
  // by, so those candidates are ranked by the number of subjects graded.
  const ungraded = scored.filter(entry => entry.percent == null);

  const scoreDistribution = countBands(scores.map(entry => entry.percent), 100, bands).map(band => ({
    ...band,
    count: band.count
  }));

  // The candidates with the highest aggregate score, with the marks of every
  // subject they were offered so the report can show the mark sheet next to
  // the total. Candidates with the same percentage share a rank, the way a
  // printed result report shows it.
  const topCount = Number.isFinite(options.topCount) && options.topCount > 0 ? options.topCount : TOP_PERFORMERS;
  const candidateByRecord = new Map(candidates.map(candidate => [candidate.recordId, candidate]));
  const nameByCode = new Map(subjectTable.map(entry => [entry.code, entry.name]));
  const ranked = scores.length
    ? [...scores].sort((a, b) => (b.percent - a.percent)
        || (b.total - a.total)
        || String(a.rollNo ?? '').localeCompare(String(b.rollNo ?? '')))
    : [...ungraded].sort((a, b) => (b.graded - a.graded)
      || String(a.rollNo ?? '').localeCompare(String(b.rollNo ?? '')));
  let previousKey = null;
  let previousRank = 0;
  const topPerformers = ranked.slice(0, topCount).map((entry, index) => {
    const key = entry.percent == null ? null : entry.percent;
    const rank = key !== null && previousKey === key ? previousRank : index + 1;
    previousKey = key;
    previousRank = rank;
    const candidate = candidateByRecord.get(entry.recordId);
    return {
      rank,
      ...entry,
      subjects: (candidate?.subjects ?? [])
        .filter(subject => subject.code)
        .map(subject => ({
          code: subject.code,
          name: nameByCode.get(subject.code) ?? `Subject ${subject.code}`,
          marks: subject.marks.value,
          marksRaw: subject.marks.raw,
          grade: subject.grade.value,
          absent: subject.absent === true
        }))
    };
  });

  // Every printed subject mark as a percentage of the maximum in force for
  // that subject. The score distribution above is the person level view, this
  // one is the subject level view of the same score bands.
  const maxByCode = new Map(subjectTable.map(entry => [entry.code, entry.max]));
  const markPercents = [];
  for (const candidate of candidates) {
    if (candidate.status === RESULT_STATUS.ABSENT) continue;
    for (const subject of candidate.subjects) {
      if (!subject.code || subject.marks.value === null) continue;
      const max = maxByCode.get(subject.code);
      if (!max) continue;
      markPercents.push((subject.marks.value / max) * 100);
    }
  }
  const markBandDistribution = countBands(markPercents, 100, bands);

  const confidenceValues = candidates.map(candidate => candidate.confidence ?? 0);
  const meanConfidence = confidenceValues.length
    ? round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
    : null;
  const needsReview = candidates.filter(candidate => (candidate.warnings?.length ?? 0) > 0 || (candidate.confidence ?? 0) < 0.85).length;

  const compartmentRecords = candidates.filter(candidate => candidate.status === RESULT_STATUS.COMPARTMENT);
  const compartmentSubjects = {};
  for (const candidate of compartmentRecords) {
    for (const code of candidate.compartmentSubjects) {
      compartmentSubjects[code] = (compartmentSubjects[code] ?? 0) + 1;
    }
  }

  return {
    filters,
    totals: {
      candidates: total,
      passed,
      compartment,
      essentialRepeat,
      absent,
      other,
      appeared,
      passPercentage: appeared ? round((passed / appeared) * 100) : null,
      passPercentageOfAll: total ? round((passed / total) * 100) : null,
      compartmentPercentage: appeared ? round((compartment / appeared) * 100) : null,
      absentPercentage: total ? round((absent / total) * 100) : null
    },
    definitions: {
      appeared: 'The total candidates minus the candidates printed as absent (ABST).',
      passPercentage: 'The passed candidates divided by the appeared candidates, times 100.',
      passPercentageOfAll: 'The passed candidates divided by all the candidates, times 100.',
      averages: 'Subject averages use numeric marks only. Absent, missing and non-numeric entries are excluded.',
      status: 'Result statuses are taken from the printed gazette. They are never derived from marks.',
      topPerformers: 'The candidates with the highest total, ranked by the marks they scored as a percentage of the marks available to them. Candidates with the same percentage share a rank.'
    },
    statusDistribution,
    gradeDistribution,
    genderBreakdown,
    subjects: perSubject,
    subjectCodes: subjectCodeOrder(dataset),
    scoreDistribution,
    markBandDistribution,
    markCount: markPercents.length,
    topPerformers,
    topPerformerTotal: ranked.length,
    scores,
    compartmentSubjects: Object.entries(compartmentSubjects)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count),
    confidence: {
      mean: meanConfidence,
      needsReview,
      total: total,
      distribution: [
        { label: '90-100%', min: 0.9, max: 1.0001 },
        { label: '75-89%', min: 0.75, max: 0.9 },
        { label: '50-74%', min: 0.5, max: 0.75 },
        { label: 'Below 50%', min: 0, max: 0.5 }
      ].map(bucket => ({
        label: bucket.label,
        count: confidenceValues.filter(value => value >= bucket.min && value < bucket.max).length
      }))
    }
  };
}

/**
 * Count values into score bands expressed as a percentage of `max`.
 *
 * @param {number[]} values
 * @param {number|null} max
 * @param {Object[]} bands
 * @returns {Object[]}
 */
export function countBands(values, max, bands) {
  const scale = max && max > 0 ? max : 100;
  const counts = bands.map(band => ({ ...band, count: 0 }));
  for (const value of values) {
    const percent = (value / scale) * 100;
    const index = bands.findIndex(band => percent >= band.min && percent < band.max);
    if (index >= 0) counts[index].count += 1;
  }
  return counts;
}

/**
 * Compare the parsed result against the printed summary of the gazette.
 *
 * @param {Object} dataset
 * @param {Object} analytics
 * @returns {Object[]}
 */
export function compareWithPrintedSummary(dataset, analytics) {
  const printed = dataset.printedSummary;
  if (!printed) return [];
  const totals = analytics.totals;
  const rows = [
    { key: 'totalCandidates', label: 'Total candidates', printed: printed.totalCandidates, calculated: totals.candidates },
    { key: 'totalPass', label: 'Total pass', printed: printed.totalPass, calculated: totals.passed },
    { key: 'compartment', label: 'Compartment', printed: printed.compartment, calculated: totals.compartment },
    { key: 'essentialRepeat', label: 'Essential repeat', printed: printed.essentialRepeat, calculated: totals.essentialRepeat },
    { key: 'absent', label: 'Absent', printed: printed.absent, calculated: totals.absent }
  ];
  if (printed.other != null || totals.other) {
    rows.push({ key: 'other', label: 'Other', printed: printed.other ?? null, calculated: totals.other });
  }
  return rows.map(row => ({
    ...row,
    match: row.printed != null && row.calculated != null ? row.printed === row.calculated : null,
    difference: row.printed != null && row.calculated != null ? row.calculated - row.printed : null
  }));
}

/**
 * Check whether a printed grade agrees with the printed mark for a subject.
 *
 * @param {number} marks
 * @param {string|null} grade
 * @param {number|null} max
 * @returns {boolean|null}
 */
export function gradeAgrees(marks, grade, max) {
  if (!grade || !Number.isFinite(marks) || !max) return null;
  const expected = gradeForMarks(marks, max);
  if (!expected) return null;
  return expected === grade;
}
