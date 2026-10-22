# CBSE gazette parsing schema

The analyzer turns the text of a CBSE result gazette into a dataset. This page
describes every field, where it comes from, how it is normalised and what the
analyzer refuses to guess.

The schema lives in `src/lib/cbse/`:

| File | Responsibility |
| --- | --- |
| `subjects.js` | verified subject codes, result status vocabulary, grade boundaries |
| `grade-basis.js` | works out which grade table the printed grades of a subject follow |
| `parse-gazette.js` | text -> dataset (metadata, candidates, issues) |
| `analytics.js` | dataset -> statistics, filters, score bands |
| `validate.js` | dataset -> data quality checks |
| `exporters.js` | dataset -> CSV, XLSX and PDF |

## Rules that hold everywhere

1. **Original values are preserved.** Every field that is read from the file
   keeps the exact printed string next to the normalised value (`raw` and
   `value`). Nothing is corrected in place.
2. **A result status is never inferred from marks.** The canonical status
   always comes from the printed status token. A grade never produces a pass
   or a fail.
3. **A subject name is only used when the code is verified.** An unknown code
   is shown as `Subject <code>` and flagged.
4. **A subject maximum is never assumed to be the same for every subject.**
   The maximum in force is the scale the gazette itself prints: the published
   total scale of the subject when the marks fit it, otherwise the smallest
   known CBSE scale that fits. A subject printed on its published scale is not
   flagged, and the maximum can always be set by hand.
5. **Anything uncertain is flagged, never guessed.** A record that cannot be
   read with confidence is listed in the review step with the reason.

## Dataset

```js
{
  meta: {
    board: 'CBSE',
    examName: 'ALL INDIA SECONDARY SCHOOL EXAMINATION (MAIN)',
    year: 2025,
    class: 'X',              // 'X' or 'XII', inferred from the examination name
    classSource: 'exam-name',
    session: 'MAIN',
    region: 'DELHI-WEST',
    schoolCode: '27572',
    schoolName: 'ANONYMISED DEMO SCHOOL',
    gazetteDate: '2025-05-13',
    gazetteDateRaw: '13-05-2025',
    pageCount: 6,
    sourceFileName: 'gazette-27572-2025.txt',
    importedAt: '2026-10-20T13:25:06.907Z',
    layout: 'grid',          // 'grid' | 'loose'
    grid: { start: 64, pitch: 7, count: 7, source: 'header' }
  },
  candidates: [ /* see below */ ],
  printedSummary: {
    totalCandidates: 137, totalPass: 133, compartment: 3, essentialRepeat: 0, absent: 1
  },
  subjectOrder: ['002', '184', '241', '086', '087', '418', '122'],
  issues: [ { code, severity, message } ]
}
```

### Metadata sources

| Field | Printed as | Notes |
| --- | --- | --- |
| `board` | `C.B.S.E.` in the page header | dots are removed, the value is upper cased |
| `examName` | the text between the board and the year | |
| `year` | the trailing `-2025` of the examination | |
| `class` | `SECONDARY` / `SENIOR SECONDARY` in the examination name | `X` / `XII`, `classSource` records that it was inferred |
| `session` | `(MAIN)` in the examination name | |
| `region` | `REGION:` in the page header | |
| `schoolCode` | `SCHOOL : - 27572` | |
| `schoolName` | the text after the school code | |
| `gazetteDate` | `DATE:- 13-05-2025` | stored as `YYYY-MM-DD` and as the printed string |
| `pageCount` | the largest `PAGE:-` value | |
| `printedSummary` | `TOTAL CANDIDATES : ... TOTAL PASS : ...` | compared with the recalculated figures |

## Candidate record

```js
{
  recordId: 'ds1:cand-0001',   // stable internal id, never built from a name
  sequence: 1,
  rollNo: '92000001',
  rollNoRaw: '92000001',
  name: 'STUDENT 001',
  nameRaw: 'F STUDENT 001',
  gender: 'F',
  status: 'PASS',              // canonical status
  statusRaw: 'PASS',           // exactly as printed
  statusPrinted: true,         // false when the status could not be read
  compartmentSubjects: ['086'],
  subjects: [ /* see below */ ],
  page: 1,
  line: 15,
  confidence: 1,                // 0..1
  warnings: []
}
```

