/**
 * Manual corrections made by the reviewer.
 *
 * A correction is kept apart from the printed value. The printed status stays
 * in `statusRaw` and the record is marked with the source of the status, so a
 * corrected record is never presented as a printed one.
 */

/**
 * @typedef {Object} Correction
 * @property {string} [name]
 * @property {string} [status] canonical status key
 * @property {string} [rollNo]
 * @property {string} [statusRaw] the text the reviewer typed
 */

/**
 * Apply the corrections to a dataset and return a new dataset.
 *
 * @param {Object} dataset
 * @param {Record<string, Correction>} corrections
 * @returns {Object}
 */
export function applyCorrections(dataset, corrections = {}) {
  if (!dataset || !Object.keys(corrections).length) return dataset;
  const candidates = dataset.candidates.map(candidate => {
    const correction = corrections[candidate.recordId];
    if (!correction) return candidate;
    const next = { ...candidate, subjects: candidate.subjects, warnings: [...(candidate.warnings ?? [])] };
    if (typeof correction.name === 'string' && correction.name.trim() && correction.name.trim() !== candidate.name) {
      next.name = correction.name.trim();
      next.warnings = next.warnings.filter(warning => warning !== 'name-unread');
    }
    if (typeof correction.rollNo === 'string' && correction.rollNo.trim() && correction.rollNo.trim() !== candidate.rollNo) {
      next.rollNo = correction.rollNo.trim();
      next.rollNoRaw = candidate.rollNoRaw;
    }
    if (typeof correction.status === 'string' && correction.status && correction.status !== candidate.status) {
      next.status = correction.status;
      next.statusSource = 'corrected';
      next.statusPrinted = true;
      // The printed text is never overwritten, it stays in `statusRaw`.
      next.correctedStatus = correction.status;
      next.warnings = next.warnings.filter(warning => warning !== 'result-status-unread');
    }
    next.confidence = Math.max(next.confidence ?? 0, 0.9);
    return next;
  });
  return { ...dataset, candidates };
}

/**
 * Count the corrections that were made.
 *
 * @param {Record<string, Correction>} corrections
 * @returns {number}
 */
export function countCorrections(corrections = {}) {
  return Object.keys(corrections).length;
}
