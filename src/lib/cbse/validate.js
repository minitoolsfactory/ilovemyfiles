/**
 * Validation and data-quality checks for a parsed CBSE gazette.
 *
 * The goal is to surface anything that a reader should confirm before a
 * figure is published: count mismatches against the printed summary,
 * duplicate roll numbers, missing or impossible marks, misaligned columns and
 * printed grades that disagree with the printed mark.
 */

import { RESULT_STATUS } from './subjects.js';
import { compareWithPrintedSummary, gradeAgrees, round } from './analytics.js';
import { analyseGradeBasis } from './grade-basis.js';

/**
 * @typedef {Object} Check
 * @property {string} id
 * @property {string} label
 * @property {'pass'|'warn'|'fail'|'info'} status
 * @property {string} detail
 * @property {number} [count]
 */

/**
 * Run every validation check for a dataset.
 *
 * @param {Object} dataset parsed dataset with `subjectTable` applied
 * @param {Object} analytics
 * @returns {{ checks: Check[], needsReview: number, reviewRecords: Object[] }}
 */
export function validateDataset(dataset, analytics) {
  const checks = [];
  const candidates = dataset.candidates ?? [];
  const subjectTable = dataset.subjectTable ?? [];

  // 1. Agreement with the printed summary of the gazette.
  const comparison = compareWithPrintedSummary(dataset, analytics);
  for (const row of comparison) {
    if (row.printed == null) {
      checks.push({
        id: `summary-${row.key}`,
        label: row.label,
        status: 'info',
        detail: 'The gazette does not print this total, so it could not be compared.'
      });
      continue;
    }
    checks.push({
      id: `summary-${row.key}`,
      label: row.label,
      status: row.match ? 'pass' : 'fail',
      count: row.difference ?? 0,
      detail: row.match
        ? `Matches the printed summary (${row.printed}).`
        : `Printed summary says ${row.printed}, the parsed records give ${row.calculated} (difference ${row.difference > 0 ? '+' : ''}${row.difference}).`
    });
  }

  // 2. Duplicate roll numbers.
  const rollIndex = new Map();
  for (const candidate of candidates) {
    if (!candidate.rollNo) continue;
    rollIndex.set(candidate.rollNo, (rollIndex.get(candidate.rollNo) ?? 0) + 1);
  }
  const duplicates = [...rollIndex.entries()].filter(([, count]) => count > 1);
  checks.push({
    id: 'duplicate-rolls',
    label: 'Duplicate roll numbers',
    status: duplicates.length ? 'fail' : 'pass',
    count: duplicates.length,
    detail: duplicates.length
      ? `${duplicates.length} roll number(s) appear more than once: ${duplicates.slice(0, 6).map(([roll]) => roll).join(', ')}.`
      : 'Every roll number appears once.'
  });

  // 3. Record count against the printed candidate count.
  if (!dataset.printedSummary?.totalCandidates) {
    checks.push({
      id: 'record-count',
      label: 'Record count',
      status: 'info',
      detail: 'The gazette does not print a candidate total to compare against.'
    });
  }

  // 4. Subject coverage per record.
  const expectedSubjects = dataset.subjectOrder?.length ?? 0;
  let shortRecords = 0;
  let longRecords = 0;
  for (const candidate of candidates) {
    const filled = candidate.subjects.filter(subject => subject.code).length;
    if (!filled) continue;
    if (expectedSubjects && filled < expectedSubjects) shortRecords += 1;
    if (expectedSubjects && filled > expectedSubjects) longRecords += 1;
  }
  checks.push({
    id: 'subject-count',
    label: 'Subject count per record',
    status: shortRecords || longRecords ? 'warn' : 'pass',
    count: shortRecords + longRecords,
    detail: shortRecords || longRecords
      ? `${shortRecords} record(s) carry fewer subject codes than the usual ${expectedSubjects} and ${longRecords} carry more. These are usually candidates who were not offered one of the optional subjects.`
      : `Every record carries ${expectedSubjects} subject codes.`
  });

  // 5. Missing and non-numeric marks.
  let missingMarks = 0;
  let invalidMarks = 0;
  let absentWithMarks = 0;
  for (const candidate of candidates) {
    if (candidate.status === RESULT_STATUS.ABSENT) {
      if (candidate.subjects.some(subject => subject.marks.value !== null)) absentWithMarks += 1;
      continue;
    }
    for (const subject of candidate.subjects) {
      if (!subject.code) continue;
      if (subject.marks.value === null) {
        if (subject.marks.raw) invalidMarks += 1;
        else missingMarks += 1;
      }
    }
  }
  // A gazette that prints the grades without the marks is not broken, so it
  // is reported as what it is instead of as a pile of missing marks.
  const gradedCells = dataset.candidates.reduce((sum, candidate) => sum
    + candidate.subjects.filter(subject => subject.code && subject.grade.value).length, 0);
  const markedCells = dataset.candidates.reduce((sum, candidate) => sum
    + candidate.subjects.filter(subject => subject.code && subject.marks.value !== null).length, 0);
  const gradesOnly = markedCells === 0 && gradedCells > 0;
  checks.push({
    id: 'missing-marks',
    label: 'Missing or unreadable marks',
    status: gradesOnly ? 'info' : (missingMarks + invalidMarks ? 'warn' : 'pass'),
    count: gradesOnly ? 0 : missingMarks + invalidMarks,
    detail: gradesOnly
      ? `This gazette prints the subject grades without the marks (${gradedCells} grade(s), no mark), so the averages, the totals and the percentages are not available. The grades are reported as printed.`
      : missingMarks + invalidMarks
        ? `${missingMarks} subject cell(s) are blank and ${invalidMarks} could not be read as a number. Averages exclude them.`
        : 'Every printed subject cell holds a readable mark.'
  });
  checks.push({
    id: 'absent-with-marks',
    label: 'Absent candidates with marks',
    status: absentWithMarks ? 'warn' : 'pass',
    count: absentWithMarks,
    detail: absentWithMarks
      ? `${absentWithMarks} absent candidate(s) also carry marks. Confirm the printed status before publishing.`
      : 'Absent candidates do not carry marks.'
  });

  // 6. Marks outside the effective maximum.
  const outOfRange = [];
  for (const candidate of candidates) {
    for (const subject of candidate.subjects) {
      if (!subject.code || subject.marks.value === null) continue;
      const entry = subjectTable.find(item => item.code === subject.code);
      if (!entry?.max) continue;
      if (subject.marks.value > entry.max) {
        outOfRange.push({ recordId: candidate.recordId, code: subject.code, marks: subject.marks.value, max: entry.max });
      }
    }
  }
  checks.push({
    id: 'marks-range',
    label: 'Marks within the subject maximum',
    status: outOfRange.length ? 'fail' : 'pass',
    count: outOfRange.length,
    detail: outOfRange.length
      ? `${outOfRange.length} mark(s) exceed the maximum in force for their subject. The maximum used is listed against each subject.`
      : 'Every mark is within the maximum in force for its subject.'
  });

  // 6b. A mark that is above every scale CBSE uses is not a mark at all.
  const implausible = [];
  for (const candidate of candidates) {
    for (const subject of candidate.subjects) {
      if (!subject.code || subject.marks.value === null) continue;
      if (subject.marks.value > 100) {
        implausible.push({ recordId: candidate.recordId, code: subject.code, marks: subject.marks.value });
      }
    }
  }
  checks.push({
    id: 'marks-implausible',
    label: 'Marks that are above any CBSE subject scale',
    status: implausible.length ? 'fail' : 'pass',
    count: implausible.length,
    detail: implausible.length
      ? `${implausible.length} mark(s) are above 100, which is the largest scale any CBSE subject uses. Check the scan and the column alignment for these records.`
      : 'No mark is above the largest scale a CBSE subject can use.'
  });

  // 6c. A subject whose scale could not be established.
  const unknownScale = subjectTable.filter(entry => entry.maxSource === 'unknown');
  checks.push({
    id: 'subject-scale',
    label: 'Subject scale could be established',
    status: unknownScale.length ? 'warn' : 'pass',
    count: unknownScale.length,
    detail: unknownScale.length
      ? `The scale of ${unknownScale.length} subject(s) could not be established from the printed marks. Set the maximum in the review step to finish the report.`
      : 'Every subject uses a verified or a recognised scale.'
  });

  // 7. Printed grade against the printed mark.
  //
  // A gazette does not have to say which quantity the grade was awarded on:
  // the printed mark can be a theory mark, a theory mark plus internal
  // assessment, or a mark on a combined scale. The grading basis is therefore
  // measured first, and the printed grades are only compared with a mark when
  // the printed grades of that subject are known to follow a CBSE table.
  const basis = analyseGradeBasis(dataset);
  const printedGrades = candidates.reduce((total, candidate) => total + candidate.subjects.filter(subject => subject.code && subject.marks.value !== null && subject.grade.value).length, 0);
  const establishedCodes = new Map(basis.subjects.filter(entry => entry.established).map(entry => [entry.code, entry.max]));

  let gradeChecked = 0;
  let gradeAgree = 0;
  const gradeExamples = [];
  for (const candidate of candidates) {
    for (const subject of candidate.subjects) {
      if (!subject.code || subject.marks.value === null || !subject.grade.value) continue;
      if (!establishedCodes.has(subject.code)) continue;
      const agrees = gradeAgrees(subject.marks.value, subject.grade.value, establishedCodes.get(subject.code));
      if (agrees == null) continue;
      gradeChecked += 1;
      if (agrees) gradeAgree += 1;
      else if (gradeExamples.length < 5) {
        gradeExamples.push(`${subject.code}: ${subject.marks.value} printed as ${subject.grade.value}`);
      }
    }
  }
  const gradeRate = gradeChecked ? round((gradeAgree / gradeChecked) * 100) : null;
  const undisclosedSubjects = basis.subjects.filter(entry => !entry.established);

  let gradeStatus = 'info';
  let gradeDetail = 'No printed grades were available to check.';
  if (printedGrades === 0) {
    gradeStatus = 'info';
    gradeDetail = 'No printed grades were available to check.';
  } else if (basis.established === 0) {
    gradeStatus = 'warn';
    gradeDetail = `The gazette prints ${printedGrades} grade(s), but they do not follow any of the known CBSE grade tables. The grading basis is not disclosed by the file, so the grades are reported as printed and were not checked. A grade is never used to derive a result.`;
  } else {
    gradeStatus = gradeRate >= 95 ? 'pass' : (gradeRate >= 70 ? 'warn' : 'fail');
    gradeDetail = `${gradeAgree} of ${gradeChecked} printed grades (${gradeRate}%) match the CBSE grade boundaries of the ${basis.subjects.filter(entry => entry.established).map(entry => entry.code).join(', ')} subject(s), whose grading basis is known. ${gradeExamples.length ? `Examples: ${gradeExamples.join('; ')}.` : ''} Grades are reported as printed and are never used to derive a result.`;
  }
  checks.push({
    id: 'grade-marks',
    label: 'Printed grade agrees with the printed mark',
    status: gradeStatus,
    count: gradeChecked - gradeAgree,
    detail: gradeDetail
  });

  // 7b. Whether the grading basis of the file could be established at all.
  checks.push({
    id: 'grade-basis',
    label: 'Grading basis could be established',
    status: basis.subjects.length === 0 ? 'info' : (basis.undisclosed === 0 ? 'pass' : 'warn'),
    count: basis.undisclosed,
    detail: basis.subjects.length === 0
      ? 'The gazette prints no grades, so there is no grading basis to establish.'
      : basis.undisclosed === 0
        ? `The printed grades of all ${basis.established} subject(s) follow a known CBSE grade table.`
        : `The printed grades of ${basis.established} of ${basis.subjects.length} subject(s) follow a known CBSE grade table. For the other ${basis.undisclosed} subject(s) (${undisclosedSubjects.map(entry => entry.code).join(', ')}) the grading basis is not disclosed by the file, so those grades are reported as printed and were not checked.`
  });

  // 8. Subject ordering.
  const orderVariants = new Set();
  const reference = dataset.subjectOrder ?? [];
  for (const candidate of candidates) {
    const codes = candidate.subjects.map(subject => subject.code).filter(Boolean);
    if (reference.length && codes.length === reference.length && codes.join('|') !== reference.join('|')) {
      orderVariants.add(codes.join('|'));
    }
  }
  checks.push({
    id: 'subject-order',
    label: 'Subject ordering',
    status: orderVariants.size ? 'info' : 'pass',
    count: orderVariants.size,
    detail: orderVariants.size
      ? `${orderVariants.size} different subject order(s) were found. Each record keeps its own printed order, so nothing is realigned.`
      : 'Every record uses the same subject order.'
  });

  // 9. Result status readability and compartment consistency.
  const unreadableStatus = candidates.filter(candidate => !candidate.statusPrinted).length;
  const compartmentWithoutSubject = candidates.filter(candidate =>
    candidate.status === RESULT_STATUS.COMPARTMENT && !candidate.compartmentSubjects.length).length;
  const compartmentWithMismatch = candidates.filter(candidate =>
    candidate.status !== RESULT_STATUS.COMPARTMENT && candidate.compartmentSubjects.length).length;
  checks.push({
    id: 'result-status',
    label: 'Result status read from the gazette',
    status: unreadableStatus ? 'fail' : 'pass',
    count: unreadableStatus,
    detail: unreadableStatus
      ? `${unreadableStatus} record(s) carry no readable result status and are counted as "other".`
      : 'Every record carries a printed result status.'
  });
  checks.push({
    id: 'compartment-subjects',
    label: 'Compartment subject codes',
    status: compartmentWithoutSubject || compartmentWithMismatch ? 'warn' : 'pass',
    count: compartmentWithoutSubject + compartmentWithMismatch,
    detail: compartmentWithoutSubject || compartmentWithMismatch
      ? `${compartmentWithoutSubject} compartment record(s) print no subject code and ${compartmentWithMismatch} non-compartment record(s) do.`
      : 'Compartment records print a matching subject code.'
  });

  // 10. Unmapped subject codes.
  const unmapped = subjectTable.filter(entry => !entry.verified);
  checks.push({
    id: 'subject-names',
    label: 'Subject codes mapped to official names',
    status: unmapped.length ? 'warn' : 'pass',
    count: unmapped.length,
    detail: unmapped.length
      ? `${unmapped.length} subject code(s) are not in the verified list and are shown as "Subject <code>". Map them in the review step to label them.`
      : 'Every subject code maps to a verified official name.'
  });

  // 11. Extraction confidence.
  const meanConfidence = analytics?.confidence?.mean ?? null;
  const meanConfidencePercent = meanConfidence == null ? null : Math.round(meanConfidence * 100);
  checks.push({
    id: 'extraction-confidence',
    label: 'Extraction confidence',
    status: meanConfidence == null ? 'info' : (meanConfidence >= 0.95 ? 'pass' : (meanConfidence >= 0.8 ? 'warn' : 'fail')),
    count: analytics?.confidence?.needsReview ?? 0,
    detail: meanConfidence == null
      ? 'No records were parsed.'
      : `Mean extraction confidence is ${meanConfidencePercent}%. ${analytics?.confidence?.needsReview ?? 0} record(s) are flagged for review.`
  });

  const reviewRecords = candidates
    .filter(candidate => (candidate.warnings?.length ?? 0) > 0 || (candidate.confidence ?? 1) < 0.85)
    .map(candidate => ({
      recordId: candidate.recordId,
      rollNo: candidate.rollNo,
      name: candidate.name,
      status: candidate.status,
      confidence: candidate.confidence,
      warnings: candidate.warnings ?? []
    }));

  return {
    checks,
    needsReview: reviewRecords.length,
    reviewRecords
  };
}

/**
 * Human readable labels for the validation codes.
 *
 * @param {string} code
 * @returns {string}
 */
export function checkLabel(code) {
  const map = {
    'name-unread': 'The candidate name could not be read.',
    'status-unread': 'No readable result status was found.',
    'result-status-unread': 'No readable result status was found.',
    'marks-unread': 'No marks were found for this record.',
    'absent-with-marks': 'An absent candidate carries marks.',
    'subject-count-low': 'Fewer subject codes were found than expected.',
    'marks-count-mismatch': 'The number of mark values does not match the number of subject codes.',
    'subject-code-unread': 'A subject code could not be read.',
    'marks-not-numeric': 'A mark could not be read as a number.'
  };
  return map[code] ?? code;
}
