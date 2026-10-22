# CodeNudge Marketplace release

## Upload candidate: 0.0.28

Prepared October 22, 2026 after the learner requested a more deliberate, less decorative interface. This candidate has not been published by the agent.

| Item | Value |
| --- | --- |
| Name / version | CodeNudge **0.0.28** |
| Artifact | `codenudge-0.0.28.vsix` in the repository root |
| Publisher / ID | `aatishdev` / `aatishdev.codenudge` |
| Gallery flags | Public; Preview remains off |
| Repository | [aatish1321/CodeNudge](https://github.com/aatish1321/CodeNudge) |
| License | [MIT](../LICENSE) |

## Interface changes

The learner chose an arcade direction after reviewing an earlier minimal pass. After the learner compared both designs, the final sidebar restores the large centered animated sidekick, circular backdrop and message beneath it. Arcade pixel accents, chunky mode buttons, outlined hints and bold mint/gold/coral accents stay on native-theme surfaces. Body, hint, input and button text use an enlarged scale with a 15px minimum body size that follows the VS Code font preference. A three-segment effort meter maps to actual changed attempts; clue/inline/review progress stays in view while scrolling. There are no invented scores or streaks. Project tasks/checks and primary/secondary actions are distinct; Cancel project remains available while coaching is pending.

The progress caption explains remaining changed runs starting at the first clue and distinguishes an unlocked review level from a proposal ready to accept. The supplied mascot, optional motion/confetti, reduced-motion handling, keyboard send, focus outlines and light/high-contrast theme rules remain. Learner messages use right-aligned mint-tinted speech bubbles; CodeNudge replies use left-aligned category-colored speech bubbles in both modes. The settings gear is centered, and a three-dot speech bubble appears during replies with motion preferences respected. No AI teaching, provider transport, terminal capture, stage thresholds, source-sharing rules, commands, saved keys or Project storage changed.

The [local sidebar study](../devpost/sidebar-preview.html) includes twelve sample states built from the actual template and shipped CSS/script/assets: idle, clue, narrow inline, fix, Project idea/task/plan, provider error, Restricted Mode, reply animation, chat conversation and success. Open it locally with the repository’s media folder alongside it. These are fixtures, not screenshots, and do not call a provider.

## Install or upload

Install the VSIX through **Extensions → … → Install from VSIX**, then run **Developer: Reload Window**. If installed by the agent, only reload. Debug progress is held in memory and starts fresh after reload.

For Marketplace, open [publisher management](https://marketplace.visualstudio.com/manage/publishers/), choose the existing CodeNudge extension under **aatishdev**, and upload **codenudge-0.0.28.vsix**. Confirm the [public listing](https://marketplace.visualstudio.com/items?itemName=aatishdev.codenudge) after processing. Existing `aatishdev.codenudge` identity is preserved; old local `coding-buddy` identities do not migrate automatically.

## Verification

- All 116 source tests pass on the final chat-bubble source snapshot `01e54d1`; JavaScript syntax and whitespace checks pass. Twelve preview templates retain their required IDs, mascot alt text and nonce/CSP.
- The full installed-package native workflow suite and the separate actual Restricted Mode suite passed sequentially on arcade snapshot `2fc5c82`. Subsequent changes restore the centered mascot, enlarge type, fix the gear and add reply/chat bubbles. These presentation changes have source/template checks and a normal-profile install; the native suites were not repeated while the learner was using the review window.
- Final artifact SHA-256: `cb4eb2b039095cd97ce5aa1b5331a906cd7367de4fba7e3bc5fd351c021c632a`. Its 45 entries retain the manifest identity/settings, committed examples, supplied assets and MIT text. Relative to the earlier tested arcade package, only the compiled panel HTML, CSS, browser script and changelog differ. All 43 extension entries in the normal VS Code installation match the final artifact, excluding installer metadata.
- Twelve preview frames have all script-target IDs exactly once, local resources, image alt text and intact script nonces/CSP.
- Computer-use inventory has no apps or browsers; an in-app browser open reports unavailable. Pixel-level visual inspection and rendered narrow/light/high-contrast/motion QA are not claimed. The local preview supports human review.

Clean committed-source packaging excludes user practice edits and local/private/setup files. Required planning documents remain public in the repository. This record and [the historical verification report](../devpost/verification.md) are excluded from the VSIX, so checksum/evidence updates do not alter it. No fresh provider calls are required for this presentation change; the earlier live Groq evidence remains scoped to its recorded cases. Other platforms, minimum-version VS Code and provider availability remain limited as described in that report.
