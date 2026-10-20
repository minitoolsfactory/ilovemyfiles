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

### Result status vocabulary

| Canonical status | Printed tokens | In the appeared count |
| --- | --- | --- |
| `PASS` | `PASS`, `PASSED` | yes |
| `COMPARTMENT` | `COMP`, `COMPT`, `COMPTT`, `COMPARTMENT` | yes |
| `ESSENTIAL_REPEAT` | `ERL`, `ESSENTIAL REPEAT`, `REPEAT` | yes |
| `ABSENT` | `ABST`, `ABSENT` | no |
| `OTHER` | anything else, or no status at all | no |

A token is only accepted on a word boundary, so `PASSEDX` and `COMPANY` are not
read as a status. When no token matches, the record is counted as `OTHER`, the
raw text is kept in `statusRaw` and the record is flagged.

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

## Subject table

Built by `buildSubjectTable(dataset, overrides)`. One entry per subject code.

| Field | Meaning |
| --- | --- |
| `code`, `name`, `nameSource` | the code and the official name, or `Subject <code>` when the code is not verified |
| `publishedMax` | the published total scale of the subject, when the code is verified |
| `publishedScales` | every scale the subject is published on (a skill subject is published on 50 and on 100) |
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
**100**; a skill subject is 50 marks and is published on 50 or on 100.

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

The tables show the name and the roll number that the gazette prints, because
they are the reader's own file and never leave the browser. The **exports**
leave the identities out by default (`Candidate 001`, `Withheld`) so that a
downloaded file can be passed on; the switch "include the candidate names and
roll numbers in the exports" turns them back on for an internal report.

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
