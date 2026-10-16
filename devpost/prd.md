---
doc: prd
status: approved
---

# Coding Buddy — Product Requirements

A VS Code companion that helps coding beginners think through problems with progressively more specific guidance. It supports learning across programming languages; Python is the demo language, not a product restriction.

Source: `scope.md > The Unique Kernel`, `Who It's For`, and `The POC Boundary`.

## The Core Journey

1. The learner installs the extension and finds its icon in the VS Code sidebar.
2. Clicking the icon opens a quiet side panel: no prefilled conversation, with a text area for clarification. The character is part of the buddy's identity.
3. The learner configures a supported AI provider using their own API key.
4. With code open, the learner runs it. An error or unexpected outcome prompts the buddy to offer a likely problem category and a clue in the panel, without requiring a “what is wrong?” message.
5. The learner changes the code and runs it again. Three unsuccessful attempts on the same issue lead to an inline hint pointing at the relevant code.
6. Three further unsuccessful attempts lead to a proposed fix displayed as a colored diff, with an explanation of what would change and why in the panel.
7. The learner accepts or rejects the proposal. The buddy does not apply it without acceptance.
8. When the run result matches the expected behavior described in the top-of-file comment or the learner's clarification, the attempt count resets and confetti celebrates if enabled. If intended behavior is unclear, the buddy asks in the text area before claiming success.

Source: `scope.md > The Core Loop` and `What "Working" Looks Like`.

## Screens and Layout

- **Sidebar icon:** opens the buddy panel.
- **Buddy panel:** transparent cutout character, initially blank conversation area, and a compact reply box. Keep provider/key controls, terminal tools, retry/reset, and celebration preferences behind the gear icon. The learner types extra context or answers the buddy's questions; ordinary error help does not depend on a typed request or manually attaching a terminal.
- **Editor guidance:** an arrow-style pointer such as `<-------` and an inline hint identify the relevant code after escalation.
- **Fix review:** a colored diff makes removed and added code distinguishable and offers accept/reject actions. Show the explanation in the buddy panel.
- **Settings:** supported provider choice, that provider's API key, any connection details required by the selected provider, and a confetti on/off control.

No separate project-building surface is required for this version.

## Look and Feel

- Use [the supplied robot reference](assets/buddy-reference.png): a friendly robot with a glowing face, headset, hoodie, and cyan, teal, and orange accents.
- Include the character as a visible buddy element. Animation is not required by this plan.
- The experience should have personality and small moments of fun rather than feel like a regular AI chat.
- Speak like a patient senior teaching a junior: encouraging, clear, and easy for a beginner to follow. Avoid overwhelming jargon; explain technical terms when necessary.
- Use arrow-style inline guidance and colored changes in fix review. Color must not be the only way to distinguish additions and removals.
- Celebrate solved issues with confetti. Users can turn this effect on or off in settings.

Source: `scope.md > Inspiration & Identity`, expanded by the learner's character, tone, and celebration choices during the PRD interview.

## Features and Behavior

### Context and First Clue

Use the code being worked on and the relevant run result to provide help automatically after a run reveals a problem. Start with a likely category, such as syntax or logic, and a clue that leaves the learner room to think. Do not reveal the complete fix in the first clue.

Watch completed integrated-terminal runs automatically across the opened folder. Follow the source identified by the command or error, retaining separate progress when switching files or languages. Include relevant helper files and folder structure within documented limits. If the terminal cannot identify the command and the output does not link to a source file, quietly skip analysis instead of asking a yes/no file-confirmation question. Offer Run with Buddy for supported scripts, which launches a known file, or explicit result sharing for other workflows. Do not show command-entry dialogs. Automatic hints can be paused from the settings gear.

Read the top-of-file comment describing what the code should do. If the learner omits it, analyze the code for a tentative interpretation, presented as a guess. If intent is still unclear, ask what the learner expected; their answer in the text area becomes context. Use this same expected-outcome context for diagnosis and recognizing success. Successful execution alone does not prove that the logic is correct.

Source: `scope.md > The Core Loop`.

### Attempts and Escalation

