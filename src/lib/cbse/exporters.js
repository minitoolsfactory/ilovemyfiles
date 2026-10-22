/**
 * Export builders for the CBSE Result Analyzer.
 *
 * Every export carries the source file name, the import date, the definition
 * of each percentage and any data-quality warning, so a downloaded figure can
 * always be traced back to the gazette it came from. Exports follow the
 * filters that are active on screen, and identifiable student data is only
 * written when the reviewer asks for them with the "include the candidate
 * names and roll numbers" switch in the export panel.
 */

/**
 * Escape a value for a CSV cell.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * Build a CSV document from a header row and body rows.
 *
 * @param {string[]} header
 * @param {Array<Array<unknown>>} rows
 * @returns {string}
 */
export function buildCsv(header, rows) {
  const lines = [header.map(csvCell).join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  return lines.join('\r\n') + '\r\n';
}

/**
 * Build the aggregate rows that appear in every export.
 *
 * @param {Object} analytics
 * @param {Object} dataset
 * @param {Object[]} checks
 * @param {Object} options
 * @returns {Object}
 */
export function buildExportModel(analytics, dataset, checks, options = {}) {
  const meta = dataset.meta ?? {};
  const candidates = options.candidates ?? dataset.candidates ?? [];

  const summaryRows = [
    ['Board', meta.board || 'Not printed'],
    ['Examination', meta.examName || 'Not printed'],
    ['Year', meta.year ?? 'Not printed'],
    ['Class', meta.class || 'Not printed'],
    ['Session', meta.session || 'Not printed'],
    ['Region', meta.region || 'Not printed'],
    ['School code', meta.schoolCode || 'Not printed'],
    ['School name', meta.schoolName || 'Not printed'],
    ['Gazette date', meta.gazetteDate || 'Not printed'],
    ['Source file', meta.sourceFileName || 'Not printed'],
    ['Imported at', meta.importedAt || 'Not printed'],
    ['Layout used', meta.layout || 'unknown'],
    ['Total candidates', analytics.totals.candidates],
    ['Passed', analytics.totals.passed],
    ['Compartment', analytics.totals.compartment],
    ['Essential repeat', analytics.totals.essentialRepeat],
    ['Absent', analytics.totals.absent],
    ['Other / unknown', analytics.totals.other],
    ['Appeared candidates', analytics.totals.appeared],
    ['Pass percentage (of appeared)', analytics.totals.passPercentage == null ? 'Not available' : `${analytics.totals.passPercentage}%`],
    ['Pass percentage (of all candidates)', analytics.totals.passPercentageOfAll == null ? 'Not available' : `${analytics.totals.passPercentageOfAll}%`],
    ['Records corrected by hand', options.corrections ?? 0],
    ...(analytics.genderBreakdown ?? []).flatMap(entry => [
      [`${entry.label} - candidates`, entry.candidates],
      [`${entry.label} - passed`, entry.passed],
      [`${entry.label} - appeared`, entry.appeared],
      [`${entry.label} - pass %`, entry.passPercentage == null ? 'Not available' : `${entry.passPercentage}%`]
    ])
  ];

  const subjectRows = analytics.subjects.map(subject => [
    subject.code,
    subject.name,
    subject.max ?? 'Unknown',
    subject.occurrences,
    subject.valid,
    subject.average ?? '',
    subject.median ?? '',
    subject.minimum ?? '',
    subject.maximum ?? '',
    subject.stdDev ?? '',
    subject.averagePercent == null ? '' : `${subject.averagePercent}%`
  ]);

  // Every subject code of the gazette gets its own column, so a spreadsheet
  // can pivot the table. A candidate who was not offered a subject gets a dash.
  const subjectCodes = analytics.subjectCodes ?? [];
  const subjectNames = new Map((analytics.subjects ?? []).map(subject => [subject.code, subject.name]));

  const candidateRows = candidates.map((candidate, index) => {
    const identity = { roll: candidate.rollNo, name: candidate.name };
    const byCode = new Map((candidate.subjects ?? []).map(subject => [subject.code, subject]));
    const cells = subjectCodes.map(code => {
      const subject = byCode.get(code);
      if (!subject) return '-';
      if (subject.marks.value == null) return subject.marks.raw || subject.grade.value || '-';
      // The mark on the left, the printed grade on the right.
      return subject.grade.value ? `${subject.marks.value} ${subject.grade.value}` : String(subject.marks.value);
    });
    const score = aggregateScore(candidate, analytics.subjects ?? []);
    return [
      identity.roll,
      identity.name,
      genderLabel(candidate.gender),
      candidate.status,
      score.total ?? '',
      score.available ?? '',
      score.percent == null ? '' : `${score.percent}%`,
      ...cells
    ];
  });

  const checkRows = checks.map(check => [check.status.toUpperCase(), check.label, check.detail]);

  const topRows = (analytics.topPerformers ?? []).map((entry, index) => {
    const identity = { roll: entry.rollNo, name: entry.name };
    const byCode = new Map((entry.subjects ?? []).map(subject => [subject.code, subject]));
    const cells = subjectCodes.map(code => {
      const subject = byCode.get(code);
      if (!subject) return '-';
      if (subject.marks == null) return subject.marksRaw || subject.grade || '-';
      return subject.grade ? `${subject.marks} ${subject.grade}` : String(subject.marks);
    });
    return [
      entry.rank,
      identity.roll,
      identity.name,
      genderLabel(entry.gender),
      entry.status,
      entry.total ?? '',
      entry.available ?? '',
      entry.percent == null ? '' : `${entry.percent}%`,
      ...cells
    ];
  });

  const bandRows = (analytics.scoreDistribution ?? []).map(band => [band.label, band.min, band.max, band.count]);
  const markBandRows = (analytics.markBandDistribution ?? []).map(band => [band.label, band.min, band.max, band.count]);

  const printedRows = (dataset.printedSummary
    ? Object.entries(dataset.printedSummary).map(([key, value]) => [key, value])
    : []);

  const subjectHeaders = subjectCodes.map(code => {
    const name = subjectNames.get(code);
    return name && name !== `Subject ${code}` ? `${code} (${name})` : code;
  });

  return {
    meta, summaryRows, subjectRows, candidateRows, checkRows, printedRows, bandRows, markBandRows,
    topRows, subjectHeaders
  };
}

/**
 * Build the CSV bundle for the analyzer.
 *
 * @param {Object} model
 * @returns {Object} map of file name to CSV text
 */
export function buildCsvBundle(model) {
  const bundle = {};
  bundle['summary.csv'] = buildCsv(['Field', 'Value'], model.summaryRows);
  bundle['subjects.csv'] = buildCsv(
    ['Subject code', 'Subject name', 'Maximum used', 'Records', 'Students', 'Average', 'Median', 'Lowest', 'Highest', 'Std deviation', 'Average %'],
    model.subjectRows
  );
  bundle['candidates.csv'] = buildCsv(
    ['Roll number', 'Candidate name', 'Gender', 'Result status', 'Total marks', 'Marks available', 'Percentage', ...model.subjectHeaders],
    model.candidateRows
  );
  bundle['top-candidates.csv'] = buildCsv(
    ['Rank', 'Roll number', 'Candidate name', 'Gender', 'Result status', 'Total marks', 'Marks available', 'Percentage', ...model.subjectHeaders],
    model.topRows ?? []
  );
  bundle['score-bands.csv'] = buildCsv(
    ['Score band', 'From %', 'To %', 'Candidates by total score', 'Subject marks in the band'],
    (model.bandRows ?? []).map((row, index) => [...row, model.markBandRows?.[index]?.[3] ?? ''])
  );
  if (model.printedRows.length) {
    bundle['printed-summary.csv'] = buildCsv(['Printed field', 'Printed value'], model.printedRows);
  }
  return bundle;
}

/**
 * Readable labels for the field names that appear in the report.
 */
const REPORT_LABELS = {
  totalCandidates: 'Total candidates',
  totalPass: 'Total pass',
  compartment: 'Compartment',
  essentialRepeat: 'Essential repeat',
  absent: 'Absent',
  appeared: 'Appeared candidates',
  passPercentage: 'Pass percentage (of appeared)',
  passPercentageOfAll: 'Pass percentage (of all candidates)',
  averages: 'Averages',
  status: 'Result status',
  topPerformers: 'Top candidates'
};

/**
 * The gender printed in the gazette, as a short label.
 *
 * @param {string} gender
 * @returns {string}
 */
function genderLabel(gender) {
  const value = String(gender ?? '').trim().toUpperCase();
  if (value === 'F') return 'F';
  if (value === 'M') return 'M';
  return '-';
}

/**
 * Break a text into the lines that fit a width.
 *
 * A word that is wider than the column is broken over several lines. Nothing
 * is ever dropped: the lines together always carry the whole text.
 *
 * @param {string} text
 * @param {(value: string) => number} measure the width of a string
 * @param {number} maxWidth
 * @returns {string[]}
 */
export function wrapTextLines(text, measure, maxWidth) {
  const value = String(text ?? '');
  if (!value) return [''];
  if (measure(value) <= maxWidth) return [value];
  const lines = [];
  let line = '';
  for (const word of value.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) {
      lines.push(line);
      line = '';
    }
    if (measure(word) <= maxWidth) {
      line = word;
      continue;
    }
    let rest = word;
    while (rest.length) {
      let cut = rest;
      while (cut.length > 1 && measure(cut) > maxWidth) cut = cut.slice(0, -1);
      if (cut === rest) {
        lines.push(rest);
        rest = '';
        break;
      }
      lines.push(cut);
      rest = rest.slice(cut.length);
    }
    line = '';
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Words that stay lowercase inside a name.
 */
const SMALL_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with'
]);

