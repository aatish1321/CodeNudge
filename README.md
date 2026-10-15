# Coding Buddy

A VS Code learning companion that helps you think through a problem before showing an answer. A friendly robot gives a clue, points toward the relevant line when you remain stuck, and eventually offers an explained fix you can accept or reject.

## Try it

Install `coding-buddy-0.0.8.vsix` using **Extensions → … → Install from VSIX**. A local build creates this package with `npm run package`. Marketplace publication is planned after live-provider verification.

A fresh playground can open in **Restricted Mode**. Buddy remains visible with a **Trust this folder…** button that opens VS Code’s trust screen. Choose Trust for the playground, or use the top banner’s **Manage** link. Terminal watching and AI analysis stay disabled until you grant trust. After updating the extension, use **Developer: Reload Window** once.

1. Open a trusted project in **desktop VS Code 1.93 or newer** and click the Coding Buddy robot icon.
2. Open the **⚙ settings menu** to select Gemini, OpenAI, or Groq and add its API key. Keys use VS Code secret storage. Provider/key/model options, pause/resume, celebrations, retry/reset, and advanced terminal tools live in this menu.
3. Open a saved code file. A top comment describing its goal helps the buddy understand your intent.
4. Run your code normally in a VS Code terminal—for example, `python3 loop_syntax.py` in `examples`. **No terminal attachment or command-entry dialog is required.**
5. Read the clue, try your own change, save, and run again.

Buddy watches completed runs across the opened folder and integrated terminals. An explicit source path in the command owns that learning session, even when a helper fails; otherwise a workspace traceback/stack frame identifies the file. Relative and quoted paths use the terminal’s working directory. You can run Python with a JavaScript tab focused. If no source is identified, Buddy asks whether the result came from the focused file before spending an AI request. Outside-folder runs are ignored. Recognized housekeeping commands such as `git status` and `ls` are ignored.

Switch between code files and back: each file retains its hints, clarification, and attempt count for this window session. Related-file edits also invalidate cached analysis and count as changed-code attempts when the same issue remains. Buddy includes a source-file index and bounded related code, prioritizing imports and error references. It can point to a helper file and offer a reviewed fix there; each proposal changes one file. It does not read every file’s full contents.

After the initial clue, three unsuccessful **changed-code retries for the same problem** unlock an inline arrow hint. Three more unlock a colored diff with an explanation. **Accept fix** applies that reviewed change; **Keep my code** rejects it. Accepted changes remain unsaved and support normal VS Code undo. Save and run again to check your result.

Rerunning identical code with the same result/context does not spend another AI request or advance the attempt count, including after a failed provider response. Use **⚙ → Retry last result** for an intentional retry. Clarification messages do not count as code attempts. A new problem starts with a fresh clue.

When the same exception type and source line persist, the extension counts changed-code retries locally; the model cannot reset that count just by rephrasing the issue. At the inline threshold, a known error line gets an arrow even if the model fails to supply its own line hint. Other diagnostic formats still rely on the model identifying the same issue and its line. Each new source/result replaces the old guidance. Successful execution removes outdated execution-error advice while the intended output is checked separately for logic mistakes.

## Browser, API, and other results

