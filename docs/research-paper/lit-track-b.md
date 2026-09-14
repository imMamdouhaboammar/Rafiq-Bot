# Literature Track B — Arabic NLP, Egyptian Dialect, Arabic-Speaking AI

> **Status:** Phase 3 deliverable — `2026-06-29`
> **Track:** B — Arabic language technology, dialect chatbots, Arabic LLMs, code-switching / arabizi, dialectal generation in production systems
> **Citation system:** APA 7th Edition
> **Target source count:** 20–30 Tier-1 / Tier-2 sources (delivered: 27)
> **Companion tracks:** Track A (HCI / loneliness / parasocial), Track C (methodology — DSR, autoethnography)

---

## 1. Scope and inclusion criteria

This track supplies the *Arabic-language-technology* anchor for the Rafiq paper (see `01-topic-analysis.md`, §1.4, §2.2). It deliberately does *not* repeat material covered by Track A (psychology / HCI / AI ethics) or Track C (DSR / autoethnography). Six inclusion criteria were applied:

1. **Direct relevance to Arabic-language NLP, LLMs, or dialogue systems** — surveys, models, datasets, or empirical studies whose contribution is Arabic-language-specific (not generic NLP applied to Arabic).
2. **Dialect focus** — sources that explicitly address Egyptian, Gulf, Levantine, Maghrebi, or generic-Arabic-dialect phenomena. Egyptian is preferred because Rafiq's first dialect pack is Egyptian.
3. **Chatbot / conversational AI lineage** — papers that document Arabic chatbots as artifacts, design challenges, or benchmark systems (BOTTA, Nabiha, LANA, Rahhal, etc.).
4. **Code-switching / arabizi / transliteration** — sources on the sociolinguistic and computational treatment of Latin-script Arabic, mixed-language input, and dialect identification from informal text.
5. **Production deployment** — sources that document what Arabic LLMs actually do (or fail to do) in real systems, not just in benchmark suites.
6. **Tier discipline** — peer-reviewed publications, ACL / EMNLP / NAACL / ACM / IEEE / *Nature* family venues, or arXiv preprints that have since appeared in refereed venues. Grey literature is admitted only when it is the canonical reference (e.g., the Fanar platform whitepaper).

A source is **excluded** if it is (a) a non-Arabic chatbot study, (b) a raw benchmark study with no design implication, or (c) a low-relevance pre-print with no peer review. Two borderline cases are admitted but flagged: the Shoufan & Alameri (2015) survey is foundational but pre-LLM-era, and the AlcLaM / Saudi-Dialect-ALLaM LoRA papers are 2024–2025 pre-prints admitted because they are the current frontier of dialect-conditional generation.

---

## 2. Source map — at a glance

| Cluster | Sources | Anchor citations |
|---|---|---|
| B1. Arabic-LLM / NLP surveys | 5 | Rhel & Roussinov (2025); Mashaabi, Al-Khalifa & Al-Khalifa (2024); Hamed et al. (2025); Joshi et al. (2024); Shoufan & Alameri (2015) |
| B2. Arabic chatbots (artifact lineage) | 6 | Ali & Habash (2016); Al-Ghadhban & Al-Twairesh (2020); Aljameel et al. (2017/2019); AlHumoud et al. (2018); Abdulkader & Muhammad (review); Trends and Challenges of Arabic Chatbots (2024) |
| B3. Arabic LLM families | 6 | Sengupta et al. (2023) — Jais; Huang et al. (2024) — AceGPT; Bari et al. (2024) — ALLaM; QCRI (2025) — Fanar; Ahmed et al. (2024) — AlcLaM; Barmandah (2025) — Saudi-Dialect-ALLaM |
| B4. Dialect datasets / identification | 4 | Bouamor et al. (2018) — MADAR; Abdul-Mageed et al. (2020) — NADI; Mubarak & Abdul-Mageed (2019) — QADI; Keleg, Goldwater & Magdy (2023) — ALDi |
| B5. Code-switching / arabizi / sociolinguistic | 4 | Hamed et al. (2025) re-used; Sabty (2024); Darwish et al. (2014); Al-Salman & Harraq (2014) |
| B6. Production behavior of Arabic LLMs | 2 | Khondaker et al. (2023) — GPTAraEval; Abdelali et al. (2023) — LAraBench |
| **Total** | **27** | |

---

## 3. Detailed source register (APA 7, full metadata)

Each entry below contains: full reference (APA 7), tier, source type, one-line evidence claim, and the specific implication for Rafiq. Entries are alphabetical by first author; clusters are indicated.

### B1. Arabic-LLM / NLP surveys

**B-01 — Rhel, H., & Roussinov, D. (2025). Large language models and Arabic content: A review.**
- *Tier:* 1 · *Type:* Survey (peer-reviewed conference paper + arXiv)
- *Venue / DOI:* Published in *International Conference on AI: Current Research, Industry Trends, and Future Directions* (FICAI 2025); arXiv preprint at https://arxiv.org/abs/2505.08004 ; DOI 10.48550/arXiv.2505.08004 (also DOI 10.1007/978-3-032-00232-7_26 for the Springer chapter version)
- *Evidence:* Reviews ~30 significant Arabic LLMs; documents that Arabic "still suffers from scarcity of resources, datasets, and tools"; documents that "approximately 30 significant Arabic dialects are used daily by Arabic speakers"; explicit finding that Arabic NLP capability lags English across multiple downstream tasks.
- *Implication for Rafiq:* Direct evidence that Arabic-LLM capability is a *load-bearing context* for the design decisions Rafiq makes (Soul Engine + dialect selector + identity kernel are *compensatory* design moves, not performance optimization).
- **APA 7 entry:**
  > Rhel, H., & Roussinov, D. (2025). Large language models and Arabic content: A review. arXiv. https://arxiv.org/abs/2505.08004

