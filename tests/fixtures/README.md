# Test fixtures

The fixtures are the CBSE Class 10 gazette of school code `27572`, examination
year `2025`, region `DELHI-WEST`, with the printed summary

```
Total candidates: 137   Total pass: 133   Compartment: 3
Essential repeat: 0     Absent: 1
```

## What was changed

The gazette contains real candidate names and roll numbers, so the fixture was
**anonymised** before it was committed:

* every candidate name was replaced with `STUDENT 001` to `STUDENT 137`;
* every roll number was replaced with a synthetic number from `92000001`;
* the school name was replaced with `ANONYMISED DEMO SCHOOL`.

Nothing else was touched. The printed layout, the column positions, the
subject codes, the marks, the grades, the result statuses, the compartment
subject codes, the blank subject slot, the absent candidate, the page headers
and the printed summary are all exactly as they were in the original file.

## The files

| File | What it is |
| --- | --- |
| `gazette-27572-2025.txt` | the anonymised gazette, the main regression fixture |
| `gazette-27572-2025-ocr.txt` | the same gazette with the column alignment removed, so the token based parser has to be used |
| `gazette-27572-2025-errors.txt` | the same gazette with five deliberate problems: a duplicated roll number, a status that is not in the CBSE vocabulary, a mark of 149, a subject code that was not read and a blank mark |

## What the fixtures prove

* `tests/regression-27572.test.js` reads the gazette and reproduces the
  printed summary exactly: 137 candidates, 133 passed, 3 compartment, 0
  essential repeat, 1 absent, 136 appeared and a pass percentage of 97.79 per
  cent of the appeared candidates.
* The same gazette read without the column alignment gives the same totals and
  a lower confidence.
* The file with the deliberate problems makes the validation report a duplicate
  roll number, an unreadable status, an implausible mark, a missing subject
  code and a missing mark.

## Running the tests

```
npm test
```

The suite uses the Node test runner, so no test framework has to be installed.