Automatic observation covers completed commands in integrated terminals with working [VS Code shell integration](https://code.visualstudio.com/docs/terminal/shell-integration). It is not tied to Python; `examples/loop_logic.js` can be run with `node loop_logic.js`.

For browser results, Postman responses, long-running servers, or unavailable terminal capture, use **⚙ → Share a run result** and paste the relevant output. Open and save the corresponding code file first. These are treated as results you report, not results the extension automatically observed. Use the reply box to answer a question or explain the expected outcome instead.

The buddy checks the intended behavior in the top comment, tentatively infers intent if it is missing, and asks for clarification if needed. A successful exit alone does not mean a logic problem is solved. Confetti celebrates a resolved issue; disable it with the panel toggle or `codingBuddy.confetti` in settings. Reduced-motion preferences are respected.

## Providers and privacy

| Provider | Default model | Credentials |
| --- | --- | --- |
| Google Gemini | `gemini-3.5-flash-lite` | Gemini API key |
| OpenAI | `gpt-6-luna` | OpenAI API key with model access/billing |
| Groq | `openai/gpt-oss-120b` | Groq API key |

Model names are configurable in Coding Buddy settings. Use a model supporting the relevant structured-output API. Access, quotas, prices, and data policies belong to your provider; the extension does not supply shared credentials. A failed request does not automatically retry or switch providers.

The run’s source, related source excerpts, relative source-file index, relevant output, and your clarification are sent directly to the **selected provider**. Git-ignored sources, hidden files, credential filenames, dependencies, generated directories, and symlinks escaping the folder are excluded from related context. Without Git, built-in directory exclusions apply. Coding Buddy does not execute AI commands or operate a separate backend. Avoid putting secrets into code or chat. Known saved keys and credential files are blocked from being used as coding context; this is not a universal secret detector.

Provider/model preferences, confetti, and encrypted keys survive restarting VS Code. Current conversation, captured output, active file/session, and attempt counts stay in memory and reset on restart. Closing the panel alone preserves that session.

## Develop and test

```sh
npm ci
npm test
```

To launch the extension yourself:

- **From this repository:** open it in VS Code, press **F5** (or **Run → Start Debugging**), and choose **Run Coding Buddy** if asked. The new **Extension Development Host** opens `examples` automatically. Close that window and press F5 again after changing extension source.
- **From the installed extension:** press **Ctrl+Shift+P** and run **Coding Buddy: Open Playground**, also available under the buddy’s gear. It opens fresh practice copies in a new window, preserving your earlier work and configured provider key. Playground folders are temporary; copy work into your own project to keep it long-term.
- **For your own project:** use **File → Open Folder**, open the robot, and run your code normally. No development window or terminal attachment is needed.

For the presentation, start with the [simple demo walkthrough](examples/demo/README.md): four-line Python expenses, four-line JavaScript countdown, and an optional tiny helper-file example. It includes exact commands, six saved/run retries, and what to show at each stage.

The harder [practice projects](examples/projects/README.md) include a multi-file Python invoice report and asynchronous JavaScript account client with success, missing-account, and service-failure cases. Their bugs are intentional; they are learning fixtures, not passing application tests.

```sh
npm run test:host
npm run test:trust
npm run package
npm run test:package
```

`test:host` opens an isolated VS Code profile and verifies actual extension activation, automatic Python/JavaScript/Bash/zsh capture, multi-file invoice runtime/logic/correct results, asynchronous JavaScript and 404/503 cases, cross-language execution routing, quoted paths, helper changes, editor arrows, native diffs, accept/reject, undo, stale-edit protection, and preferences. `test:package` repeats those checks against the installed VSIX. `test:trust` separately starts a truly untrusted window with trust enabled and verifies pre-trust activation/view access and the native trust screen without auto-trusting. Run `node scripts/test-host.cjs --package --restricted` for that check against the installed VSIX. The automated terminal checks use Bash/Python/Node on Linux and also check zsh when installed; the extension itself is intended for desktop VS Code with supported shells. The normal `code` command must be available on PATH.

Unit tests exercise the activated controller across language switches, workspace boundaries/freshness, fresh playground copies, attempt rules, early-answer guards, and HTTP fixtures for all three provider contracts. Live Groq checks now use the key already stored in VS Code without exposing it. They found early-answer leakage, prompting stricter stage schemas and a local hint guard. See the [verification report](devpost/verification.md) for the exact live and automated coverage. Gemini/OpenAI teaching quality and account access remain unverified; HTTP fixtures alone do not establish them.

Context limits: 12,000 characters in the run’s primary file; up to 500 source paths in its workspace-folder index; up to eight related files, 6,000 characters each and 30,000 combined; the last 8,000 output characters; 2,000 clarification/result-input characters. Omissions and truncated excerpts are labeled for the model; truncated related files cannot be replaced. Related files over 100 KB are omitted. Save related changes before rerunning. New or excluded files may not be read, so the buddy cannot prove the entire project is correct.

Browser inspection, Postman capture, debugger capture, project-planning tasks, and saved chat histories remain outside this version. Long-running servers need a manually shared result. Commands without an identifiable source may need confirmation; compound shell commands and every language/toolchain have not been verified. A local guard catches obvious early edit instructions/code, but subtle answer leakage and diagnosis quality still require real-model review.

The implementation plan and remaining acceptance checks live in [devpost/checklist.md](devpost/checklist.md). [The app map](devpost/app-map.html) is an offline reference to the code.

## Release status

The source is public for development. An open-source license has not yet been selected, so this repository does not currently grant an open-source license. Select a license before publishing the Marketplace release. API keys, learner profiles, and development/course files are excluded from the VSIX.
