# CodeNudge hackathon readiness

Technical review and recording checklist. Release evidence refreshed **October 19, 2026**; check the current linked form for submission requirements. This is preparation guidance, not submission copy or a completed submission.

## What the judges need to see

The [official rules](https://learn-ai-basics.devpost.com/rules) give equal weight to design, potential impact, innovation/idea and presentation. The deadline is **October 26, 2026, 5 pm EDT**. Use a public YouTube or Vimeo video shorter than three minutes showing the extension working in VS Code.

| Criterion | Demonstration to prioritize | Evidence still needed |
| --- | --- | --- |
| Design | One understandable journey: run → clue → changed attempt → inline hint → reviewed diff → correct result. Show that the learner controls edits. | Final hands-on pass in the recording theme/window size. |
| Potential impact | Use the small expenses example so a beginner can follow the mistake and the hint. Explain the audience and problem in your own words. | Actual learner feedback would strengthen the case; improved learning outcomes have not been measured. |
| Innovation/idea | Make effort-based help visible: unchanged runs do not advance help; changed unsuccessful attempts unlock more specific guidance. | A complete recorded live-model loop. Do not claim hint-based tutoring is itself a new invention. |
| Presentation | Keep source, hint and result readable; show the successful rerun, not just the proposed fix. | Final video, accessible link and your own narration. |

## Current evidence

- Public repository: [aatish1321/CodeNudge](https://github.com/aatish1321/CodeNudge). An unauthenticated GitHub API check confirms public access and MIT recognition.
- Approved planning documents are publicly accessible: [scope](../devpost/scope.md), [PRD](../devpost/prd.md), [spec](../devpost/spec.md).
- Local history starts with planning on October 15, followed by implementation. The public repo was created October 15. This supports the timeline; it is not independent proof of an empty starting folder.
- The source suite contains **111 tests**, including the goal-based teaching regressions. Earlier installed VS Code, Restricted Mode and live Groq stage evidence is recorded in the [verification report](../devpost/verification.md). Stage probes do not replace a complete live rehearsal.
- MIT packaging was separately verified. Version **0.0.22** is public on the [Marketplace](https://marketplace.visualstudio.com/items?itemName=aatishdev.codenudge); the registry version was checked without authentication. The published identity is `aatishdev.codenudge`.
- The maintainer reports a manual test pass. The [build checklist](../devpost/checklist.md#final-review) preserves the earlier review record; broad live-provider coverage is not established by that report. A public demo-video link has not been added yet.

## Finish in this order

1. **Record real learning with one provider/model.** Try the JavaScript `filter()` exercise in the [README](../README.md#try-a-real-learning-exercise), write your own attempt and use CodeNudge when you actually get stuck. Keep useful details: version, provider/model, expected result and actual result. The [controlled walkthrough](../examples/demo/README.md) remains available for a separate escalation check, with deliberate retries disclosed.
2. **Check the recording view.** Open a fresh playground; trust it deliberately; configure the provider before recording. Close unrelated panels and notifications, hide credentials, enlarge the text, and keep the source, CodeNudge and output visible. Use your actual editor theme. Capture a short sample and check readability and audio before the full take.
3. **Record the working main journey.** Use the shot list below. Only include Project mode if its complete live rehearsal works. Provider menus and extra examples should not displace the successful Debug result.
4. **Add real feedback if available.** Let another beginner try the same exercise with minimal prompting. Record what they did, whether the clue helped and where they got confused, with permission. Report observations accurately; do not turn one person's reaction into a claim of proven learning improvement. This is optional, not an eligibility requirement.
5. **Finish the entry yourself.** Check the current submission form, write the required answers and upload the actual video. Resolve outstanding critical feedback and confirm the candidate is ready before treating final review as complete.

Marketplace publication is complete. The challenge still requires the public repository and working demo video; the extension listing does not replace either.

## Recording shot list: target 2 minutes 30 seconds

These are screen actions and timing targets. Use your own words for the narration. Rehearse first; do not force every feature into one take.

| Time | Capture | Visible proof |
| --- | --- | --- |
| 0:00–0:15 | Show a fresh JavaScript exercise and its expected passing scores. | A beginner learning a particular concept in their editor. |
| 0:15–0:40 | Show your own attempt and run it. | Real code and the actual result, rather than a fabricated mistake. |
| 0:40–1:10 | Show a real difficulty, the clue and your next change. Include inline/diff help if genuinely reached. | Guidance helping you understand and make progress. |
| 1:10–1:30 | Show the correct result and test scores around the boundary of 50. | The completed learning task and a check beyond one input. |
| 1:30–2:00 | Optional: show a rehearsed Project idea becoming an approved small task plan. | The distinct idea-to-tasks workflow. |
| 2:00–2:15 | Show your saved attempt at that task and a nudge or review. | Coaching during real implementation; code stays yours. |
| 2:15–2:30 | Show the public README and planning links. | Reproducible setup, open source and the planning process. Explain one actual learning experience yourself. |

Trim provider wait time and repetitive edits in the final cut, with visible labels such as “Changed retry 3” and “Changed retry 6.” Preserve the actual stage thresholds and disclose deliberate unsuccessful rehearsal edits. Capture real responses; do not substitute fixtures or animated mockups for a live demonstration. If the model asks a question, include your real reply or choose a clearer rehearsed take.

For a longer take, leave margin below three minutes. Skip the optional supporting capability before shortening the successful rerun.

## Submission checks

The [organizer update](https://learn-ai-basics.devpost.com/updates) also calls out the required Skill Pack explanation, age-of-majority checkbox and repository URL in the “Try it out” field. Check the actual form for all current required fields.

- [x] Public repository and recognized open-source license.
- [x] Substantive scope, PRD and spec present in the public repo.
- [ ] Final live rehearsal and unresolved bug reports addressed.
- [ ] Final learner review confirmed; do not infer this from passing tests.
- [ ] Video shows the real extension working and is shorter than three minutes.
- [ ] Video is public on YouTube/Vimeo and accessible while signed out.
- [ ] Repository URL entered in the required form field.
- [ ] Your project description, learning reflection and Skill Pack explanation completed in your own words; actual form fields and exit survey completed.
- [ ] Eligibility checkbox answered by you; required disclosures and asset permissions checked.
- [ ] Final tracked files and intended release artifact checked for secrets/private material before any release.
- [ ] Devpost submission completed and confirmed by you.

A public Marketplace listing is verified. A final video link, user-study result and completed Devpost submission have not been recorded.