/**
 * Codes that stay in capitals.
 */
const KEEP_UPPER = new Set(['cbse', 'nccd', 'iit', 'jntu', 'nda', 'ncte']);

/**
 * Write a printed name the way a reader expects to see it.
 *
 * A gazette prints its examination and school names in capitals. The report
 * shows them in a readable case instead, while the original value is kept in
 * the dataset. A short code such as ND or S is left as it is printed.
 *
 * @param {string} value
 * @returns {string}
 */
export function titleCaseName(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  let firstWord = true;
  return text.split(/(\s+)/).map(part => {
    if (!part.trim()) return part;
    const match = /^([([{]*)(\S+)([)\]}]*)$/.exec(part);
    if (!match) return part;
    const [, open, core, close] = match;
    const lower = core.toLowerCase();
    const letters = lower.replace(/[^a-z0-9]/g, '');
    if (KEEP_UPPER.has(letters)) return open + core.toUpperCase() + close;
    // A bracketed word, such as the session (MAIN), starts a new phrase.
    const startsPhrase = firstWord || Boolean(open);
    if (!startsPhrase && SMALL_WORDS.has(letters)) {
      firstWord = false;
      return open + lower + close;
    }
    if (letters.length <= 2) {
      // A short code such as ND, S or MC is kept as it is printed.
      return open + core.toUpperCase() + close;
    }
    firstWord = false;
    const pieces = lower.split('-').map(piece => {
      if (!startsPhrase && SMALL_WORDS.has(piece)) return piece;
      return piece.charAt(0).toUpperCase() + piece.slice(1);
    });
    return open + pieces.join('-') + close;
  }).join('');
}

/**
 * The headline figures of a gazette.
 *
 * Only the figures that carry information are listed: a gazette without
 * compartment, absent or unmapped candidates does not show empty tiles, and
 * the appeared candidates are left out when they are the total candidates.
 * The split of the class by gender is part of the headline.
 *
 * @param {Object} analytics
 * @returns {Array<{ label: string, value: number|string, note: string }>}
 */
