# Contributing to CodeNudge

Thanks for helping make coding guidance more useful to beginners. Start with a small, focused change that preserves the learning loop: clues first, more specific help after effort, and reviewed changes under the learner's control.

## Useful places to help

- Reproduce an issue with a small code example and clear expected/actual behavior.
- Report a clue that reveals the answer too early or gives too little direction.
- Verify a provider/model or language/toolchain and document what actually worked.
- Improve keyboard access, readability or reduced-motion behavior.
- Clarify setup instructions and beginner exercises.

Use the [support guide](SUPPORT.md) for bug reports. For a larger change, open an issue first so the behavior and scope can be discussed.

## Work on the code

```sh
git clone https://github.com/aatish1321/CodeNudge.git
cd CodeNudge
npm ci
git switch -c your-focused-change
npm test
```

Open the repository in VS Code and press **F5 → Run CodeNudge** to try your change in a separate development window. Add or adjust a focused test when changing behavior, and include the checks you actually ran in your pull request. Do not describe fixture responses as live model validation.

To inspect the installable result, run `npm run package` and install the generated VSIX in a test profile. Optional native checks are `npm run test:host`, `npm run test:trust` and, after packaging, `npm run test:package`. They require desktop VS Code and a graphical session; run them separately to avoid focus interference.

## Preserve these boundaries

- Keys belong in VS Code SecretStorage, never source, screenshots, logs or issues.
- Keep context exclusions, trust checks, source-freshness guards and request cancellation intact.
- Keep proposed fixes reviewable; accepting a fix must preserve undo.
- Preserve saved settings/project compatibility when changing identifiers or storage.
- Many files in `examples/` deliberately contain bugs. Keep their documented learning goals and expected outcomes consistent instead of automatically repairing all examples.

The [planning index](devpost/README.md) explains the product decisions. The [verification report](devpost/verification.md) records coverage and gaps. Contributions to project code are distributed under its [MIT license](LICENSE).
