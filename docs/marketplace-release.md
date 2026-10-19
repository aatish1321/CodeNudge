# CodeNudge Marketplace release

## Upload candidate: 0.0.27

Prepared October 19, 2026. Use **codenudge-0.0.27.vsix** instead of earlier local packages. This candidate has not been uploaded by the agent.

| Item | Value |
| --- | --- |
| Name / version | CodeNudge **0.0.27** |
| Artifact | `codenudge-0.0.27.vsix` in the repository root |
| Publisher / ID | `aatishdev` / `aatishdev.codenudge` |
| Gallery flags | Public; Preview remains off |
| Repository | [aatish1321/CodeNudge](https://github.com/aatish1321/CodeNudge) |
| License | [MIT](../LICENSE) |

## Changes and live evidence

A learner’s maximum-number exercise showed the generic “model available and supports structured output” error before assessment. The earlier implementation mapped every HTTP 400 to that message and discarded the provider’s error. The original request’s exact error code was not retained, so it cannot be reconstructed. Fresh live requests using the saved Groq connection and `openai/gpt-oss-120b` correctly identified the all-negative maximum bug, targeted line 5 at inline level, supplied a reviewed fix and marked the corrected -3 result solved. Intermediate checks encountered an actual HTTP 429 token rate limit; checks resumed individually after the limit window reset. This is bounded live evidence, not a guarantee of future API availability or a complete recorded demo.

Provider error bodies are now read with a 64,000-character limit. Errors are classified using allowlisted codes; logs contain only status/code/provider. For Groq HTTP 400 `json_validate_failed`, complete JSON in `failed_generation` can reach the normal caller validation without a new API request. Early fixes, invalid targets/fields, stale code and known-key leaks remain blocked by existing boundaries. Incomplete JSON, quota/auth/model/unknown errors remain failures with specific messages. The recovery branch is verified with fixtures; it was not observed as a fresh live 400 during these checks. No automatic retry/provider fallback was introduced.

The 0.0.26 effort fix remains: after the initial clue, three changed retries across the unresolved task unlock inline guidance, then three more unlock a reviewed fix. Changing error types does not reset effort. Verified success or **Start a new issue** clears it; use that reset for a different exercise in the same file. Identical reruns and clarification do not count. Identity, keys, settings and Project progress remain unchanged.

## Install or upload

For a local install, use **Extensions → … → Install from VSIX**, then **Developer: Reload Window**. If already installed by the agent, only reload. Debug progress remains in memory and starts fresh after reload.

For publishing, open [Marketplace publisher management](https://marketplace.visualstudio.com/manage/publishers/), choose the existing CodeNudge extension under **aatishdev**, and upload **codenudge-0.0.27.vsix**. Confirm the [public listing](https://marketplace.visualstudio.com/items?itemName=aatishdev.codenudge) shows 0.0.27 after processing. Older local `coding-buddy` identities do not migrate keys/progress; existing `aatishdev.codenudge` identity is preserved.

## Verification

- **115/115 source tests pass**, including complete-error-generation recovery, no added request, unchanged failure caching, explicit retry, locked-stage/target rejection and bounded/redacted error diagnostics.
- Fresh live Groq clue/inline/fix/solved checks pass on the synthetic negative-number exercise. Other provider/model teaching quality is not established by these checks.
- Exact artifact and installed VS Code evidence will be recorded here after packaging.

Clean committed-source packaging excludes user practice edits and local/private setup files. Required planning files remain public in the repository. This record and [the historical verification report](../devpost/verification.md) are excluded from the artifact, so checksum/evidence updates do not change it. Windows/macOS, minimum-version VS Code and pixel-level visual QA have not been newly verified. Provider rate limits and intermittent failures can still interrupt a demo.
