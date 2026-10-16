---
doc: spec
status: approved
---

# Coding Buddy — Technical Spec

## How This Works, In Plain Language

Coding Buddy is one extension running inside desktop VS Code. Its robot panel shows hints and asks questions. The extension watches completed integrated-terminal runs using source files identified by commands or errors in the opened folder, reads their results, and sends the relevant context directly to the chosen AI provider.

The AI identifies the likely issue and writes teaching guidance. Ordinary extension code counts attempts and controls which level of help is allowed, so switching providers does not bypass the three-plus-three rule. Editor arrows are visual annotations, not extra text inserted into the learner's file. Proposed fixes open in VS Code's change-review view and apply only after acceptance.

For diagnostics exposing an exception type and valid source line, retain that identity across changed-code retries even if the model calls a rephrased error new. Count such retries before the provider request so a malformed response does not erase genuine effort. At three retries, render a local pointer to the known line even if the model omits its own inline hint. Other diagnostic formats still depend on model classification/line evidence. Keep the first issue description stable and send the latest hint separately. For confirmed continuing diagnostics, constrain the provider schema to the unlocked inline/fix stage or none.

A fresh source/result clears obsolete cards and editor guidance before analysis. A successful exit with no error in current output cannot display a historical syntax/runtime diagnosis: ask about expected output instead, without claiming logic correctness. Discard irrelevant edit fields on success/clarification responses. Cache attempted requests, including failures; only the explicit Retry action clears that cache for an unchanged result. The settings header and composer stay fixed while the conversation scrolls.

Provider preferences, automatic-watching preference, and the confetti setting are remembered. API keys use VS Code's encrypted secret storage. Hints, run output, and attempt counts remain in memory for the current window session; closing the panel preserves them, while restarting VS Code clears them. There is no separately hosted Coding Buddy server or database.

Automatic observation covers completed commands in VS Code integrated terminals with working shell integration. For browser results, Postman responses, long-running servers, or an unavailable terminal integration, the learner shares the relevant result through the settings menu. Guidance is language-independent; automatic observation is limited by the execution environment, not by a Python-only restriction.

## The Core Journey Through the System

Implements `prd.md > The Core Journey` and `Context and First Clue`.

1. Opening the sidebar icon creates the quiet robot panel with a transparent cutout character, a reply box, and a gear icon. Extra controls are tucked into the gear menu without preloading a conversation.
2. Provider setup saves the selected provider/model as preferences and its key through a masked VS Code input into secret storage.
3. Watching starts automatically on extension startup. At a terminal command start, snapshot open saved source files and begin reading output; no manual terminal attachment is required. Settings allow pausing/resuming or optionally pinning a specific file and terminal.
4. At command start, capture open source contents/versions and the working directory, and immediately begin reading output. Ignore recognized housekeeping commands. Wait for command completion and link the result by its command or output filename. If neither confirms the candidate, ask in the conversation before spending an AI request or advancing attempts.
5. At completion, check that source and run still match, bound the output, and suppress duplicate requests. Ask the selected provider to analyze the code, expected outcome, run result, and current allowed help level.
6. Validate the response before updating the learning session. Show a first clue, inline guidance, clarification question, or proposed fix according to the approved progression.
7. A clarification reply can request another response without counting as a code attempt. For external results, a Share Run Result action in the settings menu labels the text as a learner-reported run; a changed-code retry can then follow the same attempt rules, without claiming automatic observation.
8. Review a proposed replacement beside the captured original. Acceptance updates only the linked file if its content/version still matches the reviewed original. Rejection does not change the file.
9. The next observed result is assessed against the top-of-file comment or clarified intention. On a supported conclusion that the tracked issue is solved, reset its count, show success feedback, and celebrate if enabled. Unclear intention or insufficient evidence produces a question rather than success.

## Stack

The learner agreed to a TypeScript desktop extension, a small HTML/CSS/JavaScript panel, native editor features, and direct provider connections.

