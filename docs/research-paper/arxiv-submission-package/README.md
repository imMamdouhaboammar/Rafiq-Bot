# arXiv Submission Package — Rafiq Research Paper

This directory contains everything you need to upload the Rafiq paper to arXiv today.

## Files in this package

| File | Purpose |
|---|---|
| `README.md` | This readme — submission package contents |
| `metadata.txt` | Title / authors / abstract / categories / license — copy-paste ready for the arXiv submission form |
| `rafiq-paper.docx` | The Word manuscript — upload as-is, or convert to PDF first |
| `source-markdown.md` | Markdown source (for the supplementary file upload if you want both) |

## Submission flow

1. Create arXiv account at https://arxiv.org/login if you don't have one.
2. Create an ORCID at https://orcid.org/register if you don't have one (5 min, free).
3. Open `metadata.txt` and copy each field.
4. Go to https://arxiv.org/submit and paste the title, authors, abstract, categories, comments, license.
5. Upload `rafiq-paper.docx` (or, ideally, a converted PDF — see the PDF instructions below).
6. Submit. arXiv will hold for endorsement if this is your first cs.HC submission.

## Converting to PDF locally (preferred upload format)

arXiv prefers PDF over DOCX because PDF renders consistently across browsers and screen-readers.

**On macOS:**

Using Pages (free):
1. Open `rafiq-paper.docx` in Pages (Cmd+O, navigate to file, double-click)
2. Cmd+P to open the print dialog
3. Click the PDF dropdown → "Save as PDF"
4. Save as `rafiq-paper.pdf` in this directory

Using Word:
1. Open in Word
2. File → Save As → Format: PDF

Using Cmd+P (universal):
1. Open `rafiq-paper.docx` in any app that can print it (Word, Pages, even Quick Look + Print)
2. Cmd+P → "Save as PDF"
3. Save as `rafiq-paper.pdf`

## Post-submission

After the paper appears on arXiv (DOI assigned):
1. Update `docs/research-paper/05-manuscript.md` Appendix A — add the arXiv URL and DOI
2. Update the top-level `README.md` — add a section linking to the DOI
3. Add the DOI citation to your ORCID profile

This gives you a citable timestamp you can use in venue submissions (e.g., "[Submitted; arXiv:XXXX.XXXXX]").

## Next steps beyond arXiv

See `docs/research-paper/publishing-roadmap.md` for the full venue matrix (DIS 2027 / AIES 2027 / ArabicNLP 2027 / TOCHI) and the timeline for compressing the manuscript into a 10-page SIGCHI template for conference submission.
