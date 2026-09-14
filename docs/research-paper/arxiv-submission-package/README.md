# arXiv submission package - Rafiq research paper

This directory keeps the review-friendly Markdown source and submission metadata for the Rafiq research paper.

## Manuscript

The canonical review source is split into linked Markdown sections under [`manuscript/`](manuscript/README.md). Start with the manuscript index and move through the Previous / Next links.

The split source was verified against the former Word manuscript before the binary DOCX was removed from the public repository. The manuscript body from Abstract through Appendix A is preserved in order; Word-only generated layout paragraphs such as the table of contents are intentionally not part of the Markdown source.

## Package contents

| Path | Purpose |
|---|---|
| `manuscript/README.md` | Manuscript index and section navigation |
| `manuscript/00-front-matter.md` | Title, author metadata, abstract, and keywords |
| `manuscript/01-introduction.md` through `09-appendix-a.md` | Linked manuscript sections |
| `metadata.txt` | Draft metadata for an arXiv submission form |

## arXiv format note

Markdown in this repository is the maintainable review source, not an arXiv upload format. arXiv currently lists LaTeX as the preferred text submission format, followed by PDF and HTML.

Before submitting, generate a supported submission artifact and verify the current arXiv author instructions:

https://info.arxiv.org/help/submit/index.html

Do not treat repository Markdown, a DOCX export, or an old local conversion recipe as proof that a format is accepted by arXiv.

## Submission hygiene

Before any external submission:

1. Verify the title, author identity, abstract, categories, license, and repository link in `metadata.txt`.
2. Generate the final LaTeX, PDF, or HTML artifact from the reviewed manuscript.
3. Review the rendered artifact end to end.
4. Check the current arXiv submission guidelines and category requirements.
5. Keep submission credentials and account-specific information outside this repository.

## After publication

When a public arXiv identifier exists, update the manuscript artifact pointer and the repository README with the canonical public citation.