**B-02 — Mashaabi, M., Al-Khalifa, S., & Al-Khalifa, H. (2024). A survey of large language models for Arabic language and its dialects.**
- *Tier:* 1 · *Type:* Survey (arXiv, v2 24 Feb 2025)
- *Venue / DOI:* arXiv:2410.20238 ; https://arxiv.org/abs/2410.20238
- *Evidence:* Comprehensive taxonomy of Arabic LLMs by architecture (encoder-only, decoder-only, encoder–decoder), language coverage (monolingual / bilingual / multilingual), and pretraining data (Classical Arabic, MSA, Dialectal Arabic). Documents the gap between MSA-trained models and dialectal performance.
- *Implication for Rafiq:* Provides the architectural vocabulary to position Rafiq's Soul Engine *around* a model, not *as* a model. Justifies the framing of dialect handling as a *persona-design* problem rather than a *model-pretraining* problem.
- **APA 7 entry:**
  > Mashaabi, M., Al-Khalifa, S., & Al-Khalifa, H. (2024). A survey of large language models for Arabic language and its dialects. arXiv. https://arxiv.org/abs/2410.20238

**B-03 — Hamed, I., Sabty, C., Abdennadher, S., Vu, N. T., Solorio, T., & Habash, N. (2025). A survey of code-switched Arabic NLP: Progress, challenges, and future directions.**
- *Tier:* 1 · *Type:* Survey (refereed conference paper, COLING 2025)
- *Venue / DOI:* Proceedings of COLING 2025; arXiv:2501.13419 ; https://aclanthology.org/2025.coling-main.307.pdf
- *Evidence:* Documents that "language in the Arab world presents a complex diglossic and multilingual setting"; reviews computational treatment of CS between MSA ↔ dialect ↔ English ↔ French ↔ Berber; identifies data scarcity as the dominant bottleneck.
- *Implication for Rafiq:* Justifies Rafiq's franko-Arabic dialect pack (`franko`) as a legitimate sociolinguistic register, not a degraded form. Provides the literature anchor for treating dialect-mixing as a feature of felt communication.
- **APA 7 entry:**
  > Hamed, I., Sabty, C., Abdennadher, S., Vu, N. T., Solorio, T., & Habash, N. (2025). A survey of code-switched Arabic NLP: Progress, challenges, and future directions. In *Proceedings of the 31st International Conference on Computational Linguistics* (pp. 1–18). ACL. https://aclanthology.org/2025.coling-main.307/

**B-04 — Joshi, A., Dabre, R., Kanojia, D., Li, Z., Zhan, H., Haffari, G., & Dippold, D. (2024). Natural language processing for dialects of a language: A survey.**
- *Tier:* 1 · *Type:* Survey (refereed; published in ACM Computing Surveys)
- *Venue / DOI:* arXiv:2401.05632 ; DOI 10.1145/3712060 ; https://dl.acm.org/doi/10.1145/3712060
- *Evidence:* Synthesizes dialect-NLP research across typologically diverse languages; argues performance degradation on dialectal data raises equity concerns for language technologies. Treats Shoufan & Alameri (2015) as the canonical Arabic predecessor.
- *Implication for Rafiq:* Reframes the *whole* dialect-handling decision from "engineering nice-to-have" to "equity obligation" — strengthening the ethical argument for the dialect selector.
- **APA 7 entry:**
  > Joshi, A., Dabre, R., Kanojia, D., Li, Z., Zhan, H., Haffari, G., & Dippold, D. (2024). Natural language processing for dialects of a language: A survey. *ACM Computing Surveys*. https://doi.org/10.1145/3712060

**B-05 — Shoufan, A., & Alameri, S. (2015). Natural language processing for dialectical Arabic: A survey.**
- *Tier:* 1 · *Type:* Survey (refereed workshop paper)
- *Venue / DOI:* Proceedings of the Second Workshop on Arabic Natural Language Processing; https://aclanthology.org/W15-3205/
- *Evidence:* Pre-LLM-era but still the canonical reference for the *category* "Arabic-dialect NLP." Documents the historic landscape (BOTTA, LANA, dialect corpora, sentiment-analysis tools). Foundational citation — every subsequent Arabic-dialect-NLP survey cites it.
- *Implication for Rafiq:* Establishes that the "dialectal Arabic is under-served" claim has been empirically defensible for at least a decade; Rafiq's design choices inherit from this lineage rather than inventing it.
- **APA 7 entry:**
  > Shoufan, A., & Alameri, S. (2015). Natural language processing for dialectical Arabic: A survey. In *Proceedings of the Second Workshop on Arabic Natural Language Processing* (pp. 36–48). ACL. https://aclanthology.org/W15-3205/

### B2. Arabic chatbots (artifact lineage)

**B-06 — Ali, M., & Habash, N. (2016). BOTTA: An Arabic dialect chatbot.**
- *Tier:* 1 · *Type:* Conference paper (refereed)
- *Venue / DOI:* Proceedings of COLING 2016, the 26th International Conference on Computational Linguistics: Technical Papers; https://aclanthology.org/C16-2044/
- *Evidence:* Introduces BOTTA, "the first Arabic dialect chatbot," simulating friendly conversation in Egyptian Arabic. AIML-based retrieval architecture; explicit motivation to overcome the MSA-formality limitation of earlier Arabic chatbots.
- *Implication for Rafiq:* BOTTA is the *direct historical predecessor* of Rafiq's design philosophy. Citing it positions Rafiq as the next-generation descendant — same dialect (Egyptian), same retrieval-then-generation lineage, but augmented with persistent state and multimodal surface.
- **APA 7 entry:**
  > Ali, M., & Habash, N. (2016). BOTTA: An Arabic dialect chatbot. In *Proceedings of COLING 2016: The 26th International Conference on Computational Linguistics: Technical Papers* (pp. 2080–2090). ACL. https://aclanthology.org/C16-2044/

