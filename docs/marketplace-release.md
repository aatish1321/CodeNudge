# CodeNudge Marketplace release

## 0.0.22 update

The maintainer explicitly authorized removing the Preview label and publishing an update on October 18, 2026. Version **0.0.22** removes the `preview` manifest property and includes the refreshed README. The extension identity, runtime code, settings, saved keys and Project storage are unchanged.

Publication is **pending**. The public gallery currently reports **0.0.21** with the Preview flag. No VSCE publisher login, Azure publishing credentials or connected browser is available to this agent. Prepare and verify the exact `codenudge-0.0.22.vsix`, then upload it through the existing publisher account; do not paste publishing credentials into chat. Checks and the final artifact checksum are recorded below when complete.

After upload, verify that the public gallery reports version 0.0.22 without `preview` in its flags. Record publication only after that succeeds. Removing the label does not expand the operating-system/provider coverage described in the verification limits.

## Published release

| Item | Value |
| --- | --- |
| Display name | CodeNudge (preview) |
| Version | 0.0.21 |
| Published artifact | `codenudge-0.0.21.vsix` in the repository root |
| Publisher | `aatishdev` — verified against the public Marketplace listing |
| Extension ID | `aatishdev.codenudge` |
| Repository | [aatish1321/CodeNudge](https://github.com/aatish1321/CodeNudge) |
| License | [MIT](../LICENSE) |
| Runtime changes since tested 0.0.17 | Settings link targets the corrected extension ID; teaching behavior unchanged |

The maintainer reports completing manual testing and publication. An unauthenticated check on October 17, 2026 confirms the [public listing](https://marketplace.visualstudio.com/items?itemName=aatishdev.codenudge), and the Marketplace gallery API returns version **0.0.21** for `aatishdev.codenudge`.

Earlier upload attempts used the wrong publisher or an unavailable package name. The published publisher is `aatishdev`; the GitHub account remains `aatish1321`. This is a different identity from earlier local `coding-buddy` builds. Remove an old local extension to avoid duplicate commands/views, re-enter your key, and expect workspace progress to start fresh. Automatic migration between identities is not included.

## Included in the release

- Marketplace description, compressed square JPEG listing icon (512 × 512 pixels; 69,722 bytes; below both upload limits), dark gallery banner, preview label and repository/support links.
- README with installation/setup, provider requirements and possible API costs, progressive help and Project mode.
- Privacy disclosure covering default automatic hints, shared context, secret storage and provider data handling.
- Changelog, MIT license and troubleshooting guide.
- Package exclusions for source tests, development scripts, local agent/skill folders, learner documents and credential filenames.

The release package uses the original committed `examples/loop_logic.js` and `examples/loop_syntax.py`. Local testing edits to those files are preserved in the working folder and excluded from this candidate. If rebuilding from the working folder, use a clean release checkout so those edits do not change the published exercises.

## For the next Marketplace update

1. **Choose a new version and build from committed release content.** Version 0.0.21 is already published. Keep unrelated agent folders and learner practice edits out of the package; run relevant checks and inspect the exact VSIX contents.
2. **Make source/assets public.** Push the intended release commit and check the README, images and support links while signed out. Marketplace relative links are rewritten to GitHub URLs.
3. **Review the exact artifact and upload the update.** Use [Marketplace publisher management](https://marketplace.visualstudio.com/manage/publishers/) for `aatishdev` and the existing CodeNudge extension. Upload the newly versioned VSIX after reviewing it; do not reuse the published 0.0.21 version.
4. **Verify the updated public install.** Check the listing without authentication and try the exact release in a fresh profile, including provider setup and a real clue. Record the actual coverage.
5. **Update the release record.** Record the new version, checks and checksum. A GitHub README edit alone does not update the README already bundled in the Marketplace release.

A real screenshot of Debug hints and one of Project mode would improve the listing. They are optional for publishing. Capture the actual extension with a public example and no keys, private code or personal paths; add them to the README and rebuild before uploading if desired.

Manual VSIX upload is an [officially supported publishing method](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#publish-an-extension) and avoids setting up CLI publishing credentials. No PAT or Azure pipeline is needed for this route. Keep account credentials and publishing tokens out of chat and the repository.

## Verification and limits

Release checks on 2026-10-17:

- `npm test`: **107/107 passed** for 0.0.19; 0.0.21 changes only listing assets, version metadata and documentation. Local HTTP and spawned runtime checks required execution outside the restricted sandbox.
- `npm run package`: **passed**, 45 archive entries. The listing icon is a separate 512 × 512 JPEG (69,722 bytes). The existing 1.85 MB in-editor mascot remains bundled and is not the listing icon.
- Archive assertions: **passed** for manifest/version identity, icon file size ≤ 1024 KB, dimensions ≤ 1024 × 1024 pixels, and runtime assets, compiled runtime equality, canonical practice exercises, rewritten README image URL and development/credential-file exclusions.
- `npm run test:package`: **passed** for 0.0.20 in an isolated profile, including Debug, Project workflows, terminal capture, direct runs, reviewed edits and settings; runtime is unchanged in 0.0.21.
- `node scripts/test-host.cjs --package --restricted`: **passed** for 0.0.19, including activation and view access before trust; runtime is unchanged in 0.0.21.
- Public repository: **HTTP 200** without authentication.
- `git diff --check`: **passed**.

Upload artifact SHA-256:

```text
77169b0360205d6b981722fbb429ab263042be13598bbb7749f7d5e1ad0230e2
```

The release checklist itself is excluded from the VSIX, so recording the final checksum does not alter the tested artifact. The earlier [verification report](https://github.com/aatish1321/CodeNudge/blob/main/devpost/verification.md) describes development coverage.

Automated provider checks use fixture responses and local HTTP transport. They do not establish current account/model availability or teaching quality for every provider. Windows/macOS runtime coverage and a run on the minimum supported VS Code version remain incomplete. The maintainer’s manual pass is reported separately from automated evidence.