### The two printed layouts

A gazette prints its subjects either across the line (**column layout**) or one
per line (**vertical layout**, used by the senior secondary compartment
gazette).

| | Column layout | Vertical layout |
| --- | --- | --- |
| subject codes | one per column, on the record line | one per line, starting on the record line |
| marks and grades | the line below the record | not printed, only the grade |
| the grid | read at the column offsets of the printed `MKS GR` header | the code comes from the `SUB` column and the grade from the `CD` column |
| detection | the records carry a code in the column the header points at | the header carries an `INT-SB-GRD` block |

A file whose records do not fit the printed header is read by token analysis
instead, and that is reported in the issues.

### The printed values of a subject cell

| printed | read as |
| --- | --- |
| `088 A2` | the mark 88 and the grade A2 |
| `059` | the mark 59, no grade |
| `AB E` | no mark, the candidate was absent for the subject, the grade E |
| nothing | the subject was not taken, or the gazette prints nothing for it |

`marks.raw` always keeps what was printed and `marks.value` is the number, or
`null`. `absent` is true when the cell printed a value such as `AB` instead of
a number.

### Result status vocabulary

| Canonical status | Printed tokens | In the appeared count |
| --- | --- | --- |
| `PASS` | `PASS`, `PASSED` | yes |
| `COMPARTMENT` | `COMP`, `COMPT`, `COMPTT`, `COMPARTMENT` | yes |
| `ESSENTIAL_REPEAT` | `ERL`, `ESSENTIAL REPEAT`, `REPEAT` | yes |
| `ABSENT` | `ABST`, `ABSENT` | no |
| `OTHER` | `XXXX` (a result that is not decided), anything else | no |
| `OTHER` | anything else, or no status at all | no |

A token is only accepted on a word boundary, so `PASSEDX` and `COMPANY` are not
read as a status. When no token matches, the record is counted as `OTHER`, the
raw text is kept in `statusRaw` and the record is flagged.

The senior secondary compartment gazette prints `XXXX` when the result is not
decided. It is a status of its own and is reported as "other", so it is never
counted as a pass or a fail, and the `OTHER` total of the printed summary is
compared with the recalculated figure.

### Subject cell

```js
{
  slot: 0,                        // printed column, 0 based
  code: '002',
  codeRaw: '002',
  marks: { raw: '088', value: 88 },   // value is null when the cell is blank
  grade: { raw: 'A2', value: 'A2' },  // value is null when no grade was printed
  warnings: []
}
```

* `slot` is the printed column, so a candidate who was not offered one of the
  optional subjects keeps an **empty slot** instead of being shifted one column
  to the left.
* The order of the subjects is the printed order of that candidate. A gazette
  that prints a different order for some candidates is reported, and nothing is
  realigned.

### Confidence and warnings

`confidence` starts at `1` and loses weight for a missing name, a missing
result status, a missing marks line, subject slots without a code, subject
slots without marks and marks without a grade. A record is listed in the review
step when it has a warning or when its confidence is below `0.85`.

| Warning | Meaning |
| --- | --- |
| `result-status-unread` | no result status token was found |
| `name-unread` | the candidate name is empty |
| `marks-unread` | the record has no marks at all |
| `absent-with-marks` | an absent candidate carries marks |
| `subject-count-low` | fewer subject codes were found than expected |
| `marks-count-mismatch` | the number of mark values does not match the number of subject codes |
| `subject-code-unread` | a subject code could not be read |
| `marks-not-numeric` | a mark could not be read as a number |

## The subject knowledge base

`src/data/cbse-subjects.json` holds every subject code CBSE publishes, for
Class X and Class XII, with the official name, the group and the published
mark scale. It is built from the official CBSE subject list and the board date
sheets for 2025-26.

```json
{
  "meta": { "session": "2025-26", "sources": ["..."], "notes": ["..."] },
  "classes": {
    "X":   { "002": { "name": "Hindi Course-A", "group": "language", "theory": 80, "internal": 20 } },
    "XII": { "002": { "name": "Hindi Elective", "group": "language", "theory": 80, "internal": 20 } }
  }
}
```