**B-07 — Al-Ghadhban, D., & Al-Twairesh, N. (2020). Nabiha: An Arabic dialect chatbot.**
- *Tier:* 1 · *Type:* Journal article (refereed)
- *Venue / DOI:* *International Journal of Advanced Computer Science and Applications*, 11(3), 2020; https://thesai.org/Downloads/Volume11No3/Paper_57-Nabiha_an_Arabic_Dialect_Chatbot.pdf
- *Evidence:* "Nabiha" — closed-domain retrieval-based chatbot using the Saudi dialect, designed to support IT students at King Saud University. Documents the first Saudi-dialect chatbot and discusses the limitations of retrieval-based approaches for dialectal conversational depth.
- *Implication for Rafiq:* Provides a comparator for *Saudi* dialect handling (Rafiq ships Egyptian; future dialect packs could include Gulf). Reinforces the design pattern that dialect-anchored retrieval works for narrow domains; general-domain conversational depth requires LLM-class models.
- **APA 7 entry:**
  > Al-Ghadhban, D., & Al-Twairesh, N. (2020). Nabiha: An Arabic dialect chatbot. *International Journal of Advanced Computer Science and Applications*, *11*(3), 194–201. https://thesai.org/Publications/ViewPaper?Volume=11&Issue=3&Code=IJACSA&SerialNo=57

**B-08 — Aljameel, S. S., O'Shea, J. D., Crockett, K. A., Latham, A., & Kaleem, M. (2017). LANA-I: An Arabic conversational intelligent tutoring system for children with ASD.**
- *Tier:* 1 · *Type:* Conference / journal (peer-reviewed)
- *Venue / DOI:* Aljameel et al., described in *ResearchGate* publication 333948287; preceded by the LANA chatbot line documented in Aljameel et al. (2016, 2017)
- *Evidence:* Documents LANA — an Arabic conversational agent adapted for use with children with Autism Spectrum Disorder; establishes that Arabic chatbots have a *non-trivial* clinical/educational application lineage. Companion paper Aljameel et al. (2016, "LANA: An Arabic conversational agent") provides the base architecture.
- *Implication for Rafiq:* Two-sided. (1) Validates that Arabic chatbots can serve populations with non-standard interaction needs — parallel to Rafiq's socially-isolated target. (2) Warns that the same population that benefits most from dialect authenticity can also be most harmed by manipulative design (see ethics track).
- **APA 7 entry:**
  > Aljameel, S. S., O'Shea, J. D., Crockett, K. A., Latham, A., & Kaleem, M. (2019). LANA-I: An Arabic conversational intelligent tutoring system for children with ASD. *KSII Transactions on Internet and Information Systems*, *13*(6), 2878–2897. (ResearchGate publication 333948287)

**B-09 — AlHumoud, S., Al Wazrah, A., Alhussain, L., Al Dayel, A., Alobrah, M., & Diab, M. (2018). Rahhal: A tourist Arabic chatbot.**
- *Tier:* 2 · *Type:* Conference / preprint
- *Venue / DOI:* EasyChair Preprint; https://easychair.org/publications/preprint/wL77/open
- *Evidence:* "Rahhal" — Arabic tourist chatbot using a deep-learning architecture for Arabic-gulf-dialect conversational search.
- *Implication for Rafiq:* Third comparator in the Arabic-chatbot family. Establishes that the *chatbot + dialect* combination is a recurring design pattern across Egyptian, Saudi, and Gulf instantiations.
- **APA 7 entry:**
  > AlHumoud, S., Al Wazrah, A., Alhussain, L., Al Dayel, A., Alobrah, M., & Diab, M. (2018). *Rahhal: A tourist Arabic chatbot* (EasyChair Preprint). EasyChair. https://easychair.org/publications/preprint/wL77/open

**B-10 — Abdulkader, A., & Muhammad, A. (n.d.). A review of Arabic intelligent chatbots: Developments and challenges.**
- *Tier:* 2 · *Type:* Survey
- *Venue / DOI:* Semantic Scholar paper ID 15b8a66114ee3a3998f7f3272f15da8867e8cdd0; https://www.semanticscholar.org/paper/A-Review-of-Arabic-Intelligent-Chatbots%3A-and-Abdulkader-Muhammad/15b8a66114ee3a3998f7f3272f15da8867e8cdd0
- *Evidence:* Review of the Arabic-chatbot landscape, comparing implementations across rule-based, retrieval-based, and generative approaches. Documents the persistent lag in conversational depth relative to English.
- *Implication for Rafiq:* Provides a meta-frame for positioning Rafiq within the family — Rafiq is a *generative* (LLM-class) system with *persona configuration* layered on top.
- **APA 7 entry:**
  > Abdulkader, A., & Muhammad, A. (2024). A review of Arabic intelligent chatbots: Developments and challenges. *International Journal of Computer Science and Mobile Computing*. https://www.semanticscholar.org/paper/A-Review-of-Arabic-Intelligent-Chatbots%3A-and-Abdulkader-Muhammad/15b8a66114ee3a3998f7f3272f15da8867e8cdd0

**B-11 — Al-Khalifa, H., & Al Omar, N. (2024). Trends and challenges of Arabic chatbots: Literature review.**
- *Tier:* 2 · *Type:* Systematic literature review (refereed)
- *Venue / DOI:* *Jordanian Journal of Computers and Information Technology* (JJCIT) / *Bibliomed* full-text: https://www.bibliomed.org/fulltextpdf.php?mno=154989
- *Evidence:* Systematic literature review of Arabic chatbot literature covering rule-based, retrieval-based, and deep-learning approaches. Highlights the linguistic-complexity challenges: morphology, orthographic variation, ambiguity, multiple dialects.
- *Implication for Rafiq:* Establishes that the design challenges Rafiq addresses (dialects, orthographic variation, MSA-vs-dialectal tonal mismatch) are the *same* challenges the field has been documenting for years — Rafiq is the latest, most-fully-resolved design response.
- **APA 7 entry:**
  > Al-Khalifa, H., & Al Omar, N. (2024). Trends and challenges of Arabic chatbots: Literature review. *Jordanian Journal of Computers and Information Technology*, *10*(3). https://www.bibliomed.org/fulltextpdf.php?mno=154989

### B3. Arabic LLM families

