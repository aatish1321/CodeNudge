# CodeNudge support

Start with the [setup and troubleshooting guide](docs/usage.md) or the [practice walkthrough](examples/demo/README.md).

## Common questions

- **The robot opens but cannot read code:** if the folder is in Restricted Mode, use **Trust this folder…** when you are ready to enable code sharing and execution.
- **No hint after running Python or plain JavaScript:** try the editor’s **Run with CodeNudge** action. For other workflows, use a recognizable completed terminal command or **⚙ → Share a run result**.
- **No new hint after an unchanged run:** this is expected. The same code, output and context reuse previous analysis. Make a change or explicitly retry from the gear menu.
- **You do not know the correct answer:** describe the task or concept in a top comment or reply. You do not need to calculate the result first. CodeNudge is instructed to compare the supplied input/output with a clear goal; truly ambiguous goals may need one task-level question. Update and reload if you still see the old expected-answer wording.
- **A reply still looks wrong:** save and rerun the current file, then use **⚙ → Retry last result** if needed. Include the goal, actual output and received hint in a small bug report; AI guidance can be mistaken.
- **Provider or model error:** check the selected model, key, access and quota. Local servers must already be running with a model installed. CodeNudge does not retry or switch providers automatically.
- **A Project task does not advance:** try its check and use **Mark done**. AI feedback is advisory.
- **An old name or interface appears after an update:** run **Developer: Reload Window**. Existing playground folders keep their original files and folder names; open a new playground for fresh examples.

## Report a problem

Open a [GitHub issue](https://github.com/aatish1321/CodeNudge/issues) with:

1. Your CodeNudge version, VS Code version and operating system.
2. Whether you were using Debug or Project mode, plus the provider/model name.
3. The steps you took, what you expected, and what actually happened.
4. A small example that reproduces the problem and a screenshot if useful.

Remove API keys, tokens, personal paths and private project code before sharing. Do not include an entire workspace or paste credentials into an issue.

CodeNudge is a hackathon prototype. Current verification covers Linux workflows; full live-provider coverage and Windows/macOS testing are incomplete. See the [verification report](devpost/verification.md) for the exact checks.
