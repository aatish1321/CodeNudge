# CodeNudge Marketplace release

## Upload candidate: 0.0.26

Prepared October 19, 2026 after testing exposed effort being reset by changing errors. Use **codenudge-0.0.26.vsix** instead of the earlier local packages. This candidate has not been uploaded by the agent.

| Item | Value |
| --- | --- |
| Display name | CodeNudge |
| Version | **0.0.26** |
| Artifact | `codenudge-0.0.26.vsix` in the repository root |
| Publisher / ID | `aatishdev` / `aatishdev.codenudge` |
| Gallery flags | Public; Preview remains off |
| Repository | [aatish1321/CodeNudge](https://github.com/aatish1321/CodeNudge) |
| License | [MIT](../LICENSE) |

## Corrected learning loop

The screenshot showed a name error, then type errors, then a greeting with the wrong output. Previously each new diagnosis could reset effort to zero. CodeNudge now counts changed runs across the unresolved task in that file, independently of the model’s relationship labels. It starts with a clue, unlocks inline guidance after three changed retries and a reviewed fix after three more. New diagnoses update the summary and use the current target line; they do not reuse the previous error’s location. A missing AI stage can still recover as a safe clue.

Identical reruns, same-content saves, unrelated-file edits and clarification messages do not increase effort. Source changes count before a request so a provider failure does not erase the attempt; there is no automatic network retry. Verified success or **Start a new issue** clears the count. Use that reset action for a new exercise in the same file. Counts remain separate between files and remain in memory for the window session.

The provider schema and policy now follow the host-unlocked stage even for a new diagnosis. Malformed/out-of-range targets, locked stages, stale edits and missing success evidence remain rejected. Fixes still require review and acceptance. Identity, saved-key slots, settings and Project storage are unchanged. The output channel now records safe status/stage/count metadata to help diagnose future progression problems; it does not log source, output or raw model messages.

## Install or upload

For local testing, install this VSIX through **Extensions → … → Install from VSIX**, then run **Developer: Reload Window**. If already installed by the agent, only reload. In-memory progress cannot be reconstructed from the previous window after reload.

For publishing, open [Marketplace publisher management](https://marketplace.visualstudio.com/manage/publishers/), choose the existing CodeNudge extension under **aatishdev**, and upload **codenudge-0.0.26.vsix** as an update. Confirm the [public listing](https://marketplace.visualstudio.com/items?itemName=aatishdev.codenudge) shows 0.0.26 after processing. Later uploads need a higher version.

Older local `coding-buddy` identities do not migrate keys or progress. The existing `aatishdev.codenudge` identity is preserved.

## Verification

- **112/112 source tests pass**. A new controller regression executes seven greeting variants with Python, captures real NameError/TypeError/plain output, supplies fixture diagnoses labeled new, and verifies progression through current-line inline guidance and a reviewed fix. It also checks unchanged-run caching, no inferred-goal celebration, no silent edits and manual reset. Existing success, per-file, trust, freshness and provider boundaries remain covered.
- All nine provider schemas constrain issue help to the host-unlocked level even without a matching diagnostic.
- Clean committed source **f407a25** produces a **45-entry VSIX**. Only the four intended compiled modules (`extension`, `session`, `teaching`, `providers`) differ from 0.0.25. Identity/settings/Public metadata, committed assets/exercises, exact MIT text and private/development-file exclusions pass inspection. A scoped packaged-text credential-pattern scan found no matches; this is not a universal secret detector.
- **67 local documentation links/anchors** pass; linked images have alt text.
- `npm run test:package`: **passed** in an isolated native VS Code profile, including terminal/direct runs, Python/JavaScript, multi-file routing, inline guidance, native diff accept/reject/undo, stale-edit checks, settings and Project coordination with fixtures.
- `node scripts/test-host.cjs --package --restricted`: **passed**, including real activation/view access before trust and trust management without auto-trusting.
- Both passing test installations and the normal user installation match all **43 extension entries**, ignoring installer-added package metadata. Reload the normal window to activate the installed 0.0.26 build.
- Artifact SHA-256: `c33a237ead16395a19c7c30ec055505c042c1a122aa77ed3f00495296a6b3cbe`.

The package is built from clean committed source, preserving user practice edits and excluding local/private/setup files. The required approved planning files remain in the public repository. This record and the [historical verification report](../devpost/verification.md) are excluded from the VSIX, so recording the checksum does not alter it.

Fresh live Groq teaching responses, Windows/macOS, minimum-supported-VS-Code execution and pixel-level visual QA have not been newly checked. Logic-error locations and diagnosis still depend on the selected model; effort counting no longer does. Publication is separate from preparing the package.