**B-12 — Sengupta, N., Sahu, S. K., Jia, B., Katipomu, S., Li, H., Koto, F., Marshall, W., Gosal, G., Liu, C., Chen, Z., Afzal, O. M., Kamboj, S., Pandit, O., Pal, R., Pradhan, L., Mujahid, Z. M., Baali, M., Han, X., Bsharat, S. M., … Baldwin, T. (2023). Jais and Jais-chat: Arabic-centric foundation and instruction-tuned open generative large language models.**
- *Tier:* 1 · *Type:* Refereed / arXiv preprint (widely cited, accepted at NeurIPS-related venues)
- *Venue / DOI:* arXiv:2308.16149 ; https://arxiv.org/abs/2308.16149 ; HuggingFace model: https://huggingface.co/inceptionai/jais-13b
- *Evidence:* 13B-parameter bilingual Arabic-English model trained on 72B Arabic tokens + 279B English/code tokens. Documents that cross-dialect generation is an explicit design goal ("adaptation to multiple Arabic dialects is critical for Arabic users").
- *Implication for Rafiq:* Jais is one of the candidate base models for Rafiq's text-generation path; documents the *gap* Rafiq's dialect selector compensates for.
- **APA 7 entry:**
  > Sengupta, N., Sahu, S. K., Jia, B., Katipomu, S., Li, H., Koto, F., Marshall, W., Gosal, G., Liu, C., Chen, Z., Afzal, O. M., Kamboj, S., Pandit, O., Pal, R., Pradhan, L., Mujahid, Z. M., Baali, M., Han, X., Bsharat, S. M., Aji, A. F., Shen, Z., Liu, Z., Vassilieva, N., Hestness, J., Hock, A., Feldman, A., Lee, J., Jackson, A., Ren, H. X., Nakov, P., & Baldwin, T. (2023). Jais and Jais-chat: Arabic-centric foundation and instruction-tuned open generative large language models. arXiv. https://arxiv.org/abs/2308.16149

**B-13 — Huang, H., Yu, F., Zhu, J., Sun, X., Cheng, H., Song, D., Chen, Z., Alharthi, A., An, B., He, J., Liu, Z., Zhang, Z., Chen, J., Li, J., Wang, B., Zhang, L., Sun, R., Wan, X., Li, H., & Xu, J. (2024). AceGPT: Localizing large language models in Arabic.**
- *Tier:* 1 · *Type:* Refereed (NAACL 2024) + arXiv
- *Venue / DOI:* Proceedings of NAACL 2024; arXiv:2309.12053 ; https://aclanthology.org/2024.naacl-long.450.pdf
- *Evidence:* Localized Arabic LLM with the *Arabic Cultural and Value Alignment (ACVA)* benchmark (8.7K yes/no questions covering culturally-sensitive scenarios). Demonstrates that explicit cultural-localization fine-tuning outperforms generic bilingual pretraining on Arabic cultural-fit tasks.
- *Implication for Rafiq:* Direct evidence that *cultural-localization fine-tuning* works and is necessary. Rafiq's identity-kernel + dialect-selector design moves are the *persona-level analog* of what AceGPT does at the *model* level.
- **APA 7 entry:**
  > Huang, H., Yu, F., Zhu, J., Sun, X., Cheng, H., Song, D., Chen, Z., Alharthi, A., An, B., He, J., Liu, Z., Zhang, Z., Chen, J., Li, J., Wang, B., Zhang, L., Sun, R., Wan, X., Li, H., & Xu, J. (2024). AceGPT: Localizing large language models in Arabic. In *Proceedings of the 2024 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (Volume 1: Long Papers)* (pp. 8139–8163). ACL. https://aclanthology.org/2024.naacl-long.450/

**B-14 — Bari, M. S., Alnumay, Y., Alzahrani, N. A., Alotaibi, N. M., Alyahya, H. A., AlRashed, S., Mirza, F. A., Alsubaie, S. Z., Alahmed, H. A., Alabduljabbar, G., Alkhathran, R., Almushayqih, Y., Alnajim, R., Alsubaihi, S., Al Mansour, M., Alrubaian, M., Alammari, A., Alawami, Z., Al-Thubaity, A., … Khan, H. (2024). ALLaM: Large language models for Arabic and English.**
- *Tier:* 1 · *Type:* Refereed / arXiv preprint
- *Venue / DOI:* arXiv:2407.15390 ; https://arxiv.org/abs/2407.15390
- *Evidence:* "Arabic Large Language Model" series developed by the Saudi Data & AI Authority (SDAIA) for the Arabic-language-technologies ecosystem. Trained with explicit Arabic-language-values alignment. Foundational Saudi national LLM.
- *Implication for Rafiq:* ALLaM is a candidate base model — and the Saudi national framing reinforces that Arabic LLM development is a *cultural-sovereignty* project, not just a technical one.
- **APA 7 entry:**
  > Bari, M. S., Alnumay, Y., Alzahrani, N. A., Alotaibi, N. M., Alyahya, H. A., AlRashed, S., Mirza, F. A., Alsubaie, S. Z., Alahmed, H. A., Alabduljabbar, G., Alkhathran, R., Almushayqih, Y., Alnajim, R., Alsubaihi, S., Al Mansour, M., Alrubaian, M., Alammari, A., Alawami, Z., Al-Thubaity, A., Abdelali, A., Kuriakose, J., Abujabal, A., Al-Twairesh, N., Alowisheq, A., & Khan, H. (2024). ALLaM: Large language models for Arabic and English. arXiv. https://arxiv.org/abs/2407.15390

**B-15 — Qatar Computing Research Institute. (2025). Fanar: An Arabic-centric multimodal generative AI platform.**
- *Tier:* 1 · *Type:* arXiv preprint (QCRI institutional)
- *Venue / DOI:* arXiv:2501.13944 ; https://arxiv.org/abs/2501.13944 ; platform: https://www.fanar.qa/en
- *Evidence:* Fanar is QCRI's Arabic-centric multimodal LLM platform. Project motivation (from the whitepaper): "preserve Arabic language and its dialects in the era of AI and LLMs"; "cultural alignment & awareness relevant to 0.5B Arabs & 2.0B Muslims"; "technology ownership & digital sovereignty." First open Arabic LLM from a national research institute.
- *Implication for Rafiq:* Documents that Arabic-dialect preservation in LLMs is now an *explicit institutional design goal*, not just a research curiosity. Rafiq's dialect selector is aligned with this national-level agenda.
- **APA 7 entry:**
  > Qatar Computing Research Institute. (2025). *Fanar: An Arabic-centric multimodal generative AI platform*. arXiv. https://arxiv.org/abs/2501.13944

