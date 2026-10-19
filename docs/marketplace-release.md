# CodeNudge Marketplace release

## Upload candidate: 0.0.24

Prepared October 19, 2026. This candidate includes the goal-based teaching fix from 0.0.23 and polished documentation. It has not been uploaded by the agent. The latest public version verified through the unauthenticated gallery on October 19 is **0.0.22**, with flags `validated, public` and no Preview label.

| Item | Value |
| --- | --- |
| Display name | CodeNudge |
| Upload version | **0.0.24** |
| Artifact | `codenudge-0.0.24.vsix` in the repository root |
| Publisher | `aatishdev` |
| Extension ID | `aatishdev.codenudge` |
| Gallery flags | Public; Preview remains off |
| Repository | [aatish1321/CodeNudge](https://github.com/aatish1321/CodeNudge) |
| License | [MIT](../LICENSE) |

## What users receive

- Goal-based teaching: a comment such as “find the largest number” supplies intent; learners do not need to supply the correct answer. CodeNudge asks about the task or concept when intent is ambiguous, and keeps evidence checks before marking a tracked issue solved.
- Progressive clues, inline arrows, reviewed fixes, separate Project mode and nine provider connections remain available.
- Refreshed README, beginner troubleshooting, current build instructions and consistent hackathon documentation. Pausing automatic analysis is now clearly distinguished from explicitly requesting analysis.
- The same extension identity, commands, settings, key slots and Project storage. Runtime code is unchanged from the checked 0.0.23 build.

The package is built from committed source in a clean temporary folder. Uncommitted practice edits and local agent/course files are excluded. Approved planning files remain in the public repository; they are not included in the extension download.

## Upload this update

1. Open [Marketplace publisher management](https://marketplace.visualstudio.com/manage/publishers/) and sign in to the account managing **aatishdev**.
2. Find the existing **CodeNudge** extension, choose its update/upload action, and upload **codenudge-0.0.24.vsix**. Keep the existing publisher and extension identity.
3. Check the [public listing](https://marketplace.visualstudio.com/items?itemName=aatishdev.codenudge) after processing. Confirm version **0.0.24** and that Preview is absent.
4. Update CodeNudge in VS Code, reload the window, and rehearse a real example using your selected provider. If already on an unpublished local build, confirm the installed version in Extensions.

A README edit on GitHub does not replace the README bundled in Marketplace; this VSIX includes the revised copy. Later uploads require a version greater than the latest published version. Manual upload is supported by the [official publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#publish-an-extension).

Earlier local `aatish1321.coding-buddy` or `aatishdev.coding-buddy` installations have a different identity. Remove them to avoid duplicate commands/views, re-enter the provider key and expect fresh workspace progress. There is no automatic migration from those old identities. Existing `aatishdev.codenudge` installations retain their identity.

## Verification

- **109/109 source tests pass**, including clear-goal assessment without a learner-supplied answer, ambiguous-task clarification, unchanged-run caching, per-file progress, provider boundaries and Project coordination.
- Local documentation links, required tracked planning files, manifest/lock consistency and whitespace checks pass.
- Exact-package inspection and installed VS Code workflow checks are recorded below when complete.

This record is excluded from the VSIX so recording its checksum does not change the tested artifact. Detailed historical evidence remains in [the verification report](../devpost/verification.md) and [changelog](../CHANGELOG.md).

## Limits

Provider transport/controller tests use fixtures and local HTTP; they do not establish current account/model availability or the teaching quality of every provider. Fresh live-model wording for the goal-based policy still needs a learner rehearsal. Windows/macOS, the minimum supported VS Code version, and pixel-level visual review have not been newly verified. Publication is separate from preparing and testing this file.
