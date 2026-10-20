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
    subject.maxSource,
    subject.occurrences,
    subject.valid,
    subject.missing,
    subject.invalid,
    subject.average ?? '',
    subject.median ?? '',
    subject.minimum ?? '',
    subject.maximum ?? '',
    subject.stdDev ?? '',
    subject.averagePercent == null ? '' : `${subject.averagePercent}%`,
    subject.flags.join(' ') || 'none'
  ]);

  // Every subject code of the gazette gets its own column, so a spreadsheet
  // can pivot the table. A candidate who was not offered a subject gets a dash.
  const subjectCodes = analytics.subjectCodes ?? [];
  const subjectNames = new Map((analytics.subjects ?? []).map(subject => [subject.code, subject.name]));

  const candidateRows = candidates.map((candidate, index) => {
    const identity = includeIdentities
      ? { id: candidate.rollNo, roll: candidate.rollNo, name: candidate.name }
      : anonymise(candidate, index);
    const byCode = new Map((candidate.subjects ?? []).map(subject => [subject.code, subject]));
    const cells = subjectCodes.map(code => {
      const subject = byCode.get(code);
      if (!subject) return '-';
      if (subject.marks.value === null) return '-';
      return subject.grade.value ? `${subject.marks.value}/${subject.grade.value}` : String(subject.marks.value);
    });
    return [
      identity.id,
      identity.roll,
      identity.name,
      candidate.gender || '',
      candidate.status,
      candidate.statusRaw,
      candidate.statusSource ?? (candidate.statusPrinted ? 'printed' : 'unreadable'),
      candidate.compartmentSubjects.join(' '),
      ...cells,
      Math.round((candidate.confidence ?? 0) * 100)
    ];
  });

  const checkRows = checks.map(check => [check.status.toUpperCase(), check.label, check.detail]);

  const topRows = (analytics.topPerformers ?? []).map((entry, index) => {
    const identity = includeIdentities
      ? { id: entry.rollNo, roll: entry.rollNo, name: entry.name }
      : anonymise({ rollNo: entry.rollNo, name: entry.name }, index);
    const byCode = new Map((entry.subjects ?? []).map(subject => [subject.code, subject]));
    const cells = subjectCodes.map(code => {
      const subject = byCode.get(code);
      if (!subject) return '-';
      if (subject.marks == null) return '-';
      return subject.grade ? `${subject.marks}/${subject.grade}` : String(subject.marks);
    });
    return [
      entry.rank,
      identity.id,
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
    ['Subject code', 'Subject name', 'Maximum used', 'Maximum source', 'Records', 'Valid marks', 'Missing', 'Unreadable', 'Average', 'Median', 'Lowest', 'Highest', 'Std deviation', 'Average %', 'Flags'],
    model.subjectRows
  );
  bundle['candidates.csv'] = buildCsv(
    ['Identifier', 'Roll number', 'Candidate name', 'Gender', 'Result status', 'Status as printed', 'Status source', 'Compartment subjects', ...model.subjectHeaders, 'Extraction confidence %'],
    model.candidateRows
  );
  bundle['data-quality.csv'] = buildCsv(['Status', 'Check', 'Detail'], model.checkRows);
  bundle['top-candidates.csv'] = buildCsv(
    ['Rank', 'Identifier', 'Roll number', 'Candidate name', 'Result status', 'Total marks', 'Marks available', 'Percentage', ...model.subjectHeaders],
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
      header: ['Subject code', 'Subject name', 'Maximum used', 'Maximum source', 'Records', 'Valid marks', 'Missing', 'Unreadable', 'Average', 'Median', 'Lowest', 'Highest', 'Std deviation', 'Average %', 'Flags'],
      rows: model.subjectRows
    },
    {
      name: 'Candidates',
      header: ['Identifier', 'Roll number', 'Candidate name', 'Gender', 'Result status', 'Status as printed', 'Status source', 'Compartment subjects', ...model.subjectHeaders, 'Extraction confidence %'],
      rows: model.candidateRows
    },
    { name: 'Data quality', header: ['Status', 'Check', 'Detail'], rows: model.checkRows },
    {
      name: 'Top candidates',
      header: ['Rank', 'Identifier', 'Roll number', 'Candidate name', 'Result status', 'Total marks', 'Marks available', 'Percentage', ...model.subjectHeaders],
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
export async function buildPdfReport(model, analytics, dataset) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 44;
  let page = document.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - margin;

  const ink = rgb(0.13, 0.14, 0.23);
  const muted = rgb(0.36, 0.39, 0.47);
  const accent = rgb(0.36, 0.35, 0.96);
  const line = rgb(0.87, 0.88, 0.93);

  const newPage = () => {
    page = document.addPage([pageWidth, pageHeight]);
    cursorY = pageHeight - margin;
  };

  const ensure = space => {
    if (cursorY - space < margin + 24) newPage();
  };

  const drawText = (text, options = {}) => {
    const size = options.size ?? 10;
    const font = options.bold ? bold : regular;
    const value = String(text ?? '');
    const maxWidth = options.maxWidth ?? (pageWidth - margin * 2);
    let rendered = value;
    if (font.widthOfTextAtSize(rendered, size) > maxWidth) {
      while (rendered.length > 4 && font.widthOfTextAtSize(`${rendered}...`, size) > maxWidth) {
        rendered = rendered.slice(0, -1);
      }
      rendered = `${rendered}...`;
    }
    page.drawText(rendered, { x: options.x ?? margin, y: cursorY, size, font, color: options.color ?? ink });
    if (options.advance !== false) cursorY -= options.advance ?? size * 1.5;
    return rendered;
  };

  const drawHeading = text => {
    ensure(40);
    cursorY -= 10;
    drawText(text, { size: 14, bold: true, color: accent });
    cursorY -= 4;
    page.drawLine({ start: { x: margin, y: cursorY }, end: { x: pageWidth - margin, y: cursorY }, thickness: 1, color: line });
    cursorY -= 12;
  };

  const drawTable = (header, rows, widths) => {
    ensure(60);
    let x = margin;
    header.forEach((cell, index) => {
      page.drawText(String(cell), { x, y: cursorY, size: 8.5, font: bold, color: muted });
      x += widths[index];
    });
    cursorY -= 12;
    page.drawLine({ start: { x: margin, y: cursorY + 4 }, end: { x: pageWidth - margin, y: cursorY + 4 }, thickness: 0.6, color: line });
    for (const row of rows) {
      ensure(18);
      x = margin;
      row.forEach((cell, index) => {
        const value = String(cell ?? '');
        const maxWidth = widths[index] - 6;
        let rendered = value;
        if (regular.widthOfTextAtSize(rendered, 8.5) > maxWidth) {
          while (rendered.length > 2 && regular.widthOfTextAtSize(`${rendered}...`, 8.5) > maxWidth) rendered = rendered.slice(0, -1);
          rendered = `${rendered}...`;
        }
        page.drawText(rendered, { x, y: cursorY, size: 8.5, font: regular, color: ink });
        x += widths[index];
      });
      cursorY -= 13;
    }
    cursorY -= 6;
  };

  drawText('CBSE Result Analysis Report', { size: 18, bold: true, color: ink, advance: 24 });
  drawText(`${model.meta.examName || 'CBSE examination'}${model.meta.year ? ` - ${model.meta.year}` : ''}`, { size: 11, color: muted, advance: 16 });
  drawText(`${model.meta.schoolName || 'School not printed'}${model.meta.schoolCode ? ` (code ${model.meta.schoolCode})` : ''}`, { size: 10, color: muted, advance: 14 });
  drawText(`Region ${model.meta.region || 'not printed'} | Gazette date ${model.meta.gazetteDate || 'not printed'} | Source file ${model.meta.sourceFileName || 'not printed'} | Imported ${model.meta.importedAt || 'not printed'}`, { size: 8.5, color: muted, advance: 20 });

  drawHeading('Headline figures');
  const totals = analytics.totals;
  const tiles = [
    ['Candidates', totals.candidates], ['Passed', totals.passed], ['Compartment', totals.compartment],
    ['Essential repeat', totals.essentialRepeat], ['Absent', totals.absent], ['Appeared', totals.appeared],
    ['Pass % (of appeared)', totals.passPercentage == null ? '-' : `${totals.passPercentage}%`],
    ['Pass % (of all)', totals.passPercentageOfAll == null ? '-' : `${totals.passPercentageOfAll}%`]
  ];
  const tileWidth = (pageWidth - margin * 2) / 4;
  tiles.forEach((tile, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = margin + column * tileWidth;
    const y = cursorY - row * 42;
    page.drawText(String(tile[1]), { x, y, size: 15, font: bold, color: ink });
    page.drawText(String(tile[0]), { x, y: y - 12, size: 8, font: regular, color: muted });
  });
  cursorY -= 42 * Math.ceil(tiles.length / 4) + 12;

  drawHeading('Result status distribution');
  drawTable(
    ['Status', 'Candidates', 'Share of all candidates'],
    analytics.statusDistribution.map(entry => [entry.label, entry.count, `${entry.share}%`]),
    [200, 90, 180]
  );

  drawHeading('Subject-wise performance');
  drawTable(
    ['Code', 'Subject', 'Max', 'Valid', 'Average', 'Median', 'Lowest', 'Highest', 'Avg %'],
    analytics.subjects.map(subject => [
      subject.code, subject.name, subject.max ?? '?', subject.valid,
      subject.average ?? '-', subject.median ?? '-', subject.minimum ?? '-', subject.maximum ?? '-',
      subject.averagePercent == null ? '-' : `${subject.averagePercent}%`
    ]),
    [34, 130, 32, 36, 42, 42, 42, 42, 40]
  );

  drawHeading('Grade distribution');
  drawTable(
    ['Grade', 'Entries'],
    analytics.gradeDistribution.map(entry => [entry.grade, entry.count]),
    [120, 120]
  );

  if (model.topRows?.length) {
    drawHeading('Top candidates');
    drawTable(
      ['Rank', 'Identifier', 'Result', 'Total', 'Available', 'Percentage'],
      model.topRows.map(row => [row[0], row[1], row[4], row[5], row[6], row[7]]),
      [34, 150, 70, 50, 60, 60]
    );
  }

  if (dataset.printedSummary) {
    drawHeading('Printed summary compared with the parsed records');
    drawTable(
      ['Figure', 'Printed in the gazette', 'Recalculated from the records', 'Difference'],
      Object.entries(dataset.printedSummary).map(([key, value]) => {
        const calculated = {
          totalCandidates: totals.candidates,
          totalPass: totals.passed,
          compartment: totals.compartment,
          essentialRepeat: totals.essentialRepeat,
          absent: totals.absent
        }[key];
        const difference = calculated != null && value != null ? calculated - value : '';
        return [key, value ?? '-', calculated ?? '-', difference === '' ? '-' : difference];
      }),
      [150, 120, 150, 80]
    );
  }

  drawHeading('Data quality checks');
  for (const check of model.checkRows) {
    ensure(20);
    const status = check[0];
    const color = status === 'PASS' ? rgb(0.1, 0.5, 0.34) : status === 'FAIL' ? rgb(0.7, 0.15, 0.12) : status === 'WARN' ? rgb(0.54, 0.35, 0) : muted;
    page.drawText(status, { x: margin, y: cursorY, size: 8, font: bold, color });
    drawText(`${check[1]} - ${check[2]}`, { x: margin + 42, size: 8.5, color: ink, advance: 12 });
  }

  drawHeading('Definitions');
  for (const [key, value] of Object.entries(analytics.definitions)) {
    ensure(20);
    drawText(`${key}: ${value}`, { size: 8.5, color: muted, advance: 12 });
  }

  const pageCount = document.getPageCount();
  document.getPages().forEach((each, index) => {
    each.drawText(`Source ${model.meta.sourceFileName || 'uploaded gazette'} | Imported ${model.meta.importedAt || ''}`, {
      x: margin, y: margin - 14, size: 7.5, font: regular, color: muted
    });
    each.drawText(`Page ${index + 1} of ${pageCount}`, {
      x: pageWidth - margin - 60, y: margin - 14, size: 7.5, font: regular, color: muted
    });
  });

  const bytes = await document.save();
  return new Blob([bytes], { type: 'application/pdf' });
}
