# Coding Buddy 0.0.6 verification

Date: 2026-10-15. Desktop VS Code 1.141 on Linux; Bash and zsh, Python 3.14, Node 26. No claim of coverage for every language, shell, or operating system.

## Automated source checks

`npm test`: 60 tests across seven files pass (Node 26's default reporter groups these as seven file suites).

| Area | Evidence |
| --- | --- |
| One activated controller | Python → JavaScript → Python preserves attempts and clarification; identical reruns do not call the provider; related-only edits count; cancelled/late replies are discarded; edit-and-undo can retry; saved arrows return with reopened document versions. |
| Project context | Import/error-prioritized source; stable content revisions; Git ignored files excluded; 500-path index, eight related files and 30,000-character bound; truncation/omissions labeled. |
| Freshness and privacy | Dirty/late-saved primary and helpers blocked; disk edits cannot hide behind clean open buffers; external paths, hidden/credential files, symlink escapes and credential aliases excluded; manual sharing cannot bypass primary exclusions. |
| Reviewed fixes | Exact fully-read related targets only; truncated/traversal/unprovided paths rejected; changes anywhere in the read context prevent acceptance. Native editor independently checks proposal identity/content/version. |
| Stage rules | Initial clue, three changed retries to inline, three more to fix; helper-only changes count; same-content saves, repeated runs and clarification do not add attempts. |
| Provider contracts | Gemini/OpenAI/Groq HTTP fixtures check auth/schema, locked fields, refusals, malformed/truncated/large replies, timeouts, quota/auth failures and no retry/failover. These use mocked HTTP. |
| Early answers | Real Groq replacement-text samples become conceptual prompts locally before fix stage. This is a heuristic, not a guarantee against every subtle answer leak. |
| Playground and panel | Fresh independent nested practice copies preserve earlier edits and request new windows; shipped panel rendering/message boundaries and preferences have unit coverage. |

Controller tests run actual activation/session/context logic with provider, terminal and UI boundaries mocked. They establish state coordination, not model judgment or rendered appearance.

## Real VS Code checks

`npm run test:host` passes using isolated profiles and temporary workspaces, without provider keys. Actual commands/output/exit statuses are captured; model judgments are not fabricated as live results.

| Project/case | Observed result |
| --- | --- |
| Python syntax progression | Four actual failing variants; third changed retry unlocks a local line hint; corrected run outputs 1–5 and removes old errors. |
| Multi-file invoice report | KeyError in helper → changed helper runs with wrong $63.90 total → corrected percentage calculation yields $61.00. Runtime success is distinguished from correct output. |
| Async JavaScript account client | Initial asynchronous data-use failure → valid account prints 15 credits → missing-account failure → explicit 404 recovery → unavailable service remains an HTTP 503 error. No network is needed for this fixture. |
| Cross-file/language routing | Python command resolves correctly while JavaScript is focused and vice versa; explicit entry-file ownership remains stable through helper failures/success; quoted paths contain spaces. |
| Shells | Automatic Bash and zsh capture without terminal attachment; unknown commands retain a confirmation fallback. |
| Editor and preferences | Real arrow decorations, native colored diff, no mutation on review/reject, accepted edits left unsaved, undo, stale-source rejection, provider settings and confetti toggle. |

Installed VSIX verification: the initial clean-built 27-file package passed the full native suite. The final readability/scrolling revision is being repackaged and rechecked before delivery.

## Live provider evidence

Live checks use fixed, nonsecret two-module Python/JavaScript sample context and the selected Groq key already stored in the normal VS Code profile. The key is read inside VS Code only; it is not copied into a shell, report or source. Test instrumentation stays in a temporary extension copy and is not shipped.

Early runs exposed overly explicit clue/inline answers and rejected replies; one reached Groq's quota. These led to locked stage-specific schemas, clearer policy examples and an obvious-answer guard. Final paced probes passed **8/8**: clue, inline, helper-file fix, and solved result for each of the Python invoice and JavaScript async samples. Both fixes addressed the intended helper bug on inspection. The local guard removed early replacement text from three responses; the remaining early messages stayed conceptual. The model labeled the initial JavaScript runtime exception as logic, so category accuracy remains imperfect. See [sanitized evidence](groq-stage-checks.json). Stage probes set local counters to clue/inline/fix boundaries; genuine changed-run counting is covered separately by controller/session/native tests. Proposed model replacements are reviewed/validated, not executed automatically.

Gemini and OpenAI live teaching remain unverified. A few passing Groq samples do not establish general teaching quality. No graphical automation surface was available for a visual polish review in the learner's exact theme.

## Launch it yourself

Open this repository in VS Code → **F5** / **Run → Start Debugging** → **Run Coding Buddy**. It opens the examples folder in an Extension Development Host. For the installed extension, **Ctrl+Shift+P → Coding Buddy: Open Playground** opens a fresh practice folder in a new normal window; the same action is inside the gear menu.

Hints and counts survive file switches within this window, not a VS Code restart. Context is bounded rather than a full repository upload. Browser/Postman/long-running server results still need explicit sharing. Multi-file patching and project-idea planning are deferred.