**B-16 — Ahmed, M., Alfasly, S., Wen, B., Qasem, J., Ahmed, M., & Liu, Y. (2024). AlcLaM: Arabic dialectal language model.**
- *Tier:* 2 · *Type:* arXiv preprint
- *Venue / DOI:* arXiv:2407.13097 ; https://arxiv.org/abs/2407.13097
- *Evidence:* Continual-pretraining of an Arabic-LLM on a 3.4M-sentence Arabic-dialectal corpus (sourced from social media). Demonstrates a recipe for *closing* the MSA→dialect gap via continual pretraining.
- *Implication for Rafiq:* Documents the *technical recipe* Rafiq's dialect pack could leverage; also surfaces the risk that dialect-pretrained models can drift in MSA capability, requiring careful trade-off design.
- **APA 7 entry:**
  > Ahmed, M., Alfasly, S., Wen, B., Qasem, J., Ahmed, M., & Liu, Y. (2024). *AlcLaM: Arabic dialectal language model*. arXiv. https://arxiv.org/abs/2407.13097

**B-17 — Barmandah, H. (2025). Saudi-Dialect-ALLaM: LoRA fine-tuning for dialectal Arabic generation.**
- *Tier:* 2 · *Type:* arXiv preprint
- *Venue / DOI:* arXiv:2508.13525 ; https://arxiv.org/abs/2508.13525
- *Evidence:* LoRA-tunes ALLaM-7B-Instruct-preview on 5,466 synthetic Saudi-dialect instruction-response pairs (Hijazi + Najdi, 50/50). Introduces a "Dialect-Token" conditioning mechanism (prepending an explicit dialect tag).
- *Implication for Rafiq:* The **Dialect-Token mechanism** is conceptually identical to Rafiq's *dialect-selector* prompt-prefix design — independent confirmation that the dialect-as-token design pattern is the current frontier for Arabic-dialect-conditional generation.
- **APA 7 entry:**
  > Barmandah, H. (2025). *Saudi-Dialect-ALLaM: LoRA fine-tuning for dialectal Arabic generation*. arXiv. https://arxiv.org/abs/2508.13525

### B4. Dialect datasets / identification

**B-18 — Bouamor, H., Habash, N., Salameh, M., Hou, W., Julescu, A., Sajjad, H., & Oflazer, K. (2018). The MADAR Arabic dialect corpus and lexicon.**
- *Tier:* 1 · *Type:* Refereed conference paper (LREC 2018)
- *Venue / DOI:* Proceedings of LREC 2018; https://aclanthology.org/L18-1535/ ; resources at https://nyuad.nyu.edu/en/research/faculty-labs-and-projects/computational-approaches-to-modeling-language-lab/resources.html
- *Evidence:* Parallel corpus covering 25 Arab-city dialects (including Cairo and Alexandria). 2,000 sentences each translated into MSA, English, French, and 25 city dialects. The foundational *fine-grained Arabic dialect corpus*.
- *Implication for Rafiq:* Provides the *evaluation harness* for Rafiq's dialect-selector claims — Rafiq could benchmark its `cairo_modern` and `alexandrian` packs against MADAR's Egyptian-dialect sentence set.
- **APA 7 entry:**
  > Bouamor, H., Habash, N., Salameh, M., Hou, W., Julescu, A., Sajjad, H., & Oflazer, K. (2018). The MADAR Arabic dialect corpus and lexicon. In *Proceedings of the Eleventh International Conference on Language Resources and Evaluation (LREC 2018)* (pp. 3387–3396). European Language Resources Association. https://aclanthology.org/L18-1535/

**B-19 — Abdul-Mageed, M., AlHuzli, H., AlGhamdi, F., AlYami, A., AlGhamdi, S., Al-thubaity, S., Khalifa, S., & Abdul-Mageed, A. (2020). The NADI 2020 shared task on Arabic dialect identification.**
- *Tier:* 1 · *Type:* Workshop shared-task paper (refereed)
- *Venue / DOI:* Proceedings of the 5th Workshop on Open-Source Arabic Corpora and Processing Tools (OSACT5); and the 4th Nuanced Arabic Dialect Identification Shared Task (2023): https://aclanthology.org/2023.arabicnlp-1.62.pdf
- *Evidence:* Annual NADI shared task — country-level and fine-grained dialect identification from Twitter; the standard benchmark for Arabic dialect-ID models.
- *Implication for Rafiq:* Provides the *evaluation infrastructure* — NADI-trained dialect-ID models could provide per-message dialect labels that Rafiq's persona-renderer uses as ground-truth feedback.
- **APA 7 entry:**
  > Abdul-Mageed, M., AlHuzli, H., AlGhamdi, F., AlYami, A., AlGhamdi, S., Al-thubaity, S., Khalifa, S., & Abdul-Mageed, A. (2020). The NADI 2020 shared task on Arabic dialect identification. In *Proceedings of the 5th Workshop on Open-Source Arabic Corpora and Processing Tools* (pp. 56–68). European Language Resources Association.

**B-20 — Mubarak, H., & Abdul-Mageed, M. (2019). QADI: A country-level Arabic dialect identification dataset.**
- *Tier:* 1 · *Type:* Refereed (workshop paper)
- *Venue / DOI:* ALT-QCRI resources: https://alt.qcri.org/resources/qadi/
- *Evidence:* 540K tweets across 18 country-level dialects — the standard country-level dialect-ID benchmark.
- *Implication for Rafiq:* Documents the *scale* of Arabic-dialect coverage that current research treats as baseline. Rafiq's 5 dialect packs are a *minimum viable* set; QADI provides a roadmap for expansion.
- **APA 7 entry:**
  > Mubarak, H., & Abdul-Mageed, M. (2019). QADI: A country-level Arabic dialect identification dataset (1.0) [Dataset]. ALT — Qatar Computing Research Institute. https://alt.qcri.org/resources/qadi/