- The initial error produces the first clue and starts the issue at zero retry attempts.
- An attempt means changed code is run and the same issue remains.
- Three unsuccessful attempts after the initial clue trigger line-specific inline guidance.
- Three more unsuccessful attempts after the inline hint trigger a proposed fix and explanation.
- Typing alone, time passing, and clarification replies do not count as unsuccessful code attempts.
- Rerunning unchanged code with unchanged relevant context makes no additional AI request and does not advance the count. The earlier hint remains available.
- An intentional clarification reply may produce a new response even when the code has not changed.
- Solving the issue resets its count.

Source: `scope.md > The Unique Kernel` and `The Core Loop`, with the learner-approved three-plus-three rule.

### Proposed Fix and Explanation

Display the proposed change as a diff. Acceptance applies the reviewed change; rejection leaves the file unchanged. Explain the mistake, the proposed change, and why it addresses the problem in beginner-friendly language. A proposal must not silently overwrite edits made after it was generated; if the source changes, ask for a fresh review.

Source: `scope.md > The Core Loop`, clarified during the PRD interview: the final fallback is a proposal, not an automatic edit.

### Solved State and Celebration

Use the top-of-file comment as the description of intended behavior. If absent, tentatively infer intent from the code; if still unclear, ask the learner through the text area. Celebrate when the observed run result matches that expected behavior and the reported issue is no longer present. Do not celebrate on an unresolved guess, merely because a run produced no error, or just because the learner accepted a fix.

On success, reset the issue's attempt count and show confetti when enabled. With confetti disabled, still give clear success feedback. This is feedback on the observed issue and result, not proof that the entire program is correct for every input.

### Provider Settings and Open Source

- Make the project open source with a public repository for submission.
- Let the learner select a supported provider and supply their own API key in settings.
- Support one provider during initial development and testing.
- Before hackathon submission, support at least two providers and demonstrate switching between them for the same learning workflow. This is a submission requirement, not an optional stretch goal.
- The supported list must be explicit; do not claim that every provider works.
- Choose the initial providers in `4-spec`, with accessible explanations of setup and tradeoffs. Do not ask the learner for API keys in chat or include keys in source, public artifacts, or ordinary logs.
- Keep keys concealed in the interface and allow replacement/removal. Clearly identify which selected provider receives coding context.
- Explain missing or invalid credentials and connection failures in plain language, with a way to correct settings and try again. A failed AI request must not advance help stages or modify code.

Source: `scope.md > The POC Boundary`, expanded by the learner's explicit open-source and provider-choice requirements during the PRD interview. Multiple provider connections add work beyond the original error-loop sketch.

## States and Boundaries

- **Restricted Mode:** keep the buddy visible with a clear route to VS Code’s folder-trust screen. Watching and AI analysis wait for the learner to grant trust; opening that screen alone does not grant it.
- **First use:** quiet panel with the text area and buddy identity; provider setup must be discoverable before help is requested.
- **No code available:** explain that the learner needs a code file open; do not fabricate a diagnosis.
- **Working:** show that the buddy is considering the problem. Repeated triggering while the same response is pending must not duplicate requests or counts.
- **Unclear intent:** ask for the expected outcome rather than confidently labeling an uncertain logic mistake.
- **Connection failure:** preserve the code and existing guidance, explain the failure, and allow retry or settings correction.
- **Rejected fix:** preserve the learner's code. Do not reapply or repeatedly offer a rejected change just because unchanged code is rerun.
- **Outdated guidance:** do not present a pointer or proposed fix as if it applies to a newer version of the code when it no longer does.

The no-code, waiting, connection-failure, and outdated-result handling above are proposed baseline safeguards for review, not separately requested features.

## Acceptance Criteria

