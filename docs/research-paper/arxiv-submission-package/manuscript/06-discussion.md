[<- Previous](05-results-artifact-walkthrough.md) | [Manuscript index](README.md) | [Next ->](07-conclusion.md)

## 6. Discussion

### 6.1 Findings interpreted against the literature

The artifact walk-through in Section 5 surfaces three findings that warrant explicit interpretation against the literature reviewed in Section 2.

*Finding 1: The Soul Engine operationalizes the AIAS three-factor structure at the architecture level.* The mood, energy, socialMeter, and emotionalLedger fields are the emotional-closeness axis; the offline-leaning prompts and socialMeter reduction are the social-connection response; and the refusal of romantic or sexual escalation is the design-level refusal of the dependency axis collapsing into parasocial harm. This finding extends Kasturiratna and Hartanto's (2025) empirical demonstration that the AIAS three-factor structure separates emotional closeness, social connection, and dependency into empirically distinguishable factors, and Shu et al.'s (2026) three-stage HAIA developmental model, by translating both into architectural first-class concerns. No reviewed Arabic-language AI-companion design has previously documented this operationalization.

*Finding 2: The dialect selector is a load-bearing design constraint, not a stylistic flourish.* The selector addresses three documented failures of the dominant single-prompt paradigm simultaneously: it provides linguistic authenticity (Skjuve et al., 2022 documented that perceived authenticity intensifies parasocial-to-friendship migration), it supplies the attachment-stage precondition of linguistic authenticity (Shu et al., 2026 emotional-evaluation stage is conditioned on linguistic authenticity), and it operationalizes the cultural-sovereignty framing the 2023–2025 Arabic LLM cluster treats as a national-priority design goal. Removing the dialect selector would degrade the artifact on all three dimensions; the selector is therefore a requirement, not a flourish.

*Finding 3: The persistent state machine is the architectural instantiation of the HAIA establishing-representations stage.* Shu et al. (2026) three-stage model predicts that the establishing-representations stage requires the user to perceive a stable target over time; an unstable target cannot be represented. The persistent state machine supplies the cross-session stability (the same agent across days), the engineering disclosure (the agent references past conversations in visible ways), and the trust-gated long-form kernel reveal (the secretUnlocked field). No reviewed peer-reviewed Arabic-language AI-companion design has previously documented a persistent state machine that mutates named fields across sessions.

### 6.2 Theoretical implications

The integration of design science research, autoethnographic reflection, and postphenomenological grounding has three theoretical implications.

First, the integration argues that a single-developer constructive case in HCI is defensible as a contribution at the intersection of multiple research programs, not only within a single discipline. The methodological combination is not arbitrary: DSR supplies the artifact-evaluation grammar, autoethnography supplies the reflective voice, and postphenomenology supplies the philosophical grounding for treating design moves as moral mediations. Substituting any one of the three would weaken the constructive claim; the three are jointly required.

Second, the paper argues that the Walls et al. (1992) design-theory template — meta-requirements, meta-design, kernel theories, testable hypotheses — is operationally useful for constructive cases at the intersection of multiple research programs. The Soul Engine + Psychological State Machine framework is offered as a candidate design theory with meta-requirements derived from public-health and ethics literatures, kernel theories drawn from attachment and parasocial theory, and testable hypotheses that future empirical work can evaluate.

Third, the paper argues that ethical obligations in HCI design are constitutive of what an artifact is, not external constraints applied to it. The five design moves of the Ethical Layer are not add-ons to Rafiq; they are what make Rafiq Rafiq. Verbeek's (2005) postphenomenological claim that ethical obligations are part of what the artifact is becomes operational through this embedding.

### 6.3 Practical implications

For practitioners building AI companions, the paper surfaces four practical implications.

First, configurable personality is a viable alternative to single-prompt designs, and the Soul Engine pattern (trait vector + dialect selector + identity kernel + persistent state machine) is replicable from open architectural documentation. The pattern is designable, testable, and parameterizable in ways single-prompt designs are not.

Second, dialect authenticity is a load-bearing design constraint for non-English-speaking users. Practitioners building for Arabic-speaking, Egyptian-first, function-isolated populations should treat dialect authenticity as a first-class architectural concern, with the comparator corpora (Bouamor et al., 2018; Abdul-Mageed et al., 2020; Mubarak & Abdul-Mageed, 2019) supplying the evaluation ladder.