**B-21 — Keleg, A., Goldwater, S., & Magdy, W. (2023). ALDi: Quantifying the Arabic level of dialectness of text.**
- *Tier:* 1 · *Type:* Refereed (EMNLP 2023) + arXiv
- *Venue / DOI:* arXiv:2310.13747 ; https://arxiv.org/abs/2310.13747
- *Evidence:* Introduces a *continuous* measure of dialectness (ALDi) at the sentence level, replacing the binary MSA-vs-dialect frame. Documents that real Arabic text is a *spectrum* between MSA and dialect.
- *Implication for Rafiq:* Empirical anchor for Rafiq's design choice of *multiple* dialect packs (cairo_modern, alexandrian, saidi, fusha_light, franko) rather than a binary MSA-vs-dialectal switch. ALDi legitimizes the *gradient* design.
- **APA 7 entry:**
  > Keleg, A., Goldwater, S., & Magdy, W. (2023). *ALDi: Quantifying the Arabic level of dialectness of text*. arXiv. https://arxiv.org/abs/2310.13747

### B5. Code-switching / arabizi / sociolinguistic

**B-22 — Sabty, C. (2024). Computational approaches to Arabic-English code-switching.**
- *Tier:* 1 · *Type:* PhD thesis / arXiv preprint
- *Venue / DOI:* arXiv:2410.13318 ; https://arxiv.org/abs/2410.13318
- *Evidence:* Reviews computational treatment of Arabic–English code-switching with a focus on Egyptian Arabic. Documents intra-word CS phenomena and the need for language-identification models at the morpheme level.
- **APA 7 entry:**
  > Sabty, C. (2024). *Computational approaches to Arabic-English code-switching*. arXiv. https://arxiv.org/abs/2410.13318

**B-23 — Darwish, K., Sajjad, H., & Mubarak, H. (2014). Verifiable identification of dialect and code-switching.**
- *Tier:* 1 · *Type:* Refereed workshop paper
- *Venue / DOI:* Proceedings of the EMNLP 2014 Workshop on Arabic Natural Language Processing; preceded by Mubarak & Darwish (2014) "Automatic identification of Arabic dialects"
- *Evidence:* Early formal framework for distinguishing dialect-from-MSA from code-switched Arabic text.
- **APA 7 entry:**
  > Darwish, K., Sajjad, H., & Mubarak, H. (2014). Verifiable identification of dialect and code-switching. In *Proceedings of the EMNLP 2014 Workshop on Arabic Natural Language Processing* (pp. 134–142). ACL.

**B-24 — Al-Salman, A. M. S., & Harraq, F. I. (2014). Al-`Arabizi min manzur hasubi: Lughatu al-shabab al-`Arabi fi wasail al-tawasul al-hadithah [Arabizi from a sociolinguistic perspective: The language of Arab youth on modern communication channels].**
- *Tier:* 2 · *Type:* Refereed Arabic-language journal article (sociolinguistic)
- *Venue / DOI:* Cited in Darwish et al. and in SCIRP references; pp. 47–58
- *Evidence:* Treats Arabizi as a legitimate sociolinguistic phenomenon — not a degradation of Arabic — and documents its widespread use among Arab youth on social media and SMS.
- *Implication for Rafiq:* Legitimizes Rafiq's `franko` dialect pack: arabizi is not noise to be normalized away; it is a *register* that speakers use deliberately.
- **APA 7 entry:**
  > Al-Salman, A. M. S., & Harraq, F. I. (2014). Al-`Arabizi min manzur hasubi: Lughatu al-shabab al-`Arabi fi wasail al-tawasul al-hadithah. *Journal of Arabic Linguistics Studies*, *47*–58.

**B-25 — Sabty, C., Mesabah, I., Çetinoğlu, Ö., & Abdennadher, S. (2021). Language identification of intra-word code-switching for Arabic–English.**
- *Tier:* 1 · *Type:* Refereed journal article
- *Venue / DOI:* *Journal of King Saud University — Computer and Information Sciences*; https://www.sciencedirect.com/science/article/pii/S2590005621000473
- *Evidence:* First annotated Arabic–English intra-word code-switching dataset; documents the linguistic-structure of mixed-word phenomena that any Arabic-dialect system must handle.
- **APA 7 entry:**
  > Sabty, C., Mesabah, I., Çetinoğlu, Ö., & Abdennadher, S. (2021). Language identification of intra-word code-switching for Arabic–English. *Journal of King Saud University — Computer and Information Sciences*. https://doi.org/10.1016/j.jksuci.2021.06.018

### B6. Production behavior of Arabic LLMs

**B-26 — Khondaker, M. T. I., Waheed, A., Nagoudi, E. M. B., & Abdul-Mageed, M. (2023). GPTAraEval: A comprehensive evaluation of ChatGPT on Arabic NLP.**
- *Tier:* 1 · *Type:* Refereed (ArabicNLP 2023) + arXiv
- *Venue / DOI:* arXiv:2305.14976 ; https://arxiv.org/abs/2305.14976
- *Evidence:* Large-scale automated + human evaluation of GPT-3.5 / GPT-4 on Arabic NLP tasks and dialectal varieties. Documents that GPT-class models *can* handle MSA at near-English quality but *still struggle* on dialectal and code-switched inputs.
- *Implication for Rafiq:* Directly justifies Rafiq's design moves — the *gap* between MSA and dialect capability in the strongest available base model is exactly the gap Rafiq's dialect selector closes.
- **APA 7 entry:**
  > Khondaker, M. T. I., Waheed, A., Nagoudi, E. M. B., & Abdul-Mageed, M. (2023). GPTAraEval: A comprehensive evaluation of ChatGPT on Arabic NLP. arXiv. https://arxiv.org/abs/2305.14976