The **total** a gazette prints is `theory + internal + practical`, which is
100 for every subject: 80 theory marks plus 20 marks of internal assessment for
the academic subjects, and 50 theory marks plus 50 marks of practical for the
skill subjects.

A code can mean a different subject in a different class, so the class of the
gazette decides the table that is read: `002` is Hindi Course-A in Class X and
Hindi Elective in Class XII, and `241` is Mathematics-Basic in Class X and
Applied Mathematics in Class XII. When the class cannot be read, the other
class is used as a fallback.

A code that is in neither table is shown as `Subject <code>` and flagged. It
is never guessed. The review step lists the whole library with a search box,
so a code can be looked up without leaving the tool.

## Subject table

Built by `buildSubjectTable(dataset, overrides)`. One entry per subject code.

| Field | Meaning |
| --- | --- |
| `code`, `name`, `nameSource` | the code and the official name, or `Subject <code>` when the code is not verified |
| `publishedMax` | the published total scale of the subject, when the code is verified |
| `publishedScales` | every scale the subject is published on |
| `max`, `maxSource` | the maximum in force: `verified`, `user` or `inferred` |
| `flags` | `unmapped-code`, `scale-inferred`, `exceeds-published-max`, `scale-unknown`, `max-unknown`. A subject that is printed on its published scale carries no flag. |
| `occurrences` | the number of candidates the code appears for |
| `valid`, `missing`, `invalid`, `absent` | the marks that could be used, that were blank, that were unreadable and that belong to an absent candidate |
| `average`, `median`, `minimum`, `maximum`, `stdDev` | over the valid marks only |
| `averagePercent` | the average as a percentage of `max` |
| `gradeCounts` | the printed grade of every valid mark |
| `slots` | the printed columns the code appears in |

### How the maximum in force is resolved

A CBSE gazette does not print a maximum column. The **published total scale**
of a subject is the scale a gazette prints: an academic subject is 80 theory
marks plus 20 marks of internal assessment, so the gazette prints it out of
**100**; a skill subject is 50 theory marks plus 50 marks of practical, which
is also 100.

1. The published scale is used when every printed mark fits inside it. A
   subject printed out of 100 is therefore measured out of 100 and is **not**
   flagged.
2. When the printed marks are above every published scale of the subject, the
   scale is **inferred** as the smallest known CBSE scale that fits
   (`50`, `80`, `100`) and the subject is flagged with `scale-inferred` and
   `exceeds-published-max`.
3. When no known scale fits, the maximum stays unknown, the subject is flagged
   with `scale-unknown`, and the reviewer is asked to set the maximum by hand.
4. A subject code that is not in the verified list has no published scale to
   compare against: the scale comes from the file and only `unmapped-code` is
   flagged.
5. A maximum that the reviewer sets always wins (`maxSource: 'user'`).

## Moving between the steps

The three steps are a row of buttons above the work area, and a **Back** button
sits on the right.

* A step that has been reached can be clicked again at any time, so the reader
  can go back to the review and check or correct something, then build the
  report again. The corrections are kept.
* A step that has not been reached yet is disabled, so the flow cannot jump
  over the review.
* The Back button names the step it returns to: "Back to the upload" on the
  review step and "Back to the review" on the report step.

## Analytics

`computeAnalytics(dataset, { filters, bands })` returns:

| Group | Fields |
| --- | --- |
| `totals` | `candidates`, `passed`, `compartment`, `essentialRepeat`, `absent`, `other`, `appeared`, `passPercentage`, `passPercentageOfAll`, `compartmentPercentage`, `absentPercentage` |
| `definitions` | the wording of every percentage, printed with the report |
| `statusDistribution` | the count and the share of every status |
| `gradeDistribution` | the count of every printed grade |
| `subjects` | the per subject statistics, including the score band counts |
| `scoreDistribution` | the candidate totals per score band |
| `topPerformers` | the highest scoring candidates with their total, their percentage, their rank and the marks of every subject they were offered |
| `topPerformerTotal` | how many candidates could be ranked at all |
| `markBandDistribution` | every printed subject mark per score band, as a percentage of the maximum in force for that subject |
| `markCount` | how many subject marks the band distribution was built from |
| `scores` | the aggregate score of every candidate |
| `compartmentSubjects` | the number of compartment candidates per subject code |
| `confidence` | the mean confidence, the number of records that need a review and the confidence distribution |

