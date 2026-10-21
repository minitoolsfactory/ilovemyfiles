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
 * Anonymise a record for a shareable export.
 *
 * @param {Object} candidate
 * @param {number} index
 * @returns {{ id: string, roll: string, name: string }}
 */
export function anonymise(candidate, index) {
  return {
    id: `Candidate ${String(index + 1).padStart(3, '0')}`,
    roll: 'Withheld',
    name: 'Withheld'
  };
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
  const includeIdentities = Boolean(options.includeIdentities);
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
    ['Records corrected by hand', options.corrections ?? 0]
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
    const identity = includeIdentities
      ? { roll: candidate.rollNo, name: candidate.name }
      : { roll: 'Withheld', name: 'Withheld' };
    const byCode = new Map((candidate.subjects ?? []).map(subject => [subject.code, subject]));
    const cells = subjectCodes.map(code => {
      const subject = byCode.get(code);
      if (!subject) return '-';
      if (subject.marks.value == null) return subject.grade.value ?? '-';
      // The mark on the left, the printed grade on the right.
      return subject.grade.value ? `${subject.marks.value} ${subject.grade.value}` : String(subject.marks.value);
    });
    const score = aggregateScore(candidate, analytics.subjects ?? []);
    return [
      identity.roll,
      identity.name,
      candidate.status,
      score.total ?? '',
      score.available ?? '',
      score.percent == null ? '' : `${score.percent}%`,
      ...cells
    ];
  });

  const checkRows = checks.map(check => [check.status.toUpperCase(), check.label, check.detail]);

  const topRows = (analytics.topPerformers ?? []).map((entry, index) => {
    const identity = includeIdentities
      ? { roll: entry.rollNo, name: entry.name }
      : { roll: 'Withheld', name: 'Withheld' };
    const byCode = new Map((entry.subjects ?? []).map(subject => [subject.code, subject]));
    const cells = subjectCodes.map(code => {
      const subject = byCode.get(code);
      if (!subject) return '-';
      if (subject.marks == null) return subject.grade ?? '-';
      return subject.grade ? `${subject.marks} ${subject.grade}` : String(subject.marks);
    });
    return [
      entry.rank,
      identity.roll,
      identity.name,
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
    topRows, subjectHeaders, includeIdentities
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
    ['Subject code', 'Subject name', 'Maximum used', 'Records', 'Valid marks', 'Average', 'Median', 'Lowest', 'Highest', 'Std deviation', 'Average %'],
    model.subjectRows
  );
  bundle['candidates.csv'] = buildCsv(
    ['Roll number', 'Candidate name', 'Result status', 'Total marks', 'Marks available', 'Percentage', ...model.subjectHeaders],
    model.candidateRows
  );
  bundle['top-candidates.csv'] = buildCsv(
    ['Rank', 'Roll number', 'Candidate name', 'Result status', 'Total marks', 'Marks available', 'Percentage', ...model.subjectHeaders],
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
      ['Examination', meta.examName || 'Not printed'],
      ['Year', meta.year ?? 'Not printed'],
      ['Class', meta.class || 'Not printed'],
      ['Session', meta.session || 'Not printed'],
      ['Region', meta.region || 'Not printed'],
      ['School code', meta.schoolCode || 'Not printed'],
      ['School name', meta.schoolName || 'Not printed'],
      ['Gazette date', meta.gazetteDate || 'Not printed']
    ]
  });

  sections.push({
    type: 'headline',
    title: 'Headline figures',
    items: [
      { label: 'Candidates', value: totals.candidates },
      { label: 'Passed', value: totals.passed },
      { label: 'Compartment', value: totals.compartment },
      { label: 'Essential repeat', value: totals.essentialRepeat },
      { label: 'Absent', value: totals.absent },
      { label: 'Other', value: totals.other },
      { label: 'Appeared', value: totals.appeared },
      { label: 'Pass % of appeared', value: totals.passPercentage == null ? 'Not available' : `${totals.passPercentage}%` },
      { label: 'Pass % of all', value: totals.passPercentageOfAll == null ? 'Not available' : `${totals.passPercentageOfAll}%` }
    ]
  });

  sections.push({
    type: 'table',
    title: 'Result status distribution',
    columns: ['Status', 'Candidates', 'Share of all candidates'],
    rows: analytics.statusDistribution.map(entry => [entry.label, entry.count, `${entry.share}%`])
  });

  sections.push({
    type: 'table',
    title: 'Subject-wise performance',
    columns: ['Code', 'Subject', 'Max', 'Valid', 'Average', 'Median', 'Lowest', 'Highest', 'Std dev', 'Average %'],
    rows: analytics.subjects.map(subject => [
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
    ])
  });

  sections.push({
    type: 'table',
    title: 'Grade distribution',
    columns: ['Grade', 'Entries'],
    rows: analytics.gradeDistribution.map(entry => [entry.grade, entry.count])
  });

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
      header: ['Subject code', 'Subject name', 'Maximum used', 'Records', 'Valid marks', 'Average', 'Median', 'Lowest', 'Highest', 'Std deviation', 'Average %'],
      rows: model.subjectRows
    },
    {
      name: 'Candidates',
      header: ['Roll number', 'Candidate name', 'Result status', 'Total marks', 'Marks available', 'Percentage', ...model.subjectHeaders],
      rows: model.candidateRows
    },
    {
      name: 'Top candidates',
      header: ['Rank', 'Roll number', 'Candidate name', 'Result status', 'Total marks', 'Marks available', 'Percentage', ...model.subjectHeaders],
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

/**
 * Build a PDF summary report with pdf-lib.
 *
 * @param {Object} model
 * @param {Object} analytics
 * @param {Object} dataset
 * @returns {Promise<Blob>}
 */
export async function buildPdfReport(model, analytics, dataset, checks) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
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

  const newPage = () => {
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
  const wrapText = (text, font, size, maxWidth) => {
    const value = String(text ?? '');
    if (!value) return [''];
    if (measure(value, font, size) <= maxWidth) return [value];
    const lines = [];
    let line = '';
    for (const word of value.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, font, size) <= maxWidth || !line) {
        line = candidate;
        continue;
      }
      lines.push(line);
      line = word;
    }
    if (line) lines.push(line);
    return lines.map(entry => {
      if (measure(entry, font, size) <= maxWidth) return entry;
      let cut = entry;
      while (cut.length > 1 && measure(`${cut}-`, font, size) > maxWidth) cut = cut.slice(0, -1);
      return `${cut}-`;
    });
  };

  /**
   * The width of every column: the widest cell, with the slack given to the
   * column that carries the most text.
   */
  const layoutColumns = (columns, rows) => {
    const head = columns.map(label => measure(label, bold, 8.5) + 12);
    const body = columns.map((_, index) => Math.max(
      ...rows.map(row => measure(String(row[index] ?? ''), regular, 8.5)),
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
    while (used > contentWidth && guard < 40) {
      const widest = widths.indexOf(Math.max(...widths));
      if (widths[widest] <= head[widest] + 2) break;
      widths[widest] -= 1;
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

  const drawTable = (columns, rows) => {
    if (!rows.length) {
      drawText('No rows.', { y: cursorY, size: 9, color: muted });
      cursorY -= 14;
      return;
    }
    const widths = layoutColumns(columns, rows);
    const numeric = columns.map((_, index) => isNumericColumn(index, rows));

    const drawHead = () => {
      page.drawRectangle({ x: margin, y: cursorY - 4, width: contentWidth, height: 17, color: band });
      let x = margin;
      columns.forEach((label, index) => {
        const text = String(label);
        drawText(text, {
          x: numeric[index] ? x + widths[index] - 10 - measure(text, bold, 8.5) : x,
          y: cursorY,
          size: 8.5,
          bold: true,
          color: muted
        });
        x += widths[index];
      });
      cursorY -= 22;
    };

    ensure(70);
    drawHead();

    rows.forEach((row, rowIndex) => {
      const cells = row.map((cell, index) => wrapText(String(cell ?? ''), regular, 8.5, widths[index] - 10));
      const lines = Math.max(...cells.map(entry => entry.length));
      const rowHeight = lines * 11 + 7;
      if (cursorY - rowHeight < margin + 26) {
        // The table continues on the next page: repeat the heading.
        newPage();
        drawHead();
      }
      if (rowIndex % 2 === 1) {
        page.drawRectangle({ x: margin, y: cursorY - rowHeight + 12, width: contentWidth, height: rowHeight, color: zebra });
      }
      let cellX = margin;
      cells.forEach((cellLines, index) => {
        cellLines.forEach((line, lineIndex) => {
          const textX = numeric[index]
            ? cellX + widths[index] - 10 - measure(line, regular, 8.5)
            : cellX;
          drawText(line, { x: textX, y: cursorY - lineIndex * 11, size: 8.5, color: ink });
        });
        cellX += widths[index];
      });
      cursorY -= rowHeight;
    });
    page.drawLine({ start: { x: margin, y: cursorY + 8 }, end: { x: pageWidth - margin, y: cursorY + 8 }, thickness: 0.6, color: line });
    cursorY -= 10;
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

  const sections = buildReportSections(analytics, dataset, checks ?? []);

  // The report cover block.
  ensure(120);
  drawText('CBSE RESULT ANALYSIS REPORT', { y: cursorY, size: 17, bold: true, color: ink });
  cursorY -= 20;
  drawText(`${model.meta.examName || 'CBSE examination'}${model.meta.year ? `  ·  ${model.meta.year}` : ''}`, { y: cursorY, size: 10.5, color: muted });
  cursorY -= 14;
  drawText(`${model.meta.schoolName || 'School not printed'}${model.meta.schoolCode ? `  ·  code ${model.meta.schoolCode}` : ''}`, { y: cursorY, size: 10.5, color: muted });
  cursorY -= 14;
  const sourceLine = `Region ${model.meta.region || 'not printed'}   ·   Gazette date ${model.meta.gazetteDate || 'not printed'}`;
  for (const line of wrapText(sourceLine, regular, 8, contentWidth)) {
    drawText(line, { y: cursorY, size: 8, color: muted });
    cursorY -= 11;
  }
  page.drawLine({ start: { x: margin, y: cursorY }, end: { x: pageWidth - margin, y: cursorY }, thickness: 1, color: line });
  cursorY -= 6;

  for (const section of sections) {
    drawHeading(section.title);
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
      drawTable(section.columns, section.rows);
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
    each.drawLine({
      start: { x: margin, y: margin - 10 },
      end: { x: pageWidth - margin, y: margin - 10 },
      thickness: 0.6,
      color: line
    });
    each.drawText('CBSE Result Analysis Report', {
      x: margin, y: margin - 22, size: 7.5, font: regular, color: muted
    });
    each.drawText(`Page ${index + 1} of ${pageCount}`, {
      x: pageWidth - margin - 60, y: margin - 22, size: 7.5, font: regular, color: muted
    });
  });

  const bytes = await document.save();
  return new Blob([bytes], { type: 'application/pdf' });
}
