# Supported gazette formats and known limitations

## What is supported today

| Input | How it is read | Confidence |
| --- | --- | --- |
| `.txt` export of a gazette | read as text, the printed columns are used | highest |
| `.pdf` with a text layer | the text layer is rebuilt into the printed monospace layout with PDF.js | high |
| `.pdf` without a usable text layer | the pages are rendered and recognised with on-device OCR (Tesseract.js) | lower, every record is flagged with its confidence |
| several files at once | each file becomes its own dataset, the subject comparison chart covers all of them | as per file |

Limits: 25 MB per file, 200 pages per PDF, 20 000 candidate records per file.

### The layout the analyzer expects

The school and roll-number-wise gazette that the CBSE result portal produces:

```
DATE:- 13-05-2025    C.B.S.E. - ALL INDIA SECONDARY SCHOOL EXAMINATION (MAIN)-2025      REGION: DELHI-WEST         PAGE:-       1
                                    ***** (SCHOOL / ROLL NO WISE GAZETTE) *****

ROLL    F S NAME OF CANDIDATE       -----------------SUBJECTS-----------------------  RESULT            COMP
NO      L X                 SUB CD SUB CD SUB CD SUB CD SUB CD SUB CD SUB CD                    SUB
                    MKS GR MKS GR MKS GR MKS GR MKS GR MKS GR MKS GR

SCHOOL : - 27572   SCHOOL NAME

92000001   F CANDIDATE NAME      002    184    041    086    087    418    122     PASS
                    088 A2 059 C2 075 B1 068 B2 076 B2 084 B2 068 B1
```

* One record per candidate: a line with the roll number, the flags, the name
  and the subject codes, followed by a line with the marks and the grades.
* The subject grid is taken from the printed `MKS GR` header. When the header
  is missing, the grid is inferred from the records, and the inference is
  checked against the marks lines before it is used.
* The result status and the compartment subject code are read from the right
  hand side of the record, wherever they are printed.
* The printed summary at the end of the file is read and compared with the
  recalculated figures.

### The gazette formats that are supported

| Examination | Class | Layout | What it prints |
| --- | --- | --- | --- |
| `ALL INDIA SECONDARY SCHOOL EXAMINATION (MAIN)` | X | columns | the subject codes across the line, the marks and the grades below |
| `ALL INDIA SECONDARY SCHOOL EXAMINATION` | X | columns | the same, without the grades |
| `ALL INDIA SECONDARY SCHOOL EXAMINATION (COMPTT)` | X | columns | only the subjects the candidate sat the compartment exam in, and a result of `XXXX` when it is not decided |
| `SENIOR SCHOOL CERTIFICATE EXAMINATION (COMPTT)` | XII | vertical | one subject per line with its grade, and a result of `XXXX` when it is not decided |

All four are read by the same analyzer. A gazette that prints a subject as
`AB` means the candidate was absent for that subject: the value is kept, the
subject is left out of the averages and the report says how many there were.

A gazette that prints the grades without the marks has no average, total or
percentage to show. The analyzer does not leave the reader with a table of
dashes: the subject table shows the **grade distribution per subject** and the
candidate table shows the grade of every subject, and the report says that the
marks are not printed.

### The two printed layouts

| Layout | What it looks like | How it is read |
| --- | --- | --- |
| **Column layout** (Class X and most gazettes) | the subject codes run across the line, the marks and the grades on the line below | the subject area is read at the column offsets of the printed `MKS GR` header, so a candidate who was not offered an optional subject keeps an **empty slot** |
| **Vertical layout** (the senior secondary compartment gazette) | one subject per line: the code, then the grade | the subject code is read from the `SUB` column and the grade from the `CD` column of every line that follows the record |

The vertical layout is recognised from the printed `INT-SB-GRD` block of the
header, and the column layout is confirmed by checking that the records really
carry a code in the column the header points at. A file whose records do not fit
the printed header is read by token analysis instead, and that is reported.

### What the two layouts print differently

* The vertical layout prints a **flag** between the roll number and the gender
  (`26720328 I F RIDDHIMA`). The flag is kept in its own field and never ends
  up in the candidate name.
* The vertical layout can print **`XXXX`** in the result column, which means
  the result is not decided. It is a status of its own and is reported as
  "other", so it is never counted as a pass or a fail.
* The vertical layout prints the **grades without the marks**. The analyzer
  says so, reports the grades as printed and leaves the averages, the totals
  and the percentages empty, because there is nothing to average.
* A gazette may print the **marks without the grades**. The marks are read and
  the grade stays empty.
* A cell may print **`AB`** instead of a mark, which means the candidate was
  absent for that subject. The printed value is kept and shown, and the
  subject is left out of the averages.
* The senior secondary gazette prints an **`OTHER`** total in its summary, which
  is compared with the recalculated figure like every other total.

### Layouts the analyzer copes with

* A candidate who was not offered one of the optional subjects: the empty
  column is kept as an empty slot, the other candidates are not shifted.
* A different subject order for some candidates: every candidate keeps its own
  printed order.
* A different number of subjects for some candidates: reported, not corrected.
* A candidate with no marks line (an absent candidate): the status is kept and
  the marks stay empty.
* A status token that is not in the CBSE vocabulary: the record is counted as
  `OTHER`, the printed text is kept and the record is flagged.
* A column header that does not match the records: the layout that matches the
  records is used and the mismatch is reported.
* A file whose columns were lost (an OCR result): token based parsing is used
  and the whole file is marked as lower confidence.

## Subject codes

`src/lib/cbse/subjects.js` holds the verified CBSE Class X codes with their
official name and their published maximum. A code that is not in that list is
shown as `Subject <code>`, is flagged, and the reviewer can give it a name and
a maximum in the review step before the report is built.