| Piece | Choice and reason | Documentation |
| --- | --- | --- |
| Extension code | TypeScript, strict checks; compile to CommonJS/ES2022 for the extension host | [VS Code starter](https://code.visualstudio.com/api/get-started/your-first-extension), [TypeScript](https://www.typescriptlang.org/docs/) |
| VS Code support | `engines.vscode: ^1.93.0`; shell-execution observation became available in 1.93; compile against matching `@types/vscode` | [1.93 API release](https://code.visualstudio.com/updates/v1_93#_terminal-shell-integration-api), [API reference](https://code.visualstudio.com/api/references/vscode-api) |
| Panel | `WebviewViewProvider` with bundled HTML/CSS/JavaScript and artwork | [Webviews](https://code.visualstudio.com/api/extension-guides/webview), [sidebar webviews](https://code.visualstudio.com/api/ux-guidelines/webviews) |
| Requests | Native `fetch` with cancellation and bounded responses; separate small request functions for the three different APIs | [Node fetch](https://nodejs.org/api/globals.html#fetch) |
| Preferences and keys | VS Code configuration plus `ExtensionContext.secrets` | [Storage capabilities](https://code.visualstudio.com/api/extension-capabilities/common-capabilities#data-storage) |
| Editor feedback | Text decorations for arrows; `TextDocumentContentProvider` plus `vscode.diff` for review; `WorkspaceEdit` for accepted changes | [VS Code API](https://code.visualstudio.com/api/references/vscode-api), [virtual documents](https://code.visualstudio.com/api/extension-guides/virtual-documents) |
| Checks | TypeScript compilation, Node's test runner for pure logic/HTTP fixtures, and real Extension Development Host checks | [Node test runner](https://nodejs.org/api/test.html), [extension testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension) |
| Packaging | `@vscode/vsce` as a development dependency; create a VSIX before publishing | [Packaging and publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) |

Keep runtime dependencies empty initially. No UI framework, provider SDK, agent framework, or extra service is needed for these small request/response flows. Resolve development-tool patch versions when installing and commit the lockfile; installed package versions have not yet been verified. Check the minimum VS Code version against every API actually used.

Observed tools in this workspace: Node 26.10.0, npm 11.19.1, Python 3.14.4, Git 2.53.0, and an available `code` executable. These checks establish tool presence, not a working graphical extension host or provider access.

## Where It Runs and How Someone Tries It

### Development and Local Demo

Desktop VS Code, a trusted project folder, and a supported integrated shell with active shell integration are required for automatic capture. Start by verifying the learner's actual local setup. Browser-only VS Code, remote workspaces, and debugger/Output-channel capture are not verified targets for this first package.

Planned root commands, to be created by `5-build`:

```sh
npm install
npm run compile
npm test
```

Open the project in desktop VS Code and press F5 using the planned `.vscode/launch.json`. A separate Extension Development Host window loads the extension. In that window, open `examples/`, choose a provider, enter its key locally, open a saved demo file, and run it in an integrated terminal. Run, for example:

```sh
python3 loop_syntax.py
```

Load the extension into this development window early, not only after standalone tests. Real terminal capture, sidebar behavior, arrow placement, and diff review require testing inside VS Code. This local development step is separate from public Marketplace publication, which follows full workflow and package verification.

The examples must be saved before running. Exercise the learning loop using genuine changed-code retries. Configure each provider in turn and repeat the same scenario. Add a small JavaScript example runnable with `node loop_logic.js` to verify that capture and guidance are not hardcoded to Python; Python remains the main recorded demo.

### Installable Package and Public Release

```sh
npm run package
code --install-extension coding-buddy-0.0.12.vsix
```

`npm run package` will compile and invoke `vsce package`; use the actual generated versioned filename if it differs. Inspect package contents so learner profiles, keys, local logs, course material, and development-only files do not ship.

The learner chose to test locally first and publish to the VS Code Marketplace a few days before preparing the demo, so the public can try it. Public publication is a planned shipping deliverable, not an action performed by this spec. `6-ship` must confirm publisher identity, authentication, package metadata, licensing, and release readiness. A VSIX remains available for testing while publication is prepared. No calendar date or guaranteed Marketplace processing time has been established.

Submission still requires a short accessible demo video and public GitHub repository. A hosted website is unnecessary for this extension. Confirm an explicit open-source license with the learner before public release; do not silently choose one.

## Look and Feel

Implements `prd.md > Look and Feel`.

- Bundle the supplied [robot reference](assets/buddy-reference.png) locally as `media/buddy.png`, scaled in the panel without requiring external image hosting. Use a simple robot-inspired monochrome SVG sidebar icon. Custom animation is not required.
- Use VS Code theme colors and its font variables for readable text, with restrained cyan/teal/orange accents taken from the reference. Support both light and dark themes; keep the text area and controls usable in a narrow sidebar.
- Keep the initial conversation empty. Use the character, status changes, and short teaching messages for personality rather than a wall of chat bubbles.
- Render inline guidance as an editor annotation such as `<------- Check where this loop stops`, with a fuller explanation available in the panel or hover. It must not alter source text.
- Use the built-in diff colors and addition/removal markers. Place explicit Accept Fix and Reject Fix actions in the panel while a review is open.
- Implement a brief local confetti effect in the panel, controlled by the preference and reduced-motion settings. Keep textual success feedback when animation is disabled.
- Render model/user text as text, not executable HTML. Keyboard access, labels, focus visibility, and usable contrast are required.

## Components

### Extension Entry and Connections

`src/extension.ts` registers the sidebar container/view, commands, configuration changes, and cleanup handlers. It connects the following small modules; there is no general-purpose plugin or event-bus layer. Commands include opening settings, setting/removing a provider key, connecting/disconnecting a terminal, retrying a failed request, resetting the current issue, and accepting/rejecting a fix.

Implements `prd.md > Screens and Layout` and `States and Boundaries`.

### Terminal Capture

`src/terminal.ts` listens to `onDidStartTerminalShellExecution` and `onDidEndTerminalShellExecution` automatically. Call `execution.read()` immediately at the start; reading only after completion misses output according to the [API contract](https://code.visualstudio.com/api/references/vscode-api#TerminalShellExecution).

Resolve a source path from the command first; otherwise use a workspace traceback/stack frame. This keeps an explicit entry-file session intact when a helper fails and later succeeds. Snapshot open files at command start; unopened files must predate the run. The active tab is not sufficient evidence for an unnamed manual run. Skip unlinked results quietly and offer Run with Buddy or explicit result sharing. Reject dirty, missing, unsupported, or changed-during-run snapshots. Strip control sequences and cap output. Ignore recognized housekeeping commands. A reliable command or output mentioning the file confirms its source. For missing/uncertain command names without filename evidence, send nothing to the provider and do not create a yes/no question. Run with Buddy captures an explicit file/version and command execution; manual result sharing is learner-reported context. Never guess a solved state or unlock a more specific stage from an unconfirmed result.

File confirmation compares complete normalized paths, resolving relative references against the working directory captured at run start. A basename match alone never confirms the source. If references identify only source files outside the opened workspace, ignore the run and clear stale guidance while retaining per-file learning progress instead of spending tokens or pointing at the active editor. Quoted paths with spaces and file URLs are supported. Rejected model guidance logs only a validation reason code/provider in the Coding Buddy output channel, never its raw response or credentials. Automated shell checks disable history before fixture commands, and demo windows use fresh workspace identities to avoid restoring test terminals.

No attachment or native command-entry dialog is part of the normal flow. The gear menu can pause/resume automatic watching or optionally pin a specific file/terminal. Source and connection freshness guards remain in place. Absent shell integration, interrupted commands, and unknown exit statuses produce a limitation message and the manual-result fallback in settings. Manual sharing can pin the current saved file without requiring a terminal connection. Long-running commands do not create repeated attempts as output streams in.

Implements `prd.md > Context and First Clue` and the learner-agreed completed-command boundary.

### Learning Session and Attempt Rules

`src/session.ts` contains pure, testable rules. The AI supplies a diagnosis; this module owns counts and allowed help levels.

| Event | Local behavior |
| --- | --- |
| First confirmed issue | Save issue summary; zero retry attempts; general clue |
| Changed-code retry, same unresolved issue | Increment only after a valid, current analysis; retries 1–2 stay at clues |
| Third unsuccessful retry | Inline hint becomes allowed |
| Fourth/fifth unsuccessful retry | Continue inline guidance |
| Sixth unsuccessful retry | A fix proposal and explanation become allowed |
| Same code and unchanged relevant context rerun | Keep existing guidance; no extra request or count |
| Clarification | May request analysis; never counts as a code-run attempt |
| Explicitly shared external run result | Label as learner-reported; count only if code changed and analysis confirms the same unresolved issue |
| Missing intent, unknown issue relationship, failed/invalid response, stale run | Do not advance count or claim success |
| Genuinely new issue | Reset to zero and start with a clue; show that the issue changed |
| Provider switch | Cancel stale work and invalidate provider-specific cache/proposals; preserve current issue count |
| Solved tracked issue | Reset count; show success and optional confetti once |

For a retry, compute the maximum level that would be allowed if the issue is the same, then make one analysis request. The response must provide only a general clue if it identifies a new issue. Validate that relationship and the returned help level before committing the transition; do not make an extra AI call solely to advance a stage. A clarification can explain the existing hint but cannot bypass the allowed help level.

Fingerprint requests using source, expected-outcome clarification, watched command, meaningful run result, and provider/model. Ignore transport metadata such as execution IDs and the locally computed level when comparing duplicates; a new-issue reset must not generate a second request for unchanged input. Source-identical reruns never advance attempts. A materially changed input/result is new context, not proof of a code-edit attempt. Coalesce pending identical requests and retain the latest successful response for duplicate suppression.

Keep one active learning session and an in-memory map keyed by source URI. Switching source tabs restores that file’s session, clarification, latest run, and messages; cancel pending work and clear decorations/proposals. Markdown, virtual/diff, and untitled tabs do not erase progress. Reset Issue resets only the current session; restarting the extension clears all sessions. Include related-content revision in fingerprints and changed-source identity, so helper-only edits count without counting same-content saves.

Implements `prd.md > Attempts and Escalation`, `Solved State and Celebration`, and `States and Boundaries`.

### Context and Teaching Response

`src/teaching.ts` builds the common teaching instructions, response schema, and runtime validation shared by the provider calls. Treat file comments and run output as learning material, not instructions that can override the teaching policy. The AI receives no command-execution or file-write tools.

Send the linked file's language and contents, its top-of-file comment, bounded run output and exit status when known, learner clarification, previous issue summary, previous hint, and the locally allowed help level. Include a bounded workspace source index and relevant source excerpts via `src/workspace.ts`. Use Git’s tracked/nonignored file list or a built-in excluded-directory fallback. Prioritize imports, error references, nearby and open code. Exclude hidden files, credentials, dependencies/generated files, and symlinks escaping the workspace root. Index at most 500 source paths; read at most eight related files, 6,000 characters each and 30,000 total. Skip files over 100 KB; label omissions/truncation. Compare clean open buffers with disk, refuse dirty or saved-after-run helpers, and recheck all read content before showing or accepting a response. Avoid credential files such as `.env`, private-key files, and extension secrets. Known key values must never enter prompts, panel messages, logs, or error details.

Initial limits, adjustable only if real examples justify it: 12,000 characters of source (reject larger files rather than silently dropping their comments), the last 8,000 characters of run output with a visible truncation note, and 2,000 characters of learner clarification. Retain at most eight short display messages; send a concise issue summary and relevant latest exchanges rather than the full transcript. Truncated or incomplete evidence cannot support a confident solved verdict.

Require a small JSON object with all fields required, explicit nulls where inapplicable, and no extra fields:

```text
targetFile: exact related-file relative path | null for current file
status: issue | solved | needs_clarification
relationship: same | new | none | unknown
category: syntax | runtime | logic | unknown
intentSource: comment | clarified | inferred | unknown
expectedOutcome: string | null
level: clue | inline | fix | none
message: string
line: integer | null
inlineHint: string | null
replacement: string | null
explanation: string | null
```

Validate field types, enum values, bounded text lengths, line numbers against the captured file, and agreement with the permitted stage. A replacement is allowed only at the fix stage; it targets the captured file or an exactly whitelisted, fully read related file only. Reject unprovided paths, traversal and truncated replacements. A local early-hint guard replaces obvious edit instructions/code with a thinking prompt; subtle leaks remain a live-review risk. Reject a malformed, refused, incomplete, or premature solution response without counting it as an attempt. A valid JSON shape alone does not prove that a diagnosis or teaching hint is correct; verify both with real examples.

For success, require a prior tracked issue, clear expected behavior from the comment/clarification, sufficient observed evidence matching it, and no remaining reported issue. An inferred intention can guide a tentative hint, but unresolved guesses require clarification rather than celebration. With a missing comment, a clarification reply can establish intent; ask for a fresh run if the existing observation is insufficient.

Implements `prd.md > Context and First Clue`, `Proposed Fix and Explanation`, and `Solved State and Celebration`.

### Provider Connections

`src/providers.ts` selects one of three small HTTP request functions and normalizes its response into the teaching object. Requests run in the extension host, not the webview, so keys are not exposed to panel scripts. Use non-streaming requests initially: the UI shows a working status and then a complete validated response.

Use a single pending analysis per session, cancellation on reset/context/provider changes, a 45-second timeout, and manual retry after failure. Do not automatically switch providers or send code to another service after a failure. No speculative background calls or automatic retry loops.

Implements `prd.md > Provider Settings and Open Source` and `States and Boundaries`.

### Buddy Panel and Settings

`src/panel.ts` supplies the webview and handles a small allowlisted message set. `media/panel.js` renders character/status/messages, sends clarification from the reply box, opens the native gear menu for provider/key/model preferences and run-result sharing, and offers fix-review actions. Validate message types and lengths in the extension host. Render user/model content with `textContent`; do not enable command links from model text.

Load only bundled scripts, styles, and images using webview resource URIs. Use a restrictive content security policy, script nonces, and media-only local resource roots. Network calls and key entry remain in the extension host. When the panel is recreated, redraw from the in-memory session rather than creating a new attempt.

`src/settings.ts` keeps provider, per-provider model choice, automatic-watching preference, and confetti preference in user-level VS Code configuration. Key actions use masked `showInputBox` and `context.secrets.store/get/delete`, scoped by provider. The panel shows configured/missing status, never the stored value. Default confetti is enabled unless reduced motion is requested. Switching provider alone does not make a billable connection test; the next intentional analysis verifies access.

Implements `prd.md > Screens and Layout`, `Look and Feel`, and `Provider Settings and Open Source`.

### Inline Guidance and Fix Review

`src/editor.ts` manages a text decoration on the validated line, an in-memory original/proposed document pair, and the diff view. The first complete file replacement is adequate for the small-file proof of concept; no patch parser or multi-file editing system is needed.

Before Accept Fix, check the linked URI, original version/content hash, proposal identity, and current pending status. Apply through `TextEditor.edit` with undo stops so the user can undo. Leave the accepted edit unsaved and show that the learner should save and rerun; do not silently execute the file. On rejection, discard the proposal without changing source. Source edits invalidate proposals and decorations tied to the old version. A model may select only an exact fully-read related-file path from the sent snapshot; validate its current content and root boundary. Acceptance also checks the whole selected context for changes. Only one file changes per reviewed proposal.

Implements `prd.md > Proposed Fix and Explanation` and `States and Boundaries`.

## Data Model

| Information | Location and lifetime |
| --- | --- |
| Provider, per-provider model, automatic watching, confetti | User-level VS Code configuration; updated through settings; survives restart |
| Provider API keys | `ExtensionContext.secrets`, one secret per provider; replace/remove through masked commands; retained across restart, not committed |
| Active file/session; optional advanced terminal pin | Extension memory; automatic capture follows command/traceback source paths within opened folders; manual pins expire on disconnect/restart |
| Run snapshot | Memory: URI, version, source/hash, language, command, bounded output, exit status, run ID; replaced by the next relevant run |
| Learning session | Memory: issue summary, expected-outcome context, retry count 0–6, permitted level, latest guidance/messages, dedupe fingerprint, request generation ID |
| Proposed fix | Memory: original snapshot, replacement, explanation, proposal ID; cleared on rejection, source change, disconnect, or provider/context reset |
| Robot image and styling | Bundled read-only extension files |

No learner code, outputs, or conversations are written to a local database by Coding Buddy. Requests do send selected context to the configured external provider, whose retention and data-use rules still apply. Do not imply that encrypted key storage makes transmitted code private from that provider.

## File Structure

```text
coding-buddy/
├── package.json                 # VS Code contributions, commands, settings, scripts
├── package-lock.json            # Reproducible dependency versions
├── tsconfig.json                # Strict TypeScript build
├── .gitignore                   # Secrets, learner profile, generated output
├── .vscodeignore                # Exclude course/private/development material from VSIX
├── .vscode/
│   ├── launch.json              # F5 Extension Development Host
│   └── tasks.json               # Compile before launching
├── src/
│   ├── extension.ts             # Register and connect the extension pieces
│   ├── terminal.ts              # Selected-command capture and saved-file snapshots
│   ├── workspace.ts             # Source routing, bounded context and freshness
│   ├── playground.ts            # Fresh practice copies in a new window
│   ├── session.ts               # Counts, stages, deduplication, session transitions
│   ├── teaching.ts              # Teaching prompt, response schema, validation
│   ├── providers.ts             # Gemini, OpenAI, and Groq HTTP functions
│   ├── panel.ts                 # Sidebar webview and validated messages
│   ├── settings.ts              # Preferences and encrypted-key commands
│   └── editor.ts                # Arrow decorations, diffs, accepted edits
├── media/
│   ├── buddy.png                # Supplied robot artwork
│   ├── buddy-icon.svg           # Sidebar icon
│   ├── panel.css                # Theme-aware layout and celebration styling
│   └── panel.js                 # Panel behavior and small confetti effect
├── test/
│   ├── session.test.ts          # Real escalation/deduplication/reset cases
│   └── providers.test.ts        # HTTP fixtures, validation, failure/stale-result cases
├── examples/
│   ├── loop_syntax.py           # Small broken example with intended behavior
│   ├── loop_logic.py            # Running example with a wrong loop result
│   └── loop_logic.js            # Small second-language verification
├── README.md                    # Setup, supported environments, key setup, demo steps
├── LICENSE                      # Add after the learner selects a license before release
└── devpost/                     # Canonical learning documents; profile stays ignored
```

Compiled output goes to `out/` and is generated, not hand-maintained. Existing curriculum folders remain unchanged and do not ship in the extension package.

## External Services and Dependencies

### Shared Contract

One intentional analysis calls only the selected provider. Send the teaching instructions separately from serialized learner context. Supply the same response schema in each provider's supported structured-output form and validate the result locally. Cap output at 8,192 tokens and handle truncation/refusal without applying code or advancing counts. Different model families may consume some of this allowance as reasoning; check the cap against the demo.

The following model defaults are recommendations derived from the agreed providers and are part of this draft for review. They have documentation support, but their access, latency, teaching quality, and endpoint behavior have not been live-tested with the learner's accounts. Keep a model setting per provider. Do not silently replace a model or claim a successful integration before testing it.

### Google Gemini

- Initial model: `gemini-3.5-flash-lite`, a documented cost-oriented model with structured-output support. [Model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
- Call: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with `Content-Type: application/json` and `x-goog-api-key` authentication.
- Payload: `systemInstruction.parts[].text` for the teaching policy; `contents: [{role: "user", parts: [{text: serializedContext}]}]`; `generationConfig` with `responseMimeType: "application/json"`, `responseJsonSchema: schema`, and `maxOutputTokens: 8192`.
- Read non-thought text from `candidates[0].content.parts`, check finish reason and block feedback, then parse/validate the JSON object. Missing/blocked/truncated content is a recoverable request failure.
- The Generate Content interface is documented as legacy alongside the newer Interactions API. Use the verified Generate Content contract for this small integration; check continued model compatibility before implementation rather than mixing the two response formats. [Generate Content API](https://ai.google.dev/api/generate-content), [its structured-output guide](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)
- Published standard pricing checked on 2026-10-15: selected model lists a free tier and paid prices of $0.30 input / $2.50 output per million tokens. Availability and quotas depend on the account/project; free-tier data-use rules differ from paid usage. [Pricing](https://ai.google.dev/gemini-api/docs/pricing), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)

### OpenAI

- Initial model: `gpt-6-luna`, the lower-cost choice in the documented current family, with structured-output support. [Model](https://developers.openai.com/api/docs/models/gpt-6-luna)
- Call: `POST https://api.openai.com/v1/responses` with bearer API-key authentication and JSON content type.
- Payload: `model`, `instructions: teachingPolicy`, `input: serializedContext`, `store: false`, `max_output_tokens: 8192`, and `text.format: {type: "json_schema", name: "buddy_response", strict: true, schema}`.
- Read text parts from message items in `output[]` where content type is `output_text`; do not assume the REST response has an SDK-only `output_text` convenience property. Handle refusal, error, and incomplete status before JSON parsing.
- [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) was accessible during research; the detailed create-response reference returned retrieval errors. Verify the exact REST payload with a small real call before building the full UI. This remains a documented early-build check, not a claimed live validation.
- Published standard short-context pricing checked on 2026-10-15: $0.10 input / $0.50 output per million tokens. Free account tier is not supported for this model; confirm API billing and available limits locally. `store: false` is not a promise of zero provider-side retention. [Pricing](https://developers.openai.com/api/docs/pricing), [limits](https://developers.openai.com/api/docs/guides/rate-limits)

### Groq

- Initial model: `openai/gpt-oss-120b`, hosted by Groq. This is a Groq connection with a Groq key, distinct from the direct OpenAI provider above. [Models](https://console.groq.com/docs/models)
- Call: `POST https://api.groq.com/openai/v1/chat/completions` with bearer API-key authentication and JSON content type.
- Payload: `model`, system/user `messages`, `stream: false`, `max_completion_tokens: 8192`, and `response_format: {type: "json_schema", json_schema: {name: "buddy_response", strict: true, schema}}`.
- Parse `choices[0].message.content` only after checking completion/refusal status. Use strict structured output on a documented supported model, without tool calls or streaming. [API reference](https://console.groq.com/docs/api-reference), [structured outputs](https://console.groq.com/docs/structured-outputs)
- Published model pricing checked on 2026-10-15: $0.15 input / $0.60 output per million tokens. Actual access and quotas depend on the account; do not treat published developer-plan limits as the learner's limits. [Models/pricing](https://console.groq.com/docs/models), [rate limits](https://console.groq.com/docs/rate-limits)

Pricing and model availability can change. Show provider/model choice clearly, keep requests bounded, and check current prices/account limits before the learner enables billable usage. No API key is required to review this plan; keys are entered locally during build testing.

## Important Failure Modes

- **Terminal integration missing or the run cannot be tied to saved code:** show the capture limitation, keep earlier guidance available, and offer manual context. Do not simulate a captured run or increment attempts.
- **Missing key, quota, timeout, or unusable model response:** preserve source/counts, show a short actionable message, and offer settings or retry. Avoid raw error bodies that may echo sensitive request context.
- **Source changes while analysis/diff is pending:** cancel or disregard stale output using the snapshot and request generation ID. Require a fresh analysis before accepting an outdated change.
- **AI misjudges a logic issue:** keep inference tentative, use the expected-outcome comment/clarification and actual output, and verify known examples. Never treat one successful run as proof of all program behavior.

## Verification and Early Feasibility Checks

Before investing in panel polish, demonstrate a real command's output/exit status reaching the extension from the learner's integrated terminal. Also verify one small structured request with the first configured provider. If either fails, explain the evidence and revisit the technical approach with the learner; do not replace the central learning loop with canned responses.

Use one focused set of Node tests for the initial-clue/3/6 progression, unchanged reruns, clarification versus explicit external-run reports, new issues, invalid responses, provider switches, and stale results. Use HTTP fixtures to exercise each provider's payload/response mapping, refusal, timeout, and missing-key handling. Fixtures are test data, not the live demo.

In the Extension Development Host verify terminal linkage, arrow placement, keyboard-readable panel, real colored diff, accept/reject behavior, undo, stale-edit protection, confetti on/off, and restart lifetime. Repeated unchanged runs must produce no additional provider requests. Run a small Python syntax/logic scenario and the JavaScript example. Test the full hint-first behavior with Gemini, OpenAI, and Groq before calling provider switching complete; passing a generic connectivity prompt is insufficient.

Finally inspect the VSIX file list, install the package, and repeat the main Python loop. Record what environments/providers were actually verified. Capture the demo only after these checks and the planned public-release preparation.

## What Was Simplified and Why

- One desktop extension with a small bundled panel; use native editor annotations/diff review and direct requests to avoid maintaining separate services.
- Completed commands in integrated terminals, using one candidate source file per run; external/browser/API results enter through the settings menu. This is the learner-agreed boundary for automatic observation.
- Current run source plus bounded related code and a source index across its opened workspace folder; requested by the learner after testing exposed the single-file limitation.
- Current-session hints/counts in memory; preferences and encrypted keys persist. This is the learner-agreed restart behavior.
- Full replacement review for a bounded small file; preserve acceptance, rejection, undo, and stale-file safeguards without building a multi-file patch engine.
- Static supplied character artwork and a small local celebration effect; preserve identity without requiring a character-animation system.
- One provider during early development, all three before submission; the additional connections remain required work.
- Project-building tasks and a harder showcase remain deferred under the approved PRD.

## Decisions and Open Issues

### Learner-Agreed Choices

- Watch completed terminal commands automatically; use manual result/context sharing for browser, Postman, long-running server, or unsupported capture workflows.
- Use a TypeScript desktop extension with a small HTML/CSS/JavaScript panel, native editor features, and direct provider requests.
- Support Gemini and OpenAI, plus the learner's requested Groq addition.
- Limit automatic context to the current file, relevant run output, and clarification; preserve preferences/keys across restarts while current hints/counts reset.
- Build and test locally first; plan public Marketplace publication a few days before preparing the demo.
- Continue Markdown planning reviews and beginner-oriented explanations; the learning goal remains an effective AI workflow and better results.

### Useful Unknown and What Clarified It

The learner described running Python in a terminal, previewing frontend work in a browser, and using Postman for backend APIs. This exposed the uncertainty about how a VS Code buddy can observe different kinds of execution. Official shell-integration documentation established a supported terminal-output path; the learner agreed to completed-command capture plus manual context for external results. A real terminal-capture check early in the build is the evidence still needed. This is an explanation and an agreed investigation, not evidence that the learner has implemented or mastered shell integration.

At review, the learner asked whether connecting the extension to VS Code should wait until thorough testing. Clarified the distinction: load it locally in an Extension Development Host early to test real editor behavior, and publish publicly only after workflow/package checks. This is an agent explanation; hands-on verification remains for the build.

### Derived Implementation Details for Review

The connection control, active session with per-file memories, explicit Share Run Result action for the manual fallback, local attempt controller, schema validation, file-size/output limits, model defaults, native key-entry commands, default enabled confetti with reduced-motion support, and stale-proposal checks are engineering recommendations that implement the agreed experience. They are included in this draft for approval rather than attributed as separate learner choices. The later workspace revision preserves per-file sessions across tab/file changes; hiding the panel does not reset them.

### Checks That Remain

- Exact installed package versions, reproducible lockfile, VS Code minimum-version compatibility, and usable Git metadata must be checked during setup.
- Actual shell integration, terminal/file linkage, model access, API billing/quotas, and teaching quality require live validation. No provider has been called during planning.
- OpenAI's create-response reference could not be retrieved; verify the documented guide-based request during the first small connection check.
- Confirm the user's chosen open-source license before public release. Marketplace publisher identity/authentication and the exact publication date belong in shipping preparation.
- If live evidence forces a change to the accepted product or technical boundaries, explain it and obtain agreement before updating the plan. Do not silently narrow the project to Python or remove a required provider.

## Workspace Revision (0.0.6)

The learner explicitly requested harder project tests, independent test-window launching, and folder context with progress across Python/JavaScript file switches. F5 opens the examples folder directly; Open Playground copies bundled examples to a fresh temporary folder in a new normal-profile window. The harder fixtures cover nested invoice data and percentage discounts, asynchronous API parsing, 404 and 503 behavior. Native tests use isolated folders under the opened test workspace; controller tests keep one activated instance across switches. These extend context and testing, not the deferred project-planning workflow.

## Simple Demo Revision (0.0.7)

Bundle `examples/demo/README.md` and tiny expenses/countdown/greeting fixtures for a rehearsable presentation. Separate full project-context revision (request cache and freshness) from effort revision (primary plus direct-import/error-referenced source). Unrelated-file edits may refresh project analysis but cannot advance attempts. Dependency detection follows import names and observed error paths; indirect-only dependencies with no error reference may need a full dependency graph later.

## Restricted Mode Onboarding (0.0.8)

Declare limited untrusted-workspace support so Buddy is discoverable in fresh, untrusted playgrounds. The panel offers a Trust this folder action opening `workbench.trust.manage`; only the user grants trust. Keep terminal capture disconnected and analysis/manual-result/editor actions blocked before trust. On `workspace.onDidGrantWorkspaceTrust`, refresh the panel and resume watching only if the automatic-hints preference is enabled. Keep the existing analysis trust guard. Test native restricted activation with trust enabled in an isolated profile; the usual terminal suite disables trust for its separate capture checks.

## Run with Buddy (0.0.9)

An editor/title play-circle and palette command launch `.py` with python3 (python on Windows) and `.js`/`.mjs`/`.cjs` with node on VS Code’s PATH. Require trust, allowed workspace source, successful save, and unchanged version after terminal initialization. `src/runner.ts` uses Node’s `spawn` with `shell: false` and a dedicated VS Code pseudoterminal. Retain the original source snapshot and capture only stdout/stderr and exit code. Refuse a second run while busy; closing its terminal or Ctrl+C stops its own process. Basic line input is supported. Preserve unrelated terminals and automatic watching; an explicit run works while automatic watching is paused. Shell-special filenames are literal arguments. The SDK shell runner was rejected after native tests exposed shell substitution and variable prompt text. Unlinked manual runs receive a quiet status, no API call, no attempted-source confirmation and no count change. The button uses the workspace folder as cwd; virtual-environment selection and project/dev-server wrappers are outside this small runner. Native Windows execution remains unverified.

## Successful manual runs (0.0.10)

A learner’s relative zsh command produced `18` but retained an old syntax clue. A native reproduction confirmed that Powerlevel10k supplied a medium-confidence command at start, an empty command at completion, and no cwd. Full error tracebacks had hidden the missing cwd because their paths were absolute. When shell cwd is missing on local Linux, read `/proc/<terminal-process-id>/cwd` while the execution is still pending. Ignore inaccessible, remote, compound-command and late results; never reuse a prior run’s directory or guess from the active editor. Existing source and freshness boundaries remain. Recognized OSC 133/633 command-output markers exclude command echo and later prompts when present. Successful linked output returns through the existing teaching path, replacing obsolete clues and celebrating once only after goal validation. Retain Run with Buddy and explicit sharing for environments without reliable metadata. Other platforms and remote cwd recovery remain unverified.

## Sidebar Personality (0.0.11)

Use the existing HTML/CSS/plain-JavaScript webview and cutout PNG. Scale the padded asset within a bounded scene rather than editing the character. Theme-aware teal, amber and violet accents distinguish the buddy, syntax and logic cards; keep text tied to VS Code foreground colours. The scene, framing, focus styles and composer adapt to narrow/short panels and light/high-contrast themes. `PanelState.hasIssue` is derived from `LearningSession.issue` during refresh; display the clue/closer-look/review trail only while it is true. Mood copy follows working/trust/proposal states. Reuse the existing celebration counter, setting and reduced-motion guard for a brief mascot flourish. Preserve CSP, literal text rendering and the settings/review/trust actions. No additional runtime dependency or network resource. An offline `devpost/sidebar-preview.html` uses real panel markup/styles with sample states; it is excluded from the VSIX.

## Character Motion (0.0.12)

Animate the existing image with CSS transforms: a five-second 4px idle bob, a small 2.4-second thinking tilt, and two short celebration bounces using the existing event/setting guard. Keep the image baseline clear of the scene edge. `codingBuddy.animateCharacter` defaults to true at application scope and has a gear-menu pause/resume action; send it through PanelState and disable mascot animation with a body class. The existing reduced-motion media rule overrides all animation. Presentation-only configuration updates refresh the panel; changes to provider/models/automatic watching still cancel/invalidate guidance. No new image asset, animation dependency, model call, or frame-by-frame JavaScript loop.


## Project Mode (0.0.13)

The learner promoted project building into the current build. Add Debug/Project tabs to the existing webview and a Project Mode palette command. Debug’s per-file session logic stays separate. `src/project.ts` defines a versioned local plan, phase/task progress, short recent conversation, strict provider schemas, bounded validation and safe restoration. `src/projectMode.ts` owns the state machine and saves only validated idea/features/plan/progress/messages through `context.workspaceState` under `codingBuddy.project`. No source, run output, request state or credentials are persisted there. One plan per VS Code workspace; invalid/unknown-version data resets safely.

Phases: idea → feature choice → features/optional clarification → plan review → building → done. Local idea/choice/task-completion actions use no AI. Generate/refine a 3–8 task plan explicitly; each task includes a small conceptual prompt and observable check. Approve before building. Nudge/review uses the current task, recent conversation, active saved allowed source and existing bounded `WorkspaceContext`; include only the latest confirmed run matching that source/version. Missing run evidence cannot produce an advisory ready flag. Ready never completes a task; Mark done is learner controlled. Reuse the existing celebration event on final completion. Reset confirms replacement of saved progress without touching code.

`projectReply` reuses the existing selected-provider authenticated transport and error/timeout/response bounds with separate planning/coaching schemas and a no-implementation policy. Guard all inputs, replies and saved state against known provider keys; require trusted folders. Planning does not collect source. Task coaching keeps source exclusions, real paths and freshness checks; source edits, new runs during code review, provider/key changes and mode switches abort or invalidate pending replies. Normal runs in Project mode retain run evidence without triggering Debug requests. All text renders literally, actions respect trust/working state, and modes preserve separate unsent drafts. No new dependencies, automatic file edits, AI command execution or dependency installation.

Bounds: idea/message 2,000 characters, accumulated feature notes 4,000, 8 recent messages, title 100, task prompt 600, task check 400; source bounds remain unchanged. Save/provider failures remain visible with explicit Retry. Project-mode live teaching and rendered layout require separate rehearsal; source/native fixture checks establish coordination and transport, not model judgment.
