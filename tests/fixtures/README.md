# Test fixtures

The fixtures are anonymised copies of real CBSE gazettes. The candidate names
and the roll numbers are replaced with synthetic ones and **the line lengths
are kept**, so the printed columns stay exactly where they were.

| Fixture | Examination | Layout | What it covers |
| --- | --- | --- | --- |
| `gazette-27572-2025.txt` | Class X, main, 2025 | columns | marks and grades, an absent candidate, a blank subject slot, a different subject order |
| `gazette-27572-2025-ocr.txt` | the same file | tokens | the same records with the columns lost, so the token parser is used |
| `gazette-27572-2025-errors.txt` | the same file | columns | five deliberate problems: a duplicate roll number, a status that is not in the CBSE vocabulary, a mark of 149, a subject code that was not read and a blank mark |
| `gazette-x-2025-marks-grades.txt` | Class X, main, 2025 | columns | marks and grades |
| `gazette-x-2026-marks-grades.txt` | Class X, main, 2026 | columns | marks and grades, a subject printed as `AB`, an essential repeat result |
| `gazette-x-2026-marks-only.txt` | Class X, main, 2026 | columns | the marks without any grade |
| `gazette-x-2025-compartment.txt` | Class X, compartment, 2025 | columns | only the compartment subjects, an `XXXX` result |
| `gazette-xii-2026-compartment.txt` | Class XII, compartment, 2026 | vertical | one subject per line, grades only, `XXXX` results |
| `gazette-xii-2025-compartment.txt` | Class XII, compartment, 2025 | vertical | one subject per line |

## What the fixtures prove

* Every gazette format is read: the printed class, year, session, region,
  school and gazette date, and the printed summary totals.
* The recalculated totals reproduce the printed summary exactly, for every
  format.
* The printed flags stay out of the candidate name.
* A subject printed as `AB` keeps its value and its grade, and is left out of
  the averages.
* A result printed as `XXXX` is reported as "other" and never as a pass.
* A gazette that lists only the compartment subjects keeps the empty slots.

## Rebuilding a fixture

`tests/helpers/anonymise.mjs` rebuilds a fixture from an original gazette:

```js
import { anonymiseGazette } from './tests/helpers/anonymise.mjs';
anonymiseGazette('/path/to/original.TXT', 'tests/fixtures/gazette-name.txt');
```

## Running the tests

```
npm test
```

The suite uses the Node test runner, so no test framework has to be installed.