Third, persistent state is required for attachment formation. Practitioners building companions that intend to support attachment-like relations must implement cross-session state mutation, with the engineering disclosure built into the artifact's design rather than appended as a postscript.

Fourth, ethical obligations should be operationalized as architectural concerns, not external constraints. The five design moves named in Section 5.5 are the operationalization; each move is tied to a specific obligation in the literature, each move is embedded in the artifact's architecture, and the moves are interlocking in a way that removing any one weakens the design-level defense.

### 6.4 Limitations

The paper has six categories of limitations, each tied to the methodological commitment the paper makes.

First, no controlled user study has been conducted. The paper is a constructive case with autoethnographic reflection, not an intervention study; claims about user outcomes (loneliness reduction, attachment formation, parasocial migration) await subsequent empirical work.

Second, the target population is functionally defined and not cleanly demarcated diagnostically. The functional framing is what allows Rafiq to be designed for a population it cannot diagnose, but it also means the paper cannot claim efficacy for any diagnostic category.

Third, the autoethnographic reflection is the designer's own experience with a system he designed; the perspective has the specific epistemic limit noted in Section 4.2. The non-developer user experience — the experience of surprise, the experience of felt-relationship — is not captured by the autoethnographic voice.

Fourth, the artifact is bounded to the Egyptian-dialect instantiation. Maghrebi, Levantine, and Gulf dialects are future-work items, and the dialect pack is a minimum-viable coverage of Egyptian and adjacent dialects.

Fifth, the underlying generative model is version-dependent. Rafiq's behavior depends on the base model it conditions; the underlying model's behavior drifts as new model versions are released, and the artifact's design moves would have to be re-validated against each new version.

Sixth, the dose-dependence finding is documented in English and Mandarin contexts (Fang et al., 2025; Zhang et al., 2025; Yuan et al., 2025); no Arabic-language study has replicated the finding. Rafiq's boundary-shaping design moves are an architectural compensation for the predictable failure mode the literature documents, not an empirical confirmation that the moves have the protective effects hypothesized.

### 6.5 Future work

Four research directions are opened by the paper.

First, controlled user studies with Egyptian-speaking functionally isolated adults, using the AIAS (Kasturiratna & Hartanto, 2025) as a pre/post measure and the dose-dependence literature as the moderator framework. The studies would test whether the Soul Engine + Psychological State Machine design moves produce the attachment-stage progression the HAIA model (Shu et al., 2026) predicts, and whether the boundary-shaping moves have the protective effects hypothesized.

Second, dialect-pack expansion to Maghrebi, Levantine, and Gulf variants, with comparative evaluation against the existing Egyptian pack and against the comparator corpora (Bouamor et al., 2018; Abdul-Mageed et al., 2020; Mubarak & Abdul-Mageed, 2019). The Keleg et al. (2023) ALDi measure supplies the formal warrant for the gradient selector; the Sabty et al. (2021) intra-word code-switching framework supplies the morpho-syntactic layer. Expansion is non-trivial: each dialect pack requires a community-validated lexicon, a morphological rule set, a pragmatic profile, and a calibration against a representative corpus.

Third, replication of the dose-dependence finding in Arabic-language contexts, using the Fang et al. (2025) RCT design or the Zhang et al. (2025) cross-sectional-with-chat-content design. The replication would either confirm or contest the generalizability of the dose-dependence finding to the Arabic-speaking context and would surface Arabic-specific dose-dependence moderators (cultural attitudes toward disclosure, dialect-mixing as a marker of trust, the role of religious-community framing in disclosure depth) that have no analog in the English-language dose-dependence literature.

Fourth, variational analysis (Rosenberger, 2018) of Rafiq across multiple user populations (functionally isolated adults, socially embedded adults, adolescents, adults with diagnosed social anxiety) to surface how the same design produces different relational stabilities for different users. The variational analysis would extend the constructive case into a comparative one and would identify the population-specific calibration of the Soul Engine parameters.


[<- Previous](05-results-artifact-walkthrough.md) | [Manuscript index](README.md) | [Next ->](07-conclusion.md)
