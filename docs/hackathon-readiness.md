# CodeNudge hackathon readiness

Technical review and recording checklist, checked **October 17, 2026**. This is preparation guidance, not submission copy or a completed submission.

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
- All **107 source tests pass** in this review. Earlier installed VS Code, Restricted Mode and live Groq stage evidence is recorded in the [verification report](../devpost/verification.md). Stage probes do not replace a complete live rehearsal.
- MIT packaging was separately verified. The installed local candidate remains **0.0.16**; this preparation does not change its runtime or replace it.
- Final learner review, full live Project-mode acceptance and a public video remain pending. See the [build checklist](../devpost/checklist.md#final-review).

## Finish in this order

1. **Rehearse the main loop with one provider/model.** Follow the [exact demo walkthrough](../examples/demo/README.md). Check first clue, unchanged rerun, retry 3 arrow, retry 6 diff, acceptance, saved rerun and output `18`. Keep any useful error details: version, provider/model, file, expected and actual result. Fix failures before recording.
2. **Check the recording view.** Open a fresh playground; trust it deliberately; configure the provider before recording. Close unrelated panels and notifications, hide credentials, enlarge the text, and keep the source, CodeNudge and output visible. Use your actual editor theme. Capture a short sample and check readability and audio before the full take.
3. **Record the working main journey.** Use the shot list below. Only include Project mode if its complete live rehearsal works. Provider menus and extra examples should not displace the successful Debug result.
4. **Add real feedback if available.** Let another beginner try the same exercise with minimal prompting. Record what they did, whether the clue helped and where they got confused, with permission. Report observations accurately; do not turn one person's reaction into a claim of proven learning improvement. This is optional, not an eligibility requirement.
5. **Finish the entry yourself.** Check the current submission form, write the required answers and upload the actual video. Resolve outstanding critical feedback and confirm the candidate is ready before treating final review as complete.

Marketplace publication is a separate release task. The challenge rules require a public repository and working demo; publishing an extension is not a substitute for either.

## Recording shot list: target 2 minutes 30 seconds

These are screen actions and timing targets. Use your own words for the narration. Rehearse first; do not force every feature into one take.

| Time | Capture | Visible proof |
| --- | --- | --- |
| 0:00–0:15 | Show CodeNudge beside the four-line expenses example; point out the intended total. | Audience, problem and working editor context are understandable. |
| 0:15–0:40 | Run the original example, wait for the clue, then rerun unchanged. | A useful first hint; source stays yours and the stage does not advance on an identical run. Do not infer a measured token count from the UI. |
| 0:40–1:05 | Show genuine changed-code retries through retry 3 using the walkthrough. | Inline guidance beside the relevant source line. |
| 1:05–1:35 | Continue genuine retries to 6; open the proposed diff and explanation. | More help follows effort; proposed changes are reviewable. |
| 1:35–1:55 | Accept the reviewed fix, save/run and show `18` with solved feedback. | The full end-to-end result. Keep this even if other segments need cutting. |
| 1:55–2:15 | Optional: show a rehearsed Project plan and one conceptual nudge. Otherwise show the JavaScript logic example from the walkthrough. | One supporting capability, with no untested claims. |
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

No video, user-study result, Marketplace listing or completed submission is claimed by this checklist.
