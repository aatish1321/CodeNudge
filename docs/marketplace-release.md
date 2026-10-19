# CodeNudge Marketplace release

## Upload candidate: 0.0.25

Prepared October 19, 2026 to fix repeated rejected guidance reported after the 0.0.24 package. This candidate has not been uploaded by the agent. It supersedes the earlier local upload file; use **codenudge-0.0.25.vsix** for this fix.

| Item | Value |
| --- | --- |
| Display name | CodeNudge |
| Upload version | **0.0.25** |
| Artifact | `codenudge-0.0.25.vsix` in the repository root |
| Publisher | `aatishdev` |
| Extension ID | `aatishdev.codenudge` |
| Gallery flags | Public; Preview remains off |
| Repository | [aatish1321/CodeNudge](https://github.com/aatish1321/CodeNudge) |
| License | [MIT](../LICENSE) |

## Fix

The local CodeNudge output log repeatedly reported `new_issue_stage`. This means a response claimed a new issue but used an incompatible stage; the log records a safe reason code, not the response itself. Both no-hint and later-stage contradictions are now handled: valid issue text can become a clue, with inline/edit fields discarded. A new-issue fix message is replaced with a thinking prompt to avoid revealing the fix prematurely. Locked stages, malformed fields/locations, source freshness and evidence guards remain enforced. Provider instructions explicitly rule out `none` for an issue and distinguish unsuccessful edits from genuinely new problems.

A controller regression uses a valid-running Python greeting with extra literal plus signs, fixture logic replies carrying `level: none`, six changed attempts, inline guidance after three retries and a reviewed fix after six. Unchanged reruns make no new request, inferred intent does not celebrate, and proposals do not silently edit the learner’s file. This is fixture evidence, not a new live-model quality claim. Existing identity, keys, settings, Project progress and the goal-based teaching fix remain intact. No automatic provider retry was added.

## Upload and test

1. Open [Marketplace publisher management](https://marketplace.visualstudio.com/manage/publishers/), choose the existing CodeNudge extension under **aatishdev**, and upload **codenudge-0.0.25.vsix** as an update.
2. Confirm the [public listing](https://marketplace.visualstudio.com/items?itemName=aatishdev.codenudge) shows 0.0.25 after processing. Preview should remain absent.
3. Update CodeNudge, run **Developer: Reload Window**, then try a saved changed run. Earlier rejected replies could not establish issue progress, so rejected attempts cannot be reconstructed after reload. Normal hints should now establish progress rather than require repeated manual retries.

For a local install, use **Extensions → … → Install from VSIX** with this file and reload. For the same continuing issue, three changed unsuccessful retries after the initial clue unlock inline guidance, then three further retries unlock a proposed fix. Identical reruns and clarification messages do not advance that count; a genuinely new issue starts with a clue.

Earlier local `aatish1321.coding-buddy` or `aatishdev.coding-buddy` installations have a different identity. Remove them to avoid duplicate commands/views; keys/progress do not migrate automatically. Existing `aatishdev.codenudge` identity is preserved.

## Verification

- **111/111 source tests pass**, including contradictory-stage recovery, inferred-goal progression, unchanged-run caching and existing provider/trust/edit guards.
- Exact-package inspection and installed VS Code workflow results will be recorded here after packaging.

This record and [the historical verification report](../devpost/verification.md) are excluded from the VSIX, so recording a final checksum does not change the artifact. User practice edits and private/local setup folders are excluded through a clean committed-source build. Approved planning documents remain public in the repository.

Fresh live-provider responses, Windows/macOS, the minimum supported VS Code version and pixel-level visual QA have not been newly verified. AI classification of a genuinely new versus continuing logic problem remains a model judgment when there is no matching terminal diagnostic. Publication is separate from package preparation.