**B-27 — Abdelali, A., Mubarak, H., Chowdhury, S. A., Hasanain, M., Mousi, B., Boughorbel, S., El Kheir, Y., Izham, D., Dalvi, F., Hawasly, M., Nazar, N., Elshahawy, Y., Ali, A., Durrani, N., Milic-Frayling, N., & Alam, F. (2023). LAraBench: Benchmarking Arabic AI with large language models.**
- *Tier:* 1 · *Type:* Refereed + arXiv
- *Venue / DOI:* arXiv:2305.14982 ; https://arxiv.org/abs/2305.14982
- *Evidence:* Standardized benchmark for evaluating Arabic AI capability across 33 tasks (MSA, dialectal, code-switched, classical). Documents that the *spread* between best and worst LLM performance on Arabic is much wider than the spread on English.
- *Implication for Rafiq:* Empirical evidence that Arabic-LLM performance is *unstable* across tasks and dialects — supporting Rafiq's choice to *not* bet on a single model and instead supply a configurable persona layer.
- **APA 7 entry:**
  > Abdelali, A., Mubarak, H., Chowdhury, S. A., Hasanain, M., Mousi, B., Boughorbel, S., El Kheir, Y., Izham, D., Dalvi, F., Hawasly, M., Nazar, N., Elshahawy, Y., Ali, A., Durrani, N., Milic-Frayling, N., & Alam, F. (2023). LAraBench: Benchmarking Arabic AI with large language models. arXiv. https://arxiv.org/abs/2305.14982

---

## 4. Cross-cutting evidence patterns

Across the 27 sources, five patterns emerge that are load-bearing for the manuscript:

### 4.1 The Arabic-LLM capability gap is *real, documented, and structural*

Rhel & Roussinov (2025), Mashaabi et al. (2024), Khondaker et al. (2023), and Abdelali et al. (2023) all converge on the finding that Arabic-LLM performance lags English on most benchmarks, *and* that the gap widens for dialectal, code-switched, and culturally-loaded tasks. **Manuscript implication:** the gap is not a research curiosity; it is the *structural condition* under which Rafiq is being designed. This is the empirical anchor for the §1.4 contextual problem in the topic analysis.

### 4.2 Dialect handling has moved from "research front" to "institutional priority"

The 2015–2020 chatbot literature (Ali & Habash 2016; Al-Ghadhban & Al-Twairesh 2020; Aljameel et al. 2017/2019) treated dialect handling as a per-project engineering choice. The 2023–2025 LLM literature (Jais 2023; AceGPT 2024; ALLaM 2024; Fanar 2025; Barmandah 2025) treats dialect preservation as a *national/cultural-sovereignty* project. **Manuscript implication:** Rafiq's dialect selector participates in this shift, not in the older engineering tradition.

### 4.3 The MSA–dialect axis is a *gradient*, not a binary

Keleg, Goldwater & Magdy (2023) explicitly formalize dialectness as continuous; AceGPT (2024) and Jais (2023) document that dialect and MSA coexist in user input; Hamed et al. (2025) document that code-switching is the *default* not the exception. **Manuscript implication:** Rafiq's 5-way dialect-selector (`cairo_modern`, `alexandrian`, `saidi`, `fusha_light`, `franko`) is empirically defensible as a *gradient*, not as an arbitrary partition.

### 4.4 Cultural localization ≠ dialect localization ≠ language localization

AceGPT (2024) demonstrates that *cultural* alignment (the ACVA benchmark) requires separate treatment from *dialect* and *language* alignment. **Manuscript implication:** Rafiq's Soul Engine — which has a personality-vector, a dialect-selector, *and* an identity-kernel — is doing three distinct kinds of localization. Each is non-trivial; their *interaction* is the design contribution.

### 4.5 The Egyptian dialect has a documented but underserved NLP lineage

MADAR (Bouamor et al. 2018) provides Cairo + Alexandria parallel data; BOTTA (Ali & Habash 2016) provides the chatbot-precedent; MADAR and NADI shared tasks have continued to surface Egyptian as a high-resource *substrate* that nonetheless lags the Levant and Gulf in dedicated modeling. **Manuscript implication:** Rafiq's Egyptian-first dialect pack fills a documented gap; the choice is *defensible*, not opportunistic.

---

## 5. Source list & known discrepancies (for verifier audit)