### Denominators

* **Appeared candidates** = `candidates - absent`. The statuses are mutually
  exclusive, so every candidate is counted once.
* **Pass percentage** = `passed / appeared x 100`.
* **Pass percentage of all candidates** = `passed / candidates x 100`.

Both are always shown. An absent candidate is never folded into an appeared
figure.

### The subject columns of the student and top candidate tables

`analytics.subjectCodes` is every subject code of the gazette, in the order the
gazette prints them: the column order of the first candidate, followed by any
code that only shows up later in the file.

The student table and the top candidate table print **one column per subject
code**, and the cell holds the mark and the grade of that candidate in that
subject (`88/A2`):

* a candidate who was **not offered** the subject gets a dash (`-`), and the
  cell explains that in its tooltip;
* a candidate whose subject has **no printed mark** also gets a dash, with a
  different tooltip;
* an absent candidate has a dash in every subject column.

The matrix is keyed by the subject **code**, not by the printed column, so a
candidate whose subject order differs from the usual one still lines up with
every other candidate.

The candidate and top candidate exports use the same layout: one column per
subject code, with the subject name in the header when the code is verified
and a dash for a subject the candidate did not take.

The tables and the exports show the name and the roll number that the gazette
prints, because the file is the reader's own and never leaves the browser. A
downloaded export is personal data and should be treated as confidential.

Every subject has **two columns**: the mark on the left and the printed grade
on the right. A candidate who was not offered the subject gets a dash in both,
and a gazette that prints the grades without the marks leaves the mark column
empty and fills the grade column.

Each subject column heading carries the **code, the official name and the
maximum in force**, and every heading sorts the table: click the roll number,
the name, the status or a subject code, and the rows are ordered by it. The
sort state is announced with `aria-sort` on the heading.

The table also carries a visible **sort control** next to the search box: a
"Sort by" list with every column, an **Ascending / Descending** button that
reverses the order, and a "Clear sort" button that returns to the printed
order. The heading click and the control drive the same state, so they never
disagree.

The columns have **fixed widths** (108px for the roll number, 190px for the
name, 118px for the status and 92px for every subject) and the table is as
wide as those columns, so a long name wraps inside its column instead of
pushing the columns around. The table body scrolls inside a fixed height
container with a sticky heading.

The records are **paginated** rather than cut off: the page size is 25, 50,
100 or 200 rows, the bar shows "Showing 1-50 of 137 record(s)" and "Page 1 of
3", and the first, previous, next and last buttons move between the pages.

The **report preview** shows the exact sections of the PDF before the file is
built: the gazette details, the headline figures, the status distribution, the
subject-wise performance, the grade distribution and the printed summary
compared with the recalculated figures. The PDF and the preview are built from
the same sections, so what is approved on screen is what lands in the file.

The data quality checks and the definitions are **not** part of the report.
They are kept in the code, and the section builders still accept
`includeChecks` and `includeDefinitions` so they can be turned back on.

In the interface the review step shows the main data first: the gazette details,
the recalculated summary, the subject codes and the records that need a second
look. The reference material (the data quality checks and the CBSE subject
code library) sits at the end of the step in a folded "Reference" panel with a
show and hide control, so it is there when it is wanted and out of the way when
it is not.

The data export carries the main tables only:

| File / sheet | Columns |
| --- | --- |
| `summary.csv` / Summary | the gazette details and the headline figures |
| `subjects.csv` / Subjects | code, name, maximum, records, valid marks, average, median, lowest, highest, standard deviation, average % |
| `candidates.csv` / Candidates | roll number, name, result status, total marks, marks available, percentage and one column per subject code |
| `top-candidates.csv` / Top candidates | the same, with the rank |
| `score-bands.csv` / Score bands | the candidates and the subject marks per band |
| `printed-summary.csv` / Printed summary | the totals the gazette printed |

