# CodeNudge Marketplace release

## Release candidate

| Item | Value |
| --- | --- |
| Display name | CodeNudge (preview) |
| Version | 0.0.18 |
| Upload artifact | `codenudge-0.0.18.vsix` in the repository root |
| Publisher | `aatishdev` — confirmed by the Marketplace upload error |
| Extension ID | `aatishdev.coding-buddy` — corrected to match the actual publisher |
| Repository | [aatish1321/CodeNudge](https://github.com/aatish1321/CodeNudge) |
| License | [MIT](../LICENSE) |
| Runtime changes since tested 0.0.17 | Settings link targets the corrected extension ID; teaching behavior unchanged |

The maintainer reports completing manual testing. This candidate remains unpublished until it is uploaded through the publisher account. The previous upload was rejected because the manifest used `aatish1321`. The corrected publisher is `aatishdev`; the GitHub account remains `aatish1321`. This creates a different identity from earlier local builds. Remove the old local extension before using the new one to avoid duplicate commands/views; re-enter your API key and expect workspace progress to start fresh. Automatic migration is not included.

## Prepared for upload

- Marketplace description, existing PNG mascot icon, dark gallery banner, preview label and repository/support links.
- README with installation/setup, provider requirements and possible API costs, progressive help and Project mode.
- Privacy disclosure covering default automatic hints, shared context, secret storage and provider data handling.
- Changelog, MIT license and troubleshooting guide.
- Package exclusions for source tests, development scripts, local agent/skill folders, learner documents and credential filenames.

The release package uses the original committed `examples/loop_logic.js` and `examples/loop_syntax.py`. Local testing edits to those files are preserved in the working folder and excluded from this candidate. If rebuilding from the working folder, use a clean release checkout so those edits do not change the published exercises.

## What you need to do

1. **Make the release source public.** Commit the release files and push them to the public CodeNudge repository. Keep unrelated agent folders and practice edits out of that commit. Marketplace README images and relative links are rewritten to GitHub URLs, so the release assets must be available there. Check the repository, README image and Issues link while signed out.
2. **Sign in to your publisher.** Open [Marketplace publisher management](https://marketplace.visualstudio.com/manage/publishers/) with the Microsoft account that owns `aatishdev`.
3. **Upload the exact candidate.** Choose **New extension → Visual Studio Code**, select `codenudge-0.0.18.vsix`, review the listing and publish. If this extension already exists, use its update/upload action and ensure 0.0.18 is newer than the published version. An already-used version requires a version bump and a fresh package.
4. **Verify the public release.** Wait for Marketplace validation, open the listing, and install CodeNudge from Extensions in a fresh VS Code profile. Check that the robot opens, setup works and Open Playground includes the practice files.
5. **Record publication.** The expected listing URL is `https://marketplace.visualstudio.com/items?itemName=aatishdev.coding-buddy`. Confirm it is live, then update the README/changelog publication status for the next release.

A real screenshot of Debug hints and one of Project mode would improve the listing. They are optional for publishing. Capture the actual extension with a public example and no keys, private code or personal paths; add them to the README and rebuild before uploading if desired.

Manual VSIX upload is an [officially supported publishing method](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#publish-an-extension) and avoids setting up CLI publishing credentials. No PAT or Azure pipeline is needed for this route. Keep account credentials and publishing tokens out of chat and the repository.

## Verification and limits

Release checks on 2026-10-17:

- `npm test`: **107/107 passed**. Local HTTP and spawned runtime checks required execution outside the restricted sandbox.
- `npm run package`: **passed**, 44 archive entries, approximately 1.88 MB. The packaging tool noted the existing 1.85 MB mascot image; no packaging errors.
- Archive assertions: **passed** for manifest/version identity, icon dimensions and runtime assets, compiled runtime equality, canonical practice exercises, rewritten README image URL and development/credential-file exclusions.
- `npm run test:package`: **passed** against the final VSIX in an isolated profile, including Debug, Project workflows, terminal capture, direct runs, reviewed edits and settings.
- `node scripts/test-host.cjs --package --restricted`: **passed** against the final VSIX, including activation and view access before trust.
- Public repository: **HTTP 200** without authentication.
- `git diff --check`: **passed**.

Upload artifact SHA-256:

```text
020f565b202e34cfd53b856e03235810841a852b5bd1cd2e057e401606e42ff7
```

The release checklist itself is excluded from the VSIX, so recording the final checksum does not alter the tested artifact. The earlier [verification report](https://github.com/aatish1321/CodeNudge/blob/main/devpost/verification.md) describes development coverage.

Automated provider checks use fixture responses and local HTTP transport. They do not establish current account/model availability or teaching quality for every provider. Windows/macOS runtime coverage and a run on the minimum supported VS Code version remain incomplete. The maintainer’s manual pass is reported separately from automated evidence.