export function buildHeadlineTiles(analytics) {
  const totals = analytics?.totals ?? {};
  const tiles = [];
  const add = (label, value, note) => {
    if (value === null || value === undefined) return;
    tiles.push({ label, value, note });
  };

  add('Total candidates', totals.candidates, 'Records read from the gazette');
  add('Passed', totals.passed, 'Printed PASS status');
  add('Pass percentage', totals.passPercentage == null ? 'Not available' : `${totals.passPercentage}%`, 'Passed divided by appeared');
  for (const group of analytics?.genderBreakdown ?? []) {
    if (group.key === '?' || !group.candidates) continue;
    add(group.label, group.candidates, `Candidates printed as ${group.label.toLowerCase()}`);
  }
  if (totals.compartment) add('Compartment', totals.compartment, 'Printed COMP status');
  if (totals.essentialRepeat) add('Essential repeat', totals.essentialRepeat, 'Printed essential repeat status');
  if (totals.absent) add('Absent', totals.absent, 'Printed ABST status');
  if (totals.other) add('Other / unknown', totals.other, 'Status that could not be mapped');
  if (totals.appeared != null && totals.appeared !== totals.candidates) {
    add('Appeared candidates', totals.appeared, 'Total candidates minus absent');
  }
  if (totals.absent && totals.passPercentageOfAll != null) {
    add('Pass percentage of all', `${totals.passPercentageOfAll}%`, 'Passed divided by all the candidates');
  }
  return tiles;
}

/**
 * Build the sections of the report.
 *
 * The PDF and the on screen preview are built from the same sections, so what
 * the reader approves on screen is exactly what lands in the file.
 *
 * @param {Object} analytics
 * @param {Object} dataset
 * @param {Object[]} checks
 * @returns {Object[]}
 */
export function buildReportSections(analytics, dataset, checks, options = {}) {
  // The data quality checks and the definitions are kept in the code and in
  // the data exports, but they are not part of the printed report.
  const includeChecks = options.includeChecks === true;
  const includeDefinitions = options.includeDefinitions === true;
  const meta = dataset.meta ?? {};
  const totals = analytics.totals;
  const sections = [];

  sections.push({
    type: 'meta',
    title: 'Gazette details',
    rows: [
      ['Board', meta.board || 'Not printed'],
      ['Examination', titleCaseName(meta.examName) || 'Not printed'],
      ['Year', meta.year ?? 'Not printed'],
      ['Class', meta.class || 'Not printed'],
      ['Session', titleCaseName(meta.session) || 'Not printed'],
      ['Region', titleCaseName(meta.region) || 'Not printed'],
      ['School code', meta.schoolCode || 'Not printed'],
      ['School name', titleCaseName(meta.schoolName) || 'Not printed'],
      ['Gazette date', meta.gazetteDate || 'Not printed']
    ]
  });

  sections.push({
    type: 'headline',
    title: 'Headline figures',
    items: buildHeadlineTiles(analytics).map(tile => ({ label: tile.label, value: tile.value }))
  });

  sections.push({
    type: 'table',
    title: 'Result status distribution',
    columns: ['Status', 'Candidates', 'Share of all candidates'],
    rows: analytics.statusDistribution.map(entry => [entry.label, entry.count, `${entry.share}%`])
  });

  // A gazette that prints the grades without the marks has no average to
  // show, so the grade distribution takes the place of the mark statistics.
  const hasMarks = analytics.subjects.some(subject => subject.valid > 0);
  const gradeCountsText = gradeCounts => Object.entries(gradeCounts ?? {})
    .map(([grade, count]) => `${grade}: ${count}`)
    .join(', ') || '-';
  sections.push({
    type: 'table',
    title: hasMarks ? 'Subject-wise performance' : 'Subject-wise grade distribution',
    columns: hasMarks
      ? ['Code', 'Subject', 'Max', 'Students', 'Average', 'Median', 'Lowest', 'Highest', 'Std dev', 'Average %']
      : ['Code', 'Subject', 'Max', 'Candidates', 'Grades printed'],
    rows: analytics.subjects.map(subject => (hasMarks
      ? [
          subject.code,
          subject.name,
          subject.max ?? 'Unknown',
          subject.valid,
          subject.average ?? '-',
          subject.median ?? '-',
          subject.minimum ?? '-',
          subject.maximum ?? '-',
          subject.stdDev ?? '-',
          subject.averagePercent == null ? '-' : `${subject.averagePercent}%`
        ]
      : [
          subject.code,
          subject.name,
          subject.max ?? 'Unknown',
          subject.occurrences,
          gradeCountsText(subject.gradeCounts)
        ])),
    note: hasMarks ? undefined : 'This gazette prints the grades without the marks, so there is no average to show.'
  });

  // The candidate records: the roll number, the name, the result and the mark
  // or the grade of every subject, so the report carries the people as well as
  // the figures.
  const candidateRows = (options.candidates ?? []).map(candidate => {
    const byCode = new Map((candidate.subjects ?? []).map(subject => [subject.code, subject]));
    const cells = (options.subjectCodes ?? []).map(code => {
      const subject = byCode.get(code);
      if (!subject) return '-';
      if (subject.marks.value == null) return subject.marks.raw || subject.grade.value || '-';
      return subject.grade.value ? `${subject.marks.value} ${subject.grade.value}` : String(subject.marks.value);
    });
    const score = aggregateScore(candidate, options.subjectTable ?? []);
    return [
      candidate.rollNo,
      candidate.name,
      genderLabel(candidate.gender),
      candidate.status,
      ...(options.hasMarks ? [score.total ?? '-', score.percent == null ? '-' : `${score.percent}%`] : []),
      ...cells
    ];
  });
  if (candidateRows.length) {
    sections.push({
      type: 'table',
      title: 'Candidate records',
      columns: [
        'Roll number',
        'Name',
        'Gender',
        'Result',
        ...(options.hasMarks ? ['Total', 'Percentage'] : []),
        ...(options.subjectCodes ?? [])
      ],
      rows: candidateRows,
      legend: (options.subjectCodes ?? []).map(code => ({
        code,
        name: options.subjectNames?.get?.(code) ?? ''
      })),
      landscape: true,
      note: 'A dash means the candidate was not offered that subject, or the gazette printed no mark for it. The mark is on the left of the grade.'
    });
  }

  if (dataset.printedSummary) {
    const calculated = {
      totalCandidates: totals.candidates,
      totalPass: totals.passed,
      compartment: totals.compartment,
      essentialRepeat: totals.essentialRepeat,
      absent: totals.absent
    };
    sections.push({
      type: 'table',
      title: 'Printed summary compared with the parsed records',
      columns: ['Figure', 'Printed in the gazette', 'Recalculated', 'Difference'],
      rows: Object.entries(dataset.printedSummary).map(([key, value]) => {
        const recalculated = calculated[key];
        const difference = recalculated != null && value != null ? recalculated - value : '';
        return [REPORT_LABELS[key] ?? key, value ?? '-', recalculated ?? '-', difference === '' ? '-' : difference];
      })
    });
  }

  if (includeChecks) {
    sections.push({
      type: 'checks',
      title: 'Data quality checks',
      items: checks.map(check => ({ status: check.status, label: check.label, detail: check.detail }))
    });
  }

  if (includeDefinitions) {
    sections.push({
      type: 'definitions',
      title: 'How each number is calculated',
      items: Object.entries(analytics.definitions).map(([label, value]) => ({
        label: REPORT_LABELS[label] ?? label,
        value
      }))
    });
  }

  return sections;
}

