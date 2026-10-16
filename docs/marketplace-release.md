# CodeNudge Marketplace preparation

Status: **preparation only**. The learner is testing the installed extension. No Marketplace upload or publication is authorized by this checklist.

## Current candidate

| Item | Current value |
| --- | --- |
| Display name | CodeNudge |
| Local test version | 0.0.16 |
| Tested package | `codenudge-0.0.16.vsix` |
| Configured publisher ID | `aatish1321` — Marketplace ownership/access not verified |
| Extension identity | `aatish1321.coding-buddy`, retained to preserve installed-user data |
| Repository | [aatish1321/CodeNudge](https://github.com/aatish1321/CodeNudge) |
| License | [MIT](../LICENSE); manifest and root lockfile metadata match |
| Automated evidence | 107 source tests and installed VS Code/Restricted Mode checks passed for the branding build |

Any code fixes found during testing need a fresh version/package and relevant checks. Keep the eventual published artifact identical to the final artifact tested.

## Learner test pass

Record problems with the version, file/example, provider/model, expected result and actual result. The [demo walkthrough](../examples/demo/README.md) supplies small examples.

- [ ] Install/reload, open the robot, configure a provider and run a saved file.
- [ ] Debug: first clue → changed attempts → inline pointer → explained diff.
- [ ] Reject a fix; accept a reviewed fix; check undo; save/rerun and verify the intended result.
- [ ] Confirm unchanged reruns do not request fresh analysis and successful output clears stale error advice.
- [ ] Switch Python/JavaScript and helper files without losing per-file Debug progress.
- [ ] Project: try both feature choices, refine/approve a plan, request nudges/reviews and mark tasks done.
- [ ] Reload the same folder and resume Project progress; cancel a project, including while a request is pending.
- [ ] Check readable UI, keyboard actions, celebrations and animation settings in the theme/window size used for the demo.
- [ ] Record which providers/local models were actually tested; keep untested combinations clearly identified.
- [ ] Confirm the final candidate is ready for public use after any fixes.

## Release preparation

- [x] CodeNudge public branding and setup README are in place.
- [x] Changelog and support instructions are drafted.
- [x] Provider/privacy/context limitations are documented.
- [ ] Complete the learner test pass and resolve release-blocking bugs.
- [x] Add the MIT license and update manifest/root lockfile metadata. Packaging now checks for the license without bypassing it.
- [ ] Confirm control of the configured Marketplace publisher. Do not change the publisher/extension identity casually; existing installations use it.
- [ ] Add a listing icon and screenshots from the final tested UI. Screenshots must not expose keys or private code.
- [ ] Rebuild the final version from committed release content; inspect VSIX contents and repeat relevant source/installed checks.
- [ ] Recheck final tracked files/history and package exclusions for credentials, learner-profile data and unrelated files.
- [ ] Review the exact listing, version, artifact and support links, then explicitly approve publication.

The Marketplace README comes from the repository README. Microsoft’s [presentation guidance](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#marketplace-integration) recommends a changelog/support file and a PNG listing icon of at least 128 × 128 pixels. The existing activity-bar SVG is separate from the manifest’s listing `icon` field, which is currently absent. A square mascot icon is planned presentation work; it is not yet implemented.

## First publication: manual upload

Use the official [publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#create-a-publisher) and [publisher management website](https://marketplace.visualstudio.com/manage/publishers/).

After the final tested candidate and publication are approved:

1. Sign in to the Marketplace with your Microsoft account and create or confirm the intended publisher.
2. Use the website’s VS Code extension upload flow with the exact reviewed VSIX.
3. Check the display name, README/images, version, provider requirements and support information before publishing.
4. After publication, verify the public listing and install it from Marketplace in a fresh profile. Record the real listing URL and replace the README’s local-install-only status.

Manual VSIX upload is an officially supported publication method. CLI automation is optional; if added later, configure its publishing credentials locally or through an appropriate secret store. Never paste a publishing token into chat, source files or the repository. No automation credentials are needed for this preparation work.
