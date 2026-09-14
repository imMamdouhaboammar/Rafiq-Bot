# Rafiq Research Paper — Publishing Roadmap

> **Status:** Paper complete in repository Markdown. This roadmap is historical planning material and must be revalidated before acting on dates, venue rules, or submission mechanics.

---

## 1. Decision matrix

The paper sits at the intersection of four research communities. Each community has its primary venue, and a single paper cannot ship "as-is" to all four because each requires a different format (APA-7 journal article vs. SIGCHI template vs. ACL template) and a different rhetorical framing.

| Venue | Format | Page limit | Deadline (typical) | Acceptance rate | Best fit for Rafiq's |
|---|---|---|---|---|---|
| **arXiv** (cs.HC) | LaTeX preferred; PDF/HTML accepted | n/a | none | n/a | Immediate visibility, citable timestamp, defensive disclosure |
| **DIS 2027** (ACM) | SIGCHI two-column | ~9-10 pages + refs | ~September 2026 | ~24% | Design-science case study fits the workshop-to-track ethos |
| **CHI 2027** (ACM) | SIGCHI two-column | ~9-10 pages | ~September 2026 (LBW) / ~April 2027 (full) | ~26% | HCI general, but very competitive and double-blind |
| **CSCW 2027** (ACM) | SIGCHI two-column | ~9-10 pages | ~June 2026 (passed) / spring 2027 | ~24% | Sociotechnical, companion AI in group/social settings |
| **AIES 2027** (AAAI/ACM) | AAAI ethics template | ~7 pages + 1 ref page | ~January 2027 | ~32% | Ethics framing — five operationalized design moves, obligation-mapping |
| **FAccT 2027** (ACM) | ACM template | ~10 pages | ~November 2026 | ~30% | Critical-HCI angle: intimacy economy, dependency safeguards |
| **ArabicNLP 2027** (workshop @ EMNLP) | ACL template | ~6-9 pages | ~April/May 2027 | workshop | Dialect-selector design contribution + multilingual NLP framing |
| **TOCHI** (ACM journal) | APA-7 (current format) | ~30 pages | none (rolling) | ~20% | Full journal version if conference round is partial-reject |
| **AI & Society** (Springer) | Springer template | ~22 pages | none (rolling) | ~25% | Open access, "AI as compensatory companion for the isolated" framing |
| **Ethics and Information Technology** | Springer template | ~22 pages | none (rolling) | ~28% | Ethics-deep version focused on the five obligations |

**Initial strike plan (the path of least surprise):**
1. **arXiv** immediately (this week) — preprint with timestamp + visibility
2. **DIS 2027** as primary conference target — strongest design-science fit
3. **AIES 2027** as ethics-alternative, in parallel — different framing, higher acceptance probability
4. **TOCHI** as fallback journal after conference round completes — single-blind, allows autoethnographic voice

---

## 2. Autoethnographic voice vs. double-blind submission

DIS, CHI, CSCW, FAccT, AIES are all double-blind or strongly-anonymous-review-process. The current manuscript's first-person autoethnographic voice ("I built this", "I watched my own use escalate") will not anonymize cleanly.

Three options:

**Option A — Anonymize aggressively.** Replace "I built" with "the designer-as-builder," replace "I read" with "the author read," strip identifying markers (no GitHub URL until camera-ready, no date stamps, no "Rafiq v5.0" → "Rafiq v{x}"). Decision: lose some of the autoethnographic heat but keep the structure. **Best for DIS/CHI/CSCW.**

**Option B — Single-blind venue only.** Target TOCHI, AI & Society, Ethics & Information Technology — these allow the author voice because the artifact is named and the contribution is positioned as the designer's own work. **Best if you want the autoethnographic voice intact.**

**Option C — Hybrid: ethics framing bridges.** AIES and FAccT routinely accept explicitly-identified-author papers because the contribution is often the designer's own framework. Re-frame the paper as "Five Ethical Obligations for AI Companions Targeting Socially Isolated Users: An Embedded Operationalization in Rafiq" and the autoethnographic background reads as legitimate insider knowledge rather than as identifying detail.

**Recommendation:** Option A for the DIS submission (anonymized §4 + reframed §5 to step back from "I built" to "the artifact's design rationale"). Keep the un-anonymized APA-7 long-form for the journal route.

---

## 3. Immediate-next steps (this week)

### 3.1 arXiv submission

| Field | Value |
|---|---|
| **Title** | Rafiq: A Design Case Study of a Configurable, Dialect-Aware AI Companion for the Socially Isolated |
| **Authors** | Mamdouh Aboammar |
| **Affiliation** | PrePilot Research (independent) |
| **Primary category** | cs.HC (Human-Computer Interaction) |
| **Cross-list** | cs.CL (Computation and Language — for the Arabic NLP contribution), cs.CY (Computers and Society — for the ethics contribution) |
| **Abstract** | Use the existing Abstract from `05-manuscript.md` |
| **Comments** | "Manuscript in preparation for design-science venues (DIS/AIES 2027). Pre-print released under CC BY-NC-ND 4.0." |
| **License** | CC BY-NC-ND 4.0 + arXiv non-exclusive license to distribute |
| **Submission artifact** | Generate a currently supported LaTeX, PDF, or HTML artifact from the reviewed Markdown source; verify current arXiv guidance before submission |