/**
 * The aggregate score of a candidate, used by the candidate sheet.
 *
 * @param {Object} candidate
 * @param {Object[]} subjectTable
 * @returns {{ total: number|null, available: number|null, percent: number|null }}
 */
function aggregateScore(candidate, subjectTable) {
  const maxByCode = new Map(subjectTable.map(entry => [entry.code, entry.max]));
  let total = 0;
  let available = 0;
  for (const subject of candidate.subjects ?? []) {
    if (!subject.code || subject.marks.value === null) continue;
    const max = maxByCode.get(subject.code);
    if (!max) continue;
    total += subject.marks.value;
    available += max;
  }
  return {
    total: available ? total : null,
    available: available || null,
    percent: available ? Math.round((total / available) * 10000) / 100 : null
  };
}

/**
 * Build a minimal SpreadsheetML workbook (.xlsx) from a set of sheets.
 *
 * @param {Array<{ name: string, header: string[], rows: Array<Array<unknown>> }>} sheets
 * @returns {Promise<Blob>}
 */
export async function buildXlsx(sheets) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  const escapeXml = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  const columnName = index => {
    let name = '';
    let value = index + 1;
    while (value > 0) {
      const remainder = (value - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      value = Math.floor((value - 1) / 26);
    }
    return name;
  };

  const sheetXml = sheet => {
    const rows = [sheet.header, ...sheet.rows];
    const body = rows.map((row, rowIndex) => {
      const cells = row.map((value, columnIndex) => {
        const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
        const isNumber = typeof value === 'number' && Number.isFinite(value);
        if (isNumber) return `<c r="${reference}"><v>${value}</v></c>`;
        return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
      }).join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
  };

  const sheetNames = sheets.map(sheet => escapeXml(sheet.name.slice(0, 31)));
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetNames.map((name, index) => `<sheet name="${name}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`;

  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rootRels);
  zip.file('xl/workbook.xml', workbook);
  zip.file('xl/_rels/workbook.xml.rels', workbookRels);
  zip.file('xl/styles.xml', styles);
  sheets.forEach((sheet, index) => zip.file(`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheet)));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/**
 * Build the sheets for the Excel workbook.
 *
 * @param {Object} model
 * @returns {Array<{ name: string, header: string[], rows: Array<Array<unknown>> }>}
 */
export function buildWorkbookSheets(model) {
  return [
    { name: 'Summary', header: ['Field', 'Value'], rows: model.summaryRows },
    {
      name: 'Subjects',
      header: ['Subject code', 'Subject name', 'Maximum used', 'Records', 'Students', 'Average', 'Median', 'Lowest', 'Highest', 'Std deviation', 'Average %'],
      rows: model.subjectRows
    },
    {
      name: 'Candidates',
      header: ['Roll number', 'Candidate name', 'Gender', 'Result status', 'Total marks', 'Marks available', 'Percentage', ...model.subjectHeaders],
      rows: model.candidateRows
    },
    {
      name: 'Top candidates',
      header: ['Rank', 'Roll number', 'Candidate name', 'Gender', 'Result status', 'Total marks', 'Marks available', 'Percentage', ...model.subjectHeaders],
      rows: model.topRows ?? []
    },
    {
      name: 'Score bands',
      header: ['Score band', 'From %', 'To %', 'Candidates by total score', 'Subject marks in the band'],
      rows: (model.bandRows ?? []).map((row, index) => [...row, model.markBandRows?.[index]?.[3] ?? ''])
    },
    { name: 'Printed summary', header: ['Printed field', 'Printed value'], rows: model.printedRows }
  ];
}

function drawBrandedPdfFooter(page, index, pageCount, title, font, color, margin) {
  const y = margin - 22;
  const size = 7.5;
  const iconScale = 0.055;
  const iconWidth = 100 * iconScale;
  const heartX = margin + font.widthOfTextAtSize('i', size) + 1.5;

  page.drawText('i', { x: margin, y, size, font, color });
  page.drawSvgPath(
    'M 50 15 C 35 0 0 0 0 25 C 0 45 50 75 50 75 C 50 75 100 45 100 25 C 100 0 65 0 50 15 Z',
    { x: heartX, y: y + 2, scale: iconScale, color }
  );
  page.drawText(`MyFiles. | ${title}`, {
    x: heartX + iconWidth + 2,
    y,
    size,
    font,
    color
  });

  const pageLabel = `Page ${index + 1} of ${pageCount}`;
  page.drawText(pageLabel, {
    x: page.getSize().width - margin - font.widthOfTextAtSize(pageLabel, size),
    y,
    size,
    font,
    color
  });
}

/**
 * Build a PDF summary report with pdf-lib.
 *
 * @param {Object} model
 * @param {Object} analytics
 * @param {Object} dataset
 * @returns {Promise<Blob>}
 */
export async function buildPdfReport(model, analytics, dataset, checks, options = {}) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  const portrait = { width: 595.28, height: 841.89 };
  const landscape = { width: 841.89, height: 595.28 };
  const margin = 42;
  let pageSize = portrait;
  let pageWidth = portrait.width;
  let pageHeight = portrait.height;
  let contentWidth = pageWidth - margin * 2;
  let page = document.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - margin;

  const ink = rgb(0.11, 0.13, 0.22);
  const muted = rgb(0.40, 0.43, 0.51);
  const accent = rgb(0.30, 0.29, 0.85);
  const line = rgb(0.88, 0.89, 0.93);
  const band = rgb(0.96, 0.96, 0.99);
  const zebra = rgb(0.985, 0.985, 0.995);
  const good = rgb(0.10, 0.50, 0.34);
  const warn = rgb(0.54, 0.35, 0);
  const bad = rgb(0.70, 0.15, 0.12);

  const newPage = (orientation = 'portrait') => {
    pageSize = orientation === 'landscape' ? landscape : portrait;
    pageWidth = pageSize.width;
    pageHeight = pageSize.height;
    contentWidth = pageWidth - margin * 2;
    page = document.addPage([pageWidth, pageHeight]);
    cursorY = pageHeight - margin;
  };

  const ensure = space => {
    if (cursorY - space < margin + 26) newPage();
  };

  const measure = (text, font, size) => font.widthOfTextAtSize(String(text ?? ''), size);

  /**
   * Break a text into the lines that fit a width.
   *
   * @param {string} text
   * @param {Object} font
   * @param {number} size
   * @param {number} maxWidth
   * @returns {string[]}
   */
  const wrapText = (text, font, size, maxWidth) => wrapTextLines(text, value => measure(value, font, size), maxWidth);

  /**
   * The width of every column: the widest cell, with the slack given to the
   * column that carries the most text.
   */
  const layoutColumns = (columns, rows, size = 8.5) => {
    const head = columns.map(label => measure(label, bold, size) + 12);
    const body = columns.map((_, index) => Math.max(
      ...rows.map(row => measure(String(row[index] ?? ''), regular, size)),
      0
    ) + 12);
    const natural = columns.map((_, index) => Math.max(head[index], body[index]));
    const total = natural.reduce((sum, value) => sum + value, 0);
    if (total <= contentWidth) {
      // A narrow table is only stretched a little, so a two column table keeps
      // its shape instead of drifting apart.
      const room = Math.min(contentWidth, total * 1.6);
      const factor = room / total;
      return natural.map(value => Math.floor(value * factor));
    }
    let widths = natural.map((value, index) => Math.max(head[index], Math.floor(value * (contentWidth / total))));
    let used = widths.reduce((sum, value) => sum + value, 0);
    let guard = 0;
    while (used > contentWidth && guard < 200) {
      // The narrow columns on the right shrink first, so the names and the
      // roll numbers keep their room.
      let target = -1;
      for (let index = widths.length - 1; index >= 0; index -= 1) {
        if (widths[index] > head[index] + 2) { target = index; break; }
      }
      if (target === -1) {
        target = widths.indexOf(Math.max(...widths));
        if (widths[target] <= head[target] + 2) break;
      }
      widths[target] -= 1;
      used -= 1;
      guard += 1;
    }
    return widths;
  };

  const isNumericColumn = (index, rows) => rows.length > 0 && rows.every(row => {
    const value = String(row[index] ?? '').trim();
    return value === '' || value === '-' || /^[\d.,%+-]+$/.test(value);
  });

  const drawText = (text, options = {}) => {
    const size = options.size ?? 10;
    const font = options.bold ? bold : regular;
    page.drawText(String(text ?? ''), {
      x: options.x ?? margin,
      y: options.y ?? cursorY,
      size,
      font,
      color: options.color ?? ink
    });
  };

  const drawHeading = (text, subtitle = '') => {
    ensure(58);
    cursorY -= 12;
    drawText(text, { y: cursorY, size: 13.5, bold: true, color: accent });
    cursorY -= 15;
    page.drawLine({ start: { x: margin, y: cursorY }, end: { x: pageWidth - margin, y: cursorY }, thickness: 1.1, color: accent });
    cursorY -= 13;
    if (subtitle) {
      const lines = wrapText(subtitle, regular, 8.5, contentWidth);
      for (const line of lines) {
        drawText(line, { y: cursorY, size: 8.5, color: muted });
        cursorY -= 11;
      }
      cursorY -= 3;
    }
  };

  /**
   * The type size of a table: a table with many columns gets a smaller size,
   * so the names and the roll numbers still fit in their columns.
   *
   * @param {string[]} columns
   * @returns {number}
   */
  const tableSize = columns => (columns.length > 10 ? 7 : 8.5);

  const drawTable = (columns, rows, note = '', orientation = 'portrait') => {
    if (!rows.length) {
      drawText('No rows.', { y: cursorY, size: 9, color: muted });
      cursorY -= 14;
      return;
    }
    // A table with many columns gets a smaller type size, so the names and the
    // roll numbers still fit in their columns.
    const size = tableSize(columns);
    const lineHeight = size + 2.5;
    const widths = layoutColumns(columns, rows, size);
    const numeric = columns.map((_, index) => isNumericColumn(index, rows));

    const drawHead = () => {
      const bandHeight = 17;
      page.drawRectangle({ x: margin, y: cursorY - 4, width: contentWidth, height: bandHeight, color: band });
      let x = margin;
      columns.forEach((label, index) => {
        const text = String(label);
        drawText(text, {
          x: numeric[index] ? x + widths[index] - 10 - measure(text, bold, size) : x,
          y: cursorY,
          size,
          bold: true,
          color: muted
        });
        x += widths[index];
      });
      cursorY -= bandHeight + 5;
    };

    ensure(70);
    drawHead();

    rows.forEach((row, rowIndex) => {
      const cells = row.map((cell, index) => wrapText(String(cell ?? ''), regular, size, widths[index] - 10));
      const lines = Math.max(...cells.map(entry => entry.length));
      const rowHeight = lines * lineHeight + 7;
      if (cursorY - rowHeight < margin + 26) {
        // The table continues on the next page: repeat the heading and keep
        // the orientation of the table.
        newPage(orientation);
        drawHead();
      }
      if (rowIndex % 2 === 1) {
        page.drawRectangle({ x: margin, y: cursorY - rowHeight + 12, width: contentWidth, height: rowHeight, color: zebra });
      }
      let cellX = margin;
      cells.forEach((cellLines, index) => {
        cellLines.forEach((line, lineIndex) => {
          const textX = numeric[index]
            ? cellX + widths[index] - 10 - measure(line, regular, size)
            : cellX;
          drawText(line, { x: textX, y: cursorY - lineIndex * lineHeight, size, color: ink });
        });
        cellX += widths[index];
      });
      cursorY -= rowHeight;
    });
    page.drawLine({ start: { x: margin, y: cursorY + 8 }, end: { x: pageWidth - margin, y: cursorY + 8 }, thickness: 0.6, color: line });
    cursorY -= 10;
    if (note) {
      ensure(18);
      for (const line of wrapText(note, regular, 7.5, contentWidth)) {
        drawText(line, { y: cursorY, size: 7.5, color: muted });
        cursorY -= 10;
      }
      cursorY -= 4;
    }
  };

  /**
   * Draw the subject code and name key of a table. It is written in the same
   * type as the marks of the table below it, so the key reads as part of the
   * same table.
   *
   * @param {Array<{ code: string, name: string }>} entries
   * @param {number} size
   */
  const drawLegend = (entries, size) => {
    if (!entries.length) return;
    const pairs = 2;
    const perColumn = Math.ceil(entries.length / pairs);
    const columnWidth = contentWidth / pairs;
    const codeWidth = 28;
    const lineHeight = size + 2.5;

    for (let row = 0; row < perColumn; row += 1) {
      ensure(lineHeight);
      for (let column = 0; column < pairs; column += 1) {
        const entry = entries[row + column * perColumn];
        if (!entry) continue;
        const x = margin + column * columnWidth;
        drawText(entry.code, { x, y: cursorY, size, color: ink });
        const name = wrapText(entry.name, regular, size, columnWidth - codeWidth - 8)[0] ?? '';
        drawText(name, { x: x + codeWidth, y: cursorY, size, color: ink });
      }
      cursorY -= lineHeight;
    }
    cursorY -= 4;
  };

  const drawKeyValues = (rows) => {
    const labelWidth = 118;
    ensure(rows.length * 14 + 12);
    for (const [label, value] of rows) {
      ensure(26);
      const valueLines = wrapText(String(value ?? ''), regular, 8.5, contentWidth - labelWidth - 8);
      const labelLines = wrapText(String(label ?? ''), bold, 8.5, labelWidth - 8);
      const lines = Math.max(valueLines.length, labelLines.length);
      labelLines.forEach((line, index) => drawText(line, { x: margin, y: cursorY - index * 11, size: 8.5, bold: true, color: muted }));
      valueLines.forEach((line, index) => drawText(line, { x: margin + labelWidth, y: cursorY - index * 11, size: 8.5, color: ink }));
      cursorY -= lines * 11 + 3;
    }
    cursorY -= 4;
  };

  const sections = buildReportSections(analytics, dataset, checks ?? [], {
    candidates: options.candidates ?? [],
    subjectCodes: options.subjectCodes ?? [],
    subjectNames: options.subjectNames ?? new Map((analytics.subjects ?? []).map(subject => [subject.code, subject.name])),
    subjectTable: options.subjectTable ?? [],
    hasMarks: analytics.subjects.some(subject => subject.valid > 0)
  });

  // The report cover block.
  ensure(120);
  drawText('CBSE Result Analysis Report', { y: cursorY, size: 17, bold: true, color: ink });
  cursorY -= 20;
  drawText(`${titleCaseName(model.meta.examName) || 'CBSE examination'}${model.meta.year ? `  ·  ${model.meta.year}` : ''}`, { y: cursorY, size: 10.5, color: muted });
  cursorY -= 14;
  drawText(`${titleCaseName(model.meta.schoolName) || 'School not printed'}${model.meta.schoolCode ? `  ·  code ${model.meta.schoolCode}` : ''}`, { y: cursorY, size: 10.5, color: muted });
  cursorY -= 14;
  const sourceLine = `Region ${titleCaseName(model.meta.region) || 'not printed'}   ·   Gazette date ${model.meta.gazetteDate || 'not printed'}`;
  for (const line of wrapText(sourceLine, regular, 8, contentWidth)) {
    drawText(line, { y: cursorY, size: 8, color: muted });
    cursorY -= 11;
  }
  page.drawLine({ start: { x: margin, y: cursorY }, end: { x: pageWidth - margin, y: cursorY }, thickness: 1, color: line });
  cursorY -= 6;

  for (const section of sections) {
    // A wide table is printed on a landscape page, so the names and the marks
    // of every subject have the room they need.
    if (section.landscape && pageSize !== landscape) newPage('landscape');
    else if (!section.landscape && pageSize === landscape && cursorY < pageHeight * 0.5) newPage('portrait');
    drawHeading(section.title);
    if (section.legend) {
      drawLegend(section.legend, section.type === 'table' ? tableSize(section.columns) : 8.5);
    }
    if (section.type === 'meta') {
      drawKeyValues(section.rows);
    } else if (section.type === 'headline') {
      const perRow = 4;
      const gap = 10;
      const tileWidth = (contentWidth - gap * (perRow - 1)) / perRow;
      for (let index = 0; index < section.items.length; index += perRow) {
        const row = section.items.slice(index, index + perRow);
        ensure(46);
        const rowTop = cursorY;
        row.forEach((item, column) => {
          const x = margin + column * (tileWidth + gap);
          page.drawRectangle({ x, y: rowTop - 30, width: tileWidth, height: 36, color: band });
          const value = String(item.value);
          drawText(value, { x: x + 8, y: rowTop - 12, size: 13, bold: true, color: ink });
          const labelLines = wrapText(String(item.label), regular, 7.5, tileWidth - 16);
          labelLines.slice(0, 2).forEach((line, lineIndex) => {
            drawText(line, { x: x + 8, y: rowTop - 23 - lineIndex * 9, size: 7.5, color: muted });
          });
        });
        cursorY = rowTop - 30 - 10;
      }
      cursorY -= 4;
    } else if (section.type === 'table') {
      drawTable(section.columns, section.rows, section.note, section.landscape ? 'landscape' : 'portrait');
    } else if (section.type === 'checks') {
      for (const item of section.items) {
        ensure(26);
        const color = item.status === 'PASS' ? good : item.status === 'FAIL' ? bad : item.status === 'WARN' ? warn : muted;
        drawText(item.status.toUpperCase(), { x: margin, y: cursorY, size: 8, bold: true, color });
        const lines = wrapText(`${item.label} - ${item.detail}`, regular, 8.5, contentWidth - 52);
        lines.forEach((line, index) => drawText(line, { x: margin + 52, y: cursorY - index * 11, size: 8.5, color: ink }));
        cursorY -= Math.max(1, lines.length) * 11 + 4;
      }
      cursorY -= 4;
    } else if (section.type === 'definitions') {
      for (const item of section.items) {
        ensure(26);
        const labelLines = wrapText(`${item.label}:`, bold, 8.5, 150);
        const valueLines = wrapText(item.value, regular, 8.5, contentWidth - 158);
        const lines = Math.max(labelLines.length, valueLines.length);
        labelLines.forEach((line, index) => drawText(line, { x: margin, y: cursorY - index * 11, size: 8.5, bold: true, color: muted }));
        valueLines.forEach((line, index) => drawText(line, { x: margin + 158, y: cursorY - index * 11, size: 8.5, color: ink }));
        cursorY -= lines * 11 + 3;
      }
      cursorY -= 4;
    }
  }

  const pageCount = document.getPageCount();
  document.getPages().forEach((each, index) => {
    const size = each.getSize();
    each.drawLine({
      start: { x: margin, y: margin - 10 },
      end: { x: size.width - margin, y: margin - 10 },
      thickness: 0.6,
      color: line
    });
    drawBrandedPdfFooter(each, index, pageCount, 'CBSE Result Analysis Report', regular, muted, margin);
  });

  const bytes = await document.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Build a plain result sheet with pdf-lib.
 *
 * It prints the candidate results only, one candidate per line, in the fixed
 * width layout of a printed text list: the roll number, the name, the gender
 * and the mark and the grade of every subject. The page is landscape so the
 * candidate results remain aligned in columns on a single row.
 *
 * @param {Object} model
 * @param {Object} analytics
 * @param {Object} dataset
 * @param {Object[]} checks
 * @param {Object} options
 * @returns {Promise<Blob>}
 */
export async function buildResultSheetPdf(model, analytics, dataset, checks, options = {}) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const mono = await document.embedFont(StandardFonts.Courier);
  const monoBold = await document.embedFont(StandardFonts.CourierBold);

  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 34;
  const contentWidth = pageWidth - margin * 2;
  const size = 7;
  const lineHeight = 9.5;

  const ink = rgb(0.11, 0.13, 0.22);
  const muted = rgb(0.40, 0.43, 0.51);
  const accent = rgb(0.30, 0.29, 0.85);
  const line = rgb(0.88, 0.89, 0.93);

  const candidates = options.candidates ?? dataset.candidates ?? [];
  const subjectCodes = options.subjectCodes ?? [];
  const subjectTable = options.subjectTable ?? [];
  const hasMarks = options.hasMarks ?? subjectTable.some(subject => subject.valid > 0);
  const meta = dataset.meta ?? {};

  let page = document.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - margin;

  const newPage = () => {
    page = document.addPage([pageWidth, pageHeight]);
    cursorY = pageHeight - margin;
  };

  const ensure = space => {
    if (cursorY - space < margin + 24) newPage();
  };

  const drawText = (text, options_ = {}) => {
    page.drawText(String(text ?? ''), {
      x: options_.x ?? margin,
      y: options_.y ?? cursorY,
      size: options_.size ?? size,
      font: options_.font ?? regular,
      color: options_.color ?? ink
    });
  };

  const charWidth = mono.widthOfTextAtSize('0', size);
  const maxChars = Math.floor(contentWidth / charWidth);

  const subjectCell = (candidate, code) => {
    const subject = (candidate.subjects ?? []).find(entry => entry.code === code);
    if (!subject) return '-';
    const marks = subject.marks?.value;
    const grade = subject.grade?.value ?? subject.grade?.raw ?? '';
    if (marks === null || marks === undefined) return grade || subject.marks?.raw || '-';
    return grade ? `${marks} ${grade}` : String(marks);
  };

  // The columns of the line, measured in characters of the fixed width font.
  const candidateRows = candidates.map(candidate => ({
    candidate,
    score: aggregateScore(candidate, subjectTable),
    cells: subjectCodes.map(code => subjectCell(candidate, code)),
    status: String(candidate.status ?? '-')
  }));
  const rollWidth = Math.max(10, ...candidateRows.map(({ candidate }) => String(candidate.rollNo ?? '').length));
  const nameWidth = Math.min(24, Math.max(12, ...candidateRows.map(({ candidate }) => String(candidate.name ?? '').length)));
  const genderWidth = 6;
  const subjectWidth = Math.max(6, ...candidateRows.flatMap(row => row.cells.map(cell => String(cell).length)));
  const totalWidth = Math.max(7, ...candidateRows.map(({ score }) => String(score.total ?? '-').length));
  const percentWidth = hasMarks
    ? Math.max(8, ...candidateRows.map(({ score }) => String(score.percent == null ? '-' : `${score.percent}%`).length))
    : 0;
  const statusWidth = Math.max(10, ...candidateRows.map(({ status }) => status.length));
  const metricWidths = [totalWidth, ...(hasMarks ? [percentWidth] : []), statusWidth];
  const fixedWidth = rollWidth + nameWidth + genderWidth + metricWidths.reduce((sum, width) => sum + width, 0);
  const fixedColumnCount = 3 + metricWidths.length;
  const maxSubjectColumns = Math.max(1, Math.floor(
    (maxChars - fixedWidth - 2 * (fixedColumnCount - 1)) / (subjectWidth + 2)
  ));
  const subjectBlocks = subjectCodes.length > maxSubjectColumns ? 2 : 1;
  const subjectColumns = subjectBlocks === 1
    ? Math.max(1, subjectCodes.length)
    : Math.min(maxSubjectColumns, Math.ceil(subjectCodes.length / 2));

  const drawGridLine = (columns, { color = ink, font = mono } = {}) => {
    ensure(lineHeight);
    const gapCount = Math.max(0, columns.length - 1);
    const baseGap = gapCount ? 2 : 0;
    const subjectCount = columns.filter(column => column.subject).length;
    const usedWidth = columns.reduce((sum, column) => sum + column.width, 0);
    const available = Math.max(0, maxChars - usedWidth - baseGap * gapCount);
    const subjectStretch = subjectCount ? Math.floor(available / subjectCount) : 0;
    const expandedWidth = usedWidth + subjectStretch * subjectCount;
    const gapStretch = subjectCount || !gapCount
      ? 0
      : Math.min(4, Math.floor(Math.max(0, maxChars - expandedWidth - baseGap * gapCount) / gapCount));
    const gapRemainder = gapCount ? Math.max(0, maxChars - expandedWidth - (baseGap + gapStretch) * gapCount) : 0;
    let charOffset = 0;
    columns.forEach((column, index) => {
      const width = column.width + (column.subject ? subjectStretch : 0);
      const text = String(column.text ?? '');
      const textWidth = mono.widthOfTextAtSize(text, size);
      const slack = Math.max(0, width * charWidth - textWidth);
      const x = margin + charOffset * charWidth + (column.align === 'left' ? 0 : slack);
      drawText(text, { x, y: cursorY, size, font, color });
      charOffset += width;
      if (index < gapCount) charOffset += baseGap + gapStretch + (index < gapRemainder ? 1 : 0);
    });
    cursorY -= lineHeight;
  };

  // The heading of the sheet.
  drawText('CBSE Result Sheet', { y: cursorY, size: 15, font: bold, color: ink });
  cursorY -= 17;
  const heading = [
    `${titleCaseName(meta.examName) || 'CBSE examination'}${meta.year ? ` ${meta.year}` : ''}`,
    `${titleCaseName(meta.schoolName) || 'School not printed'}${meta.schoolCode ? ` (code ${meta.schoolCode})` : ''}`,
    `${titleCaseName(meta.region) || 'Region not printed'} | Gazette date ${meta.gazetteDate || 'not printed'} | ${candidates.length} candidate${candidates.length === 1 ? '' : 's'}`
  ];
  const genderSplit = (analytics?.genderBreakdown ?? [])
    .filter(group => group.key !== '?' && group.candidates)
    .map(group => `${group.label} ${group.candidates}`)
    .join(' | ');
  if (genderSplit) heading.push(genderSplit);
  for (const text of heading) {
    drawText(text, { y: cursorY, size: 8.5, color: muted });
    cursorY -= 11;
  }
  page.drawLine({ start: { x: margin, y: cursorY + 4 }, end: { x: pageWidth - margin, y: cursorY + 4 }, thickness: 1, color: accent });
  cursorY -= 8;

  // Each value is placed in its own column; spare page width is distributed
  // across the subject columns. Continuation rows use the full width rather
  // than reserving empty space for the candidate identity and result columns.
  for (let block = 0; block < subjectBlocks; block += 1) {
    const codes = subjectCodes.slice(block * subjectColumns, (block + 1) * subjectColumns);
    const columns = block === 0 ? [
      { text: 'ROLL NO.', width: rollWidth, align: 'right' },
      { text: 'NAME', width: nameWidth, align: 'left' },
      { text: 'GENDER', width: genderWidth, align: 'right' }
    ] : [];
    columns.push(...codes.map(code => ({ text: code, width: subjectWidth, align: 'right', subject: true })));
    if (block === 0) {
      columns.push(
        { text: 'TOTAL', width: totalWidth, align: 'right' },
        ...(hasMarks ? [{ text: 'PERCENT', width: percentWidth, align: 'right' }] : []),
        { text: 'RESULT', width: statusWidth, align: 'right' }
      );
    }
    drawGridLine(columns, { color: muted, font: monoBold });
  }
  page.drawLine({ start: { x: margin, y: cursorY + 4 }, end: { x: pageWidth - margin, y: cursorY + 4 }, thickness: 0.6, color: line });
  cursorY -= 2;

  for (const { candidate, score, cells, status } of candidateRows) {
    const name = String(candidate.name ?? '');
    const nameChunks = [];
    for (let index = 0; index < name.length; index += nameWidth) nameChunks.push(name.slice(index, index + nameWidth));
    if (!nameChunks.length) nameChunks.push('');

    const lines = Math.max(nameChunks.length, subjectBlocks);
    for (let index = 0; index < lines; index += 1) {
      const columns = index === 0 ? [
        { text: candidate.rollNo ?? '', width: rollWidth, align: 'right' },
        { text: nameChunks[index] ?? '', width: nameWidth, align: 'left' },
        { text: genderLabel(candidate.gender), width: genderWidth, align: 'right' }
      ] : [];
      if (index > 0 && nameChunks[index]) {
        columns.push(
          { text: '', width: rollWidth, align: 'right' },
          { text: nameChunks[index], width: nameWidth, align: 'left' },
          { text: '', width: genderWidth, align: 'right' }
        );
      }
      if (index < subjectBlocks) {
        const blockCells = cells.slice(index * subjectColumns, (index + 1) * subjectColumns);
        for (const cell of blockCells) {
          columns.push({ text: cell, width: subjectWidth, align: 'right', subject: true });
        }
      }
      if (index === 0) {
        columns.push(
          { text: score.total ?? '-', width: totalWidth, align: 'right' },
          ...(hasMarks ? [{ text: score.percent == null ? '-' : `${score.percent}%`, width: percentWidth, align: 'right' }] : []),
          { text: status, width: statusWidth, align: 'right' }
        );
      }
      drawGridLine(columns);
    }
  }

  const pageCount = document.getPageCount();
  document.getPages().forEach((each, index) => {
    each.drawLine({
      start: { x: margin, y: margin - 10 },
      end: { x: pageWidth - margin, y: margin - 10 },
      thickness: 0.6,
      color: line
    });
    drawBrandedPdfFooter(each, index, pageCount, 'CBSE Result Sheet', regular, muted, margin);
  });

  const bytes = await document.save();
  return new Blob([bytes], { type: 'application/pdf' });
}
