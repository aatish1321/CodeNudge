# Coding Buddy

A VS Code learning companion that helps you think through a problem before showing an answer. A friendly robot gives a clue, points toward the relevant line when you remain stuck, and eventually offers an explained fix you can accept or reject.

## Try it

Install `coding-buddy-0.0.4.vsix` using **Extensions → … → Install from VSIX**. A local build creates this package with `npm run package`. Marketplace publication is planned after live-provider verification.

1. Open a trusted project in **desktop VS Code 1.93 or newer** and click the Coding Buddy robot icon.
2. Open the **⚙ settings menu** to select Gemini, OpenAI, or Groq and add its API key. Keys use VS Code secret storage. Provider/key/model options, pause/resume, celebrations, retry/reset, and advanced terminal tools live in this menu.
3. Open a saved code file. A top comment describing its goal helps the buddy understand your intent.
4. Run your code normally in a VS Code terminal—for example, `python3 loop_syntax.py` in `examples`. **No terminal attachment or command-entry dialog is required.**
5. Read the clue, try your own change, save, and run again.

Buddy starts watching automatically. It snapshots the saved code file focused when a command starts and checks that version when the run finishes. A command or traceback naming that file links the result automatically, including zsh runs that omit their command name. If neither identifies the file, Buddy asks in the conversation whether this output came from the focused file. Reply **yes** to confirm, or open the correct file and rerun. Uncertain results do not spend an AI request, advance attempts, or trigger success celebrations. Recognized housekeeping commands such as `git status` and `ls` are ignored. Pause automatic hints in settings whenever you want.

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

The saved code file focused at run start, relevant run output, and your clarification are sent directly to the **selected provider**. Coding Buddy does not scan your entire repository, execute AI commands, or operate a separate backend. Avoid putting secrets into code or chat. Known saved keys and credential files are blocked from being used as coding context; this is not a universal secret detector.

Provider/model preferences, confetti, and encrypted keys survive restarting VS Code. Current conversation, captured output, active file/session, and attempt counts stay in memory and reset on restart. Closing the panel alone preserves that session.

## Develop and test

```sh
npm ci
npm test
```

Open the project in VS Code and press **F5**. In the new Extension Development Host window, open `examples`, configure a provider from the gear menu, open a saved code file, and run it normally. The example programs are intentionally broken; they are learning fixtures, not passing application tests.

```sh
npm run test:host
npm run package
npm run test:package
```

`test:host` opens an isolated VS Code profile and verifies actual extension activation, automatic Python/JavaScript/Bash/zsh terminal capture, editor arrows, native diffs, accept/reject, undo, stale-edit protection, and preferences. `test:package` repeats those checks against the installed VSIX. The automated terminal checks use Bash/Python/Node on Linux and also check zsh when installed; the extension itself is intended for desktop VS Code with supported shells. The normal `code` command must be available on PATH.

Unit tests exercise attempt rules, response validation, and HTTP fixtures for all three provider contracts. **No live AI requests have been verified in this build environment because no provider keys are configured.** Confirm the complete learning flow against real models before a public release; passing fixtures does not establish teaching quality or account/model availability.

Initial context limits: 12,000 source characters, the last 8,000 terminal-output characters, and 2,000 clarification/result-input characters. A truncated observation does not support a solved verdict. One file is analyzed per run, with conversation/counts following that file; multi-file project planning, browser inspection, debugger capture, and saved chat histories are outside this version.

The implementation plan and remaining acceptance checks live in [devpost/checklist.md](devpost/checklist.md). [The app map](devpost/app-map.html) is an offline reference to the code.

## Release status

The source is public for development. An open-source license has not yet been selected, so this repository does not currently grant an open-source license. Select a license before publishing the Marketplace release. API keys, learner profiles, and development/course files are excluded from the VSIX.