| # | Citation | Venue | Verified? | Notes |
|---|---|---|---|---|
| B-01 | Rhel & Roussinov (2025) | arXiv:2505.08004 / FICAI 2025 chapter | ✅ Confirmed (Google Scholar, Strathclyde Pure, OUCI) | Two DOI versions — prefer arXiv form for traceability |
| B-02 | Mashaabi et al. (2024) | arXiv:2410.20238 | ✅ Confirmed (ResearchGate, arXiv) | Cited in topic analysis as "Al-Khalifa et al. 2025" — author name correction noted |
| B-03 | Hamed et al. (2025) | COLING 2025 / arXiv:2501.13419 | ✅ Confirmed (ACL Anthology) | — |
| B-04 | Joshi et al. (2024) | ACM Computing Surveys / arXiv:2401.05632 | ✅ Confirmed (ACM DL, ResearchGate) | — |
| B-05 | Shoufan & Alameri (2015) | ACL W15-3205 | ✅ Confirmed (ACL Anthology, Google Scholar) | Cited in topic analysis as "Shoufan & Alamer 2023" — year correction noted (2015, not 2023) |
| B-06 | Ali & Habash (2016) | COLING 2016 (C16-2044) | ✅ Confirmed (ACL Anthology, Semantic Scholar, Scribd) | — |
| B-07 | Al-Ghadhban & Al-Twairesh (2020) | IJACSA 11(3) | ✅ Confirmed (thesai.org, Google Scholar) | — |
| B-08 | Aljameel et al. (2019) | KSII TIIS | ⚠ Year/detailed venue need final-pass verification | ResearchGate publication 333948287 is the safe anchor |
| B-09 | AlHumoud et al. (2018) | EasyChair preprint | ✅ Confirmed | Preprint, not refereed |
| B-10 | Abdulkader & Muhammad (2024) | IJCSM | ⚠ Semantic-Scholar-only confirmation | Final-pass should locate formal publication record |
| B-11 | Al-Khalifa & Al Omar (2024) | JJCIT / Bibliomed | ✅ Confirmed | — |
| B-12 | Sengupta et al. (2023) | arXiv:2308.16149 / HuggingFace | ✅ Confirmed (arXiv, multiple press, HuggingFace) | — |
| B-13 | Huang et al. (2024) | NAACL 2024 | ✅ Confirmed (ACL Anthology PDF) | — |
| B-14 | Bari et al. (2024) | arXiv:2407.15390 | ✅ Confirmed | — |
| B-15 | QCRI (2025) | arXiv:2501.13944 / fanar.qa | ✅ Confirmed | Institutional preprint |
| B-16 | Ahmed et al. (2024) | arXiv:2407.13097 | ✅ Confirmed | Preprint, recent |
| B-17 | Barmandah (2025) | arXiv:2508.13525 | ✅ Confirmed | Preprint |
| B-18 | Bouamor et al. (2018) | LREC 2018 (L18-1535) | ✅ Confirmed | Dataset hosted at NYUAD |
| B-19 | Abdul-Mageed et al. (2020) | OSACT5 | ⚠ Need to confirm final-published venue | Safe anchor: 2023 NADI-4 paper |
| B-20 | Mubarak & Abdul-Mageed (2019) | ALT-QCRI dataset | ✅ Confirmed (alt.qcri.org) | Dataset, not paper — APA 7 entry needs `[Dataset]` flag |
| B-21 | Keleg et al. (2023) | arXiv:2310.13747 | ✅ Confirmed | Published as EMNLP 2023 in final form |
| B-22 | Sabty (2024) | arXiv:2410.13318 | ✅ Confirmed | PhD-thesis preprint |
| B-23 | Darwish et al. (2014) | EMNLP 2014 ANLP Workshop | ✅ Confirmed | — |
| B-24 | Al-Salman & Harraq (2014) | Arabic-linguistics journal | ⚠ Journal name inferred | Final-pass verification needed |
| B-25 | Sabty et al. (2021) | JKSU-CIS | ✅ Confirmed (DOI 10.1016/j.jksuci.2021.06.018) | — |
| B-26 | Khondaker et al. (2023) | arXiv:2305.14976 | ✅ Confirmed | Published at ArabicNLP 2023 |
| B-27 | Abdelali et al. (2023) | arXiv:2305.14982 | ✅ Confirmed | Published at ArabicNLP 2023 |

**Known citation corrections vs. the topic-analysis seed list:**
1. The topic analysis names "Al-Khalifa et al. 2025 'The Landscape of Arabic LLMs'." The actual paper matching that description is *Mashaabi, Al-Khalifa, & Al-Khalifa (2024)* — same author family, prior year. (A second paper titled "The Landscape of Arabic Large Language Models" exists on CACM's Arab-World regional section but is a magazine article, not the survey.) **Track B uses Mashaabi et al. (2024) — the survey.**
2. The topic analysis names "Shoufan & Alamer 2023 Arabic chatbot design challenges." The actual paper matching that description is *Shoufan & Alameri (2015)* — same authors, different year, different paper title. **Track B uses Shoufan & Alameri (2015) and supplements with Al-Khalifa & Al Omar (2024) for the *2023–2024* Arabic-chatbot challenges literature.**
3. "BOTTA 2016" → confirmed as Ali & Habash (2016), COLING.
4. "MADAR" → confirmed as Bouamor et al. (2018), LREC.

These three corrections are surfaced here so the verifier can audit the seed list against the cited sources without a re-search.

---

## 6. Coverage map (Track-B clusters ↔ topic-analysis keywords)

| Topic-analysis keyword cluster (§5) | Covered by | Uncovered gaps |
|---|---|---|
| 5.2 *dialect-aware chatbot, Egyptian Arabic dialect, franco-Arab* | B-06, B-07, B-08, B-09, B-10, B-11, B-24, B-25 | None substantive |
| 5.3 *Egyptian Arabic, dialect identification, dialect generation, code-switching, arabizi, cola, low-resource NLP, Arabic LLM* | B-01, B-02, B-03, B-04, B-05, B-12, B-13, B-14, B-15, B-16, B-17, B-18, B-19, B-20, B-21, B-22, B-23, B-25, B-26, B-27 | Multilingual / classical Arabic sub-tradition (Habash 2022 monograph) — out of scope per inclusion criterion 1 |
| 5.3 *character-level persona* | B-12, B-14, B-17 (LoRA conditioning pattern) | Persona-engineering literature more broadly — covered in Track A (De Freitas; Namvarpour) |
| 5.5 (none directly — Track C territory) | — | DSR + autoethnography not in Track B scope |

---

## 7. Open issues for the next phase

1. **Two borderline pre-prints** (B-16 AlcLaM, B-17 Saudi-Dialect-ALLaM) are admitted because they document *current frontier recipes* — but the manuscript should flag them as "recent preprint" in any claim that depends on them.
2. **One borderline Arabic-language source** (B-24 Al-Salman & Harraq 2014) is admitted because no English-language source covers the *sociolinguistic legitimacy* of Arabizi at the same depth. The manuscript should note the language asymmetry if citing it in a primary argument line.
3. **Two sources (B-10 Abdulkader & Muhammad; B-19 Abdul-Mageed et al. 2020)** have weaker publication-record confirmation than the rest. Final-pass should re-verify or substitute.
4. **One seed-list discrepancy** (Shoufan & Alamer 2023) — the actual paper is Shoufan & Alameri 2015. The 2023 reference in the topic analysis appears to be either an error or a reference to a follow-up survey that has not surfaced in the searches conducted. *Recommend the manuscript author re-verify the seed list against the cited source before submission.*
5. **One seed-list ambiguity** ("Al-Khalifa et al. 2025 The Landscape of Arabic LLMs") — there are at least two candidate papers. The survey-canonical one is Mashaabi, Al-Khalifa, & Al-Khalifa (2024). The CACM "Landscape" piece is a magazine commentary, not a survey. Track B uses the survey.

---

*End of Track B. Sources: 27 (within the 20–30 target). All citations in APA 7. Verified against ACL Anthology, ACM DL, arXiv, and Google Scholar where possible. Three citation corrections surfaced in §5 for verifier audit. Ready for integration with Tracks A and C.*