- Opening the sidebar icon reveals the character element, quiet conversation area, and clarification text area without an unsolicited conversation.
- A Python syntax-error demo produces a problem-category clue without a typed “what is wrong?” request or an immediate complete fix.
- Three changed-code attempts that leave the same issue unresolved produce an arrow-style inline hint. Three further unsuccessful attempts produce a diff and explanation.
- Rerunning unchanged code with the same context leaves both the attempt count and number of AI requests unchanged.
- Typing a clarification can receive a response without requiring a code change.
- Accepting a current proposal applies the displayed change. Rejecting it preserves the file. An outdated proposal cannot overwrite newer work.
- A small Python logic-error demo uses a top-of-file expected-outcome comment. When that comment is missing, the buddy tentatively infers intent; if it is still unclear, it asks in the text area instead of asserting a guess as fact.
- When the observed result matches the expected outcome and the issue is resolved, success feedback appears and the attempt count resets. Confetti obeys the setting. A run with the wrong result or unclear intended behavior does not trigger celebration merely because it exited without an error.
- Before submission, the same help workflow works with at least two supported providers selected through settings, using the learner's own keys.
- Missing credentials or a failed AI request produce an understandable recovery path without changing code or advancing the help stage.

Source: `scope.md > What "Working" Looks Like` plus the learner's specific PRD decisions.

## Product Decisions

- **Language coverage:** help across programming languages; Python is only the initial demo and verification language.
- **Low-friction help:** read coding context and respond to problems without requiring a prompt for each diagnosis.
- **Escalation:** three unsuccessful changed-code retries before inline help, then three more before a proposed fix.
- **Token efficiency:** unchanged reruns do not make another AI request.
- **Learner control:** show proposed code changes as a colored diff with accept/reject actions.
- **Teaching identity:** use the supplied robot and a senior-to-junior tone that avoids overwhelming technical language.
- **Celebration:** confetti after a solved issue, controllable in settings.
- **Expected outcome:** use the top-of-file comment, tentatively infer intent if absent, and ask in the text area if still unclear; use this context to judge whether the observed issue is solved.
- **Provider choice:** one provider for early testing, multiple supported providers demonstrated before submission.
- **Open source:** publish the project source for the hackathon.

## What We're Building

One error-help workflow in a VS Code extension: character-led side panel, coding context and clarification, staged hints, arrow-style inline guidance, reviewed fixes with explanations, configurable celebrations, and user-supplied provider credentials. Verify the loop with small Python syntax and logic examples and demonstrate provider switching before submission.

## Deferred From the POC

- **Project idea to mini tasks:** a separate teaching workflow; consider only after the error-help loop is complete and if time remains.
- **Additional language/toolchain coverage:** the included multi-file Python and JavaScript projects extend verification without claiming every toolchain works.
- **Universal provider compatibility:** a named supported list is required; additional connections can follow.

Source: `scope.md > Later` and `Explicitly Cut`, with the later provider requirement reflected above.

## Non-Goals

- Immediate complete-code answers before the learner has attempted the problem.
- Applying suggested edits without the learner accepting them.
- Claiming that Python-only verification proves behavior in every language or that multiple tested providers prove universal compatibility.
- A separate project-planning assistant in the required first version.

## Open Questions

- No unresolved product decision blocks PRD review. Technical feasibility and delivery questions remain below for `4-spec`.
- **During 4-spec, before its approval:** choose the providers and confirm how the extension obtains code-run results across languages, including behavior when a run cannot be observed. Preserve the cross-language product intent rather than silently narrowing it to Python.
- **During 4-spec:** define code-context limits, credential setup/storage, reset behavior across files or new issues, and session lifetime. Explain resulting user-visible limits before approval.
- **During 4-spec and shipping planning:** decide how to install and demonstrate the extension, and whether Marketplace publication is feasible within the hackathon. The learner imagines Marketplace installation; actual public Marketplace release must not be promised without checking its requirements.

## Workspace Revision

Requested during learner testing: keep hints, clarification, and attempt progress when moving between files/languages in the same window; investigate relevant code across the opened folder rather than pinning normal use to one file/terminal. Provide a self-service way to open fresh practice projects. Verify harder multi-file Python and JavaScript work, including runtime failures and wrong-but-successful output. Context is bounded and secret/generated files excluded; fixes remain reviewed one-file changes. The project-idea-to-tasks workflow stays deferred.

## Run with Buddy Revision (0.0.9)

The learner rejected repeated yes/no file-confirmation questions. Remove that interaction. Provide an editor run action for Python/plain JavaScript, keeping exact source/run association even with plain successful output or missing shell metadata. Continue automatic analysis for identifiable manual commands across languages; quietly skip unlinked results, retaining progress. This is an optional script runner, not a universal build-tool replacement.