The knowledge base in `src/data/cbse-subjects.json` holds every subject code
CBSE publishes for Class X (85 codes) and Class XII (116 codes), with the
official name, the group and the published mark scale, taken from the official
CBSE subject list and the board date sheets for 2025-26. The review step lists
the whole library with a search box.

The published maximum is the **total** scale a gazette prints, which is 100 for
every subject: 80 theory marks plus 20 marks of internal assessment for the
academic subjects, and 50 theory marks plus 50 marks of practical for the skill
subjects.

A code means a different subject in a different class, so the class of the
gazette decides the table that is read: `002` is Hindi Course-A in Class X and
Hindi Elective in Class XII, and `241` is Mathematics-Basic in Class X and
Applied Mathematics in Class XII.

The codes `119`, `184`, `241` and the `2025` skill codes are **not** in the
verified list, so they are shown as `Subject <code>`. They are deliberately not
guessed: a wrong subject name in a result report is worse than an unnamed
subject code.

## Grade boundaries

The published CBSE Class X boundaries are used for one purpose only: to report
whether a printed grade agrees with the printed mark.

| Grade | Out of 80 | Out of 100 |
| --- | --- | --- |
| A1 | 75-80 | 93-100 |
| A2 | 64-74 | 81-92 |
| B1 | 53-63 | 69-80 |
| B2 | 42-52 | 51-68 |
| C1 | 33-41 | 35-50 |
| C2 | 25-32 | 21-34 |
| D1 | 17-24 | 11-20 |
| D2 | 8-16 | 1-10 |
| E | 0-7 | 0 |

A grade is **never** used to decide whether a candidate passed, and a result
status is **never** derived from a mark.

## Top candidates

The report lists the candidates with the highest aggregate score. The ranking
uses the total of the printed marks as a percentage of the marks available to
that candidate, so a candidate who was offered an optional subject is measured
over the subjects they were actually offered, and never over a maximum they
were not sitting.

* Candidates with the same percentage share a rank, the way a printed result
  report shows it.
* An absent candidate has no marks and is never ranked.
* The list follows the filters of the dashboard, and the size of the list is
  set by the reader (top 5, 10, 20 or 50).
* The name and the roll number are the ones printed in the gazette, the same
  way the student list shows them.

## Grading basis

A gazette does not always say which quantity the grade was awarded on. The
printed mark can be a theory mark, a theory mark plus internal assessment, or a
mark on a combined scale, and the file often does not say which.

The analyzer therefore measures the grading basis instead of assuming it. For
every subject the printed (mark, grade) pairs are compared with the known CBSE
tables for the candidate scales (50, 80, 100 and the other common ones). A
subject is called **established** only when one of those tables explains at
least 95 per cent of its printed grades.

* A subject whose basis is established is checked against the mark, and a
  disagreement is reported with examples.
* A subject whose basis is not established is reported as a warning: the
  grading basis is not disclosed by the file, so the grades are printed as they
  are and were not checked.

This is why the supplied 2025 gazette warns instead of failing. Its grades do
not follow any of the known CBSE tables, which is a property of the file and
not a fault of the extraction. The tool never turns that into a pass or a fail.

## Known limitations

1. **Only Class X and Class XII.** The class is read from the examination name.
   A gazette that uses a different examination name is read, but the class is
   left empty.
2. **The maximum in force is the scale the file prints.** A gazette prints the
   total mark of a subject, so an academic subject (80 theory + 20 internal
   assessment) is printed out of 100 and is measured out of 100. A skill
   subject is published on 50 or on 100 and both are accepted. Only a subject
   whose marks are above every published scale is flagged, and then the
   reviewer is asked for a decision in the review step.
3. **A printed grade that disagrees with the printed mark is reported, not
   fixed.** The supplied 2025 gazette does not follow any known CBSE grade
   table, so the check is reported as a warning about the undisclosed grading
   basis, not as a failure of the extraction. A subject whose grading basis
   *is* known and still disagrees is reported as a failure.
4. **OCR is a fallback, not a promise.** The recognised text has no monospace
   grid, so the subject order can only be inferred. Every OCR record carries a
   lower confidence and the whole file is flagged.
5. **Token based parsing needs the number of subjects.** The codes are aligned
   from the right with the mark and grade pairs, so a candidate whose name ends
   in a number does not shift the subject codes. A record with fewer codes than
   mark pairs is flagged rather than realigned.
6. **No CSV or Excel input.** A spreadsheet export of a gazette is not read
   yet. It is a planned follow-up.
7. **One gazette per school per session.** Several gazettes can be uploaded
   and compared, but they are not merged into one class.
8. **The comparison chart is descriptive.** It compares the uploaded gazettes
   with each other. It does not rank schools, does not build a trend over
   years and does not compare against any national figure.
9. **The country gate is a market rule, not a data protection control.** The
   tool is offered to visitors in India. The parsing itself never leaves the
   browser, and the records of a gazette are shown to whoever opened the file
   in their own browser.

## Privacy

* The gazette is parsed in the browser. No file, no extracted text and no
  candidate record is sent to a server.
* Nothing is written to a log, a cookie, local storage or a database.
* Aggregate analytics never contain a name or a roll number.
* The student tables and the exports show the name and the roll number that
  your own file prints, because the file is already on your device and nothing
  leaves the browser. **A downloaded export is personal data: treat it as
  confidential.**
* Nothing is ever published: no candidate data reaches a page, a URL, a log,
  a search engine or a training set.
* "Delete all data" clears the analysis, and closing the tab removes it.