A subject cell holds the mark on the left and the printed grade on the right
(`88 A2`), and a candidate who was not offered the subject gets a dash. The
internal columns (the identifier, the gender, the printed status, the status
source, the extraction confidence) are not exported.

The report itself carries the facts of the gazette (board, examination, year,
class, session, region, school, gazette date), the figures and the warnings.

The report also carries the **candidate records**: the roll number, the name,
the gender, the result, the total, the percentage and the mark or the grade of
every subject, one column per subject code. A dash means the candidate was not
offered that subject, or the gazette printed no mark for it, and the table
carries that note underneath. When the gazette prints the grades without the marks, the total and the
percentage columns are left out and the subject table shows the grade
distribution per subject instead of an empty average.
The name of the uploaded file and the moment of the import stay in the data
exports (CSV, Excel), where they are needed to trace a figure back to its
source, and they are left out of the printed report.

The PDF lays the report out itself: the column widths are measured from the
content instead of being split evenly, a long value wraps over several lines
instead of being cut off, the numeric columns are right aligned, a table that
continues on the next page repeats its heading, and a narrow table is only
stretched a little so it keeps its shape. The **exports**
always carry the candidate names and roll numbers, because the gazette is the
reader's own file and the export never leaves the browser.

### The split by gender

The gazette prints the gender in the flag column next to the roll number: `F`
for female and `M` for male. It is kept in `candidate.gender` and never
guessed.

`analytics.genderBreakdown` holds one entry per gender that appears in the
current selection:

| field | meaning |
| --- | --- |
| `key` | `F`, `M` or `?` when the gazette prints no gender |
| `label` | "Girls", "Boys" or "Not printed" |
| `candidates` | the candidates of that gender |
| `passed`, `compartment`, `absent`, `other` | the result status split |
| `appeared` | the candidates minus the absent ones |
| `passPercentage` | passed divided by appeared, times 100 |
| `average` | the mean aggregate score of that gender, when the gazette prints marks |

The gender is a column of the student table and of the top candidate table, a
row of the "Boys and girls" table, a chart of the result status per gender, a
column of the CSV and the Excel export, and a check that reports a gazette which
prints no gender at all.

### Aggregate score of a candidate

`sum(marks of the subjects the candidate was offered) / sum(maximum of those
subjects) x 100`. A candidate with no valid mark has no aggregate score and is
left out of the score distribution.

## Filters

`applyFilters(dataset, filters)` accepts `year`, `className`, `school`,
`region`, `subject`, `status`, `grade`, `scoreMin` and `scoreMax`. The score
filters use the aggregate score in per cent. Every filter is applied to the
analytics, the charts and the exports.

## Validation checks

`validateDataset(dataset, analytics)` returns a list of checks. Each check has
an `id`, a `label`, a `status` (`pass`, `warn`, `fail` or `info`), a `detail`
and a `count`.

| id | What it checks |
| --- | --- |
| `summary-totalCandidates`, `summary-totalPass`, `summary-compartment`, `summary-essentialRepeat`, `summary-absent` | the recalculated figures against the totals the gazette printed |
| `duplicate-rolls` | the same roll number more than once |
| `record-count` | whether a printed candidate total exists |
| `subject-count` | candidates with fewer or more subject codes than usual |
| `missing-marks` | blank and unreadable marks, counted apart |
| `absent-with-marks` | an absent candidate that carries marks |
| `marks-range` | a mark above the maximum in force for its subject |
| `marks-implausible` | a mark above 100, the largest scale any CBSE subject uses |
| `subject-scale` | a subject whose scale could not be established |
| `grade-marks` | a printed grade that disagrees with the printed mark, checked only for the subjects whose grading basis is known |
| `grade-basis` | the subjects whose printed grades follow a known CBSE grade table, and the ones whose grading basis the file does not disclose |
| `subject-order` | candidates whose printed subject order differs |
| `result-status` | a record without a readable result status |
| `compartment-subjects` | a compartment record without a subject code, and the other way round |
| `subject-names` | subject codes that are not in the verified list |
| `extraction-confidence` | the mean confidence and the number of records that need a review |