**arXiv submission mechanics:**
1. Create arXiv account at arxiv.org (free; required for first submission)
2. ORCID strongly recommended — get one at orcid.org (free, takes 5 min)
3. Endorsement: first submission needs an endorser in cs.HC. If you don't have one, ask in the #arxiv channel on the sigchi mailing list — endorsers respond quickly.
4. Hold for moderation: 1-2 business days for the metadata, then paper goes live with the next business-day announcement.
5. Once live: arXiv DOI assigned. Update the GitHub README to link to the DOI; update the manuscript Appendix A to include the arXiv ID.

### 3.2 Submission artifact generation

The repository keeps Markdown as the review source. Generate a supported LaTeX, PDF, or HTML submission artifact separately, review the rendered result, then verify the current arXiv format rules at https://info.arxiv.org/help/submit/index.html before uploading.

### 3.3 ORCID

If you don't have one: register at https://orcid.org/register (free, 5 minutes). Add it to every future submission. Most venues require ORCID iDs now or soon.

---

## 4. Conference submission prep timeline

| Date | Action |
|---|---|
| **2026-06-29 (today)** | Roadmap doc + arXiv metadata prepared. Manuscript + .docx in repo. |
| **2026-06-30 to 07-07** | Create arXiv account, ORCID, post preprint. Address any feedback from arXiv moderators. |
| **2026-07 to 2026-08** | Compress to 10-page SIGCHI template version (DIS / CHI extension). Identify what to cut: trim §2 to 6 themes (was 10), compress §4 to 2 sub-sections, drop §6.4-6.5 limitations forward for journal extension. |
| **2026-08 to 2026-09** | Anonymization pass: replace "I" with "the designer-as-builder," strip identifying URLs, hide the GitHub pointer to "see the corresponding anonymized supplementary materials." |
| **2026-09 (target)** | Submit to **DIS 2027** (primary strike). |
| **2026-09 to 2026-10** | Submit to **AIES 2027** as ethics-framed alternative (in parallel, different writing track). |
| **2026-11** | Submit to **ArabicNLP 2027** workshop as a 6-page short paper focused on the dialect-selector contribution. |
| **2026-12 to 2027-04** | Wait for reviews (~3 months for CHI/DIS, ~2-3 months for AIES). |
| **2027-04+** | If accepted: prepare camera-ready + conference talk / poster. If rejected: revise for TOCHI journal submission with full autoethnographic voice restored. |

---

## 5. Risks and contingencies

**Risk 1 — arXiv cs.HC endorsement delay.** First submissions to cs.HC can take 3-7 business days waiting for an endorser. Mitigation: message on sigchi mailing list; most cs.HC endorsers respond within 48 hours.

**Risk 2 — DIS double-blind rejection on "I" voice.** Strong autoethnographic markers can violate anonymity. Mitigation: write the SIGCHI version with anonymized framing first; keep the un-anonymized version for AIES / TOCHI.

**Risk 3 — AIES rejection on "missing user data."** AAAI ethics track values evidence-of-effect. Rafiq has no user evaluation yet. Mitigation: position the contribution as a *framework proposal* with embedded operationalization; the population evaluation is the future work the paper opens up. Frame the contribution correctly in §6 Contribution.

**Risk 4 — ArabicNLP workshop audience mismatch.** Workshop attendees are NLP/ML researchers; design-science framing is unfamiliar. Mitigation: emphasize the empirical NLP contribution (the dialect-selector, the WhatsApp-clone pipeline as a corpus-evaluation method) and de-emphasize the HCI framing in the workshop version.

**Risk 5 — TOCHI reviewer pool on linguistic authenticity.** A reviewer may push back on Rafiq's Egyptian-first instantiation as "not generalizable." Mitigation: position this honestly as scope boundary (already in §1.7), and emphasize the dialect-selector design pattern as the contribution rather than the specific dialect.

---

## 6. What I'm building next (in this session)

- arXiv submission package (metadata + DOCX + submitting instructions)
- ACM SIGCHI LaTeX skeleton (10-page target for DIS 2027) — substantial compression of §§2-4
- Anonymization pass script (regex-based "I" → "the designer-as-builder")

Beyond the session scope: venue submissions themselves need your account credentials (arXiv, ORCID, venue submissions portal). I can prep everything; you click Submit.

---

## 7. Pre-mortem: what could go wrong

- **Anonymization leak in autoethnographic voice:** the "Disclosure 1 — the designer is also the user" passage identifies me as the same person who built Rafiq and the same person with chronic friendship-difficulty. Strip it for SIGCHI submissions.
- **Missing supplementary material:** the compressed SIGCHI version may reference a 7-page supplementary that includes the full DSR walk-through, the conceptual-model diagrams, and the autoethnographic disclosure. Allocate a week to write it.
- **Time-zone mismatch with endorsement confirmation:** arXiv endorsement requests can get stuck in inbox during weekends. Don't post pre-print on a Friday night — better to post on a Sunday evening so the endorsement workflow starts Monday morning.

---

*Last updated: 2026-06-29*
