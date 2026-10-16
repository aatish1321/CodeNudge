# Coding Buddy

A VS Code learning companion that helps you think through a problem before showing an answer. A friendly robot gives a clue, points toward the relevant line when you remain stuck, and eventually offers an explained fix you can accept or reject.

## Try it

Install `coding-buddy-0.0.15.vsix` using **Extensions → … → Install from VSIX**. A local build creates this package with `npm run package`. Marketplace publication is planned after live-provider verification.

A fresh playground can open in **Restricted Mode**. Buddy remains visible with a **Trust this folder…** button that opens VS Code’s trust screen. Choose Trust for the playground, or use the top banner’s **Manage** link. Terminal watching and AI analysis stay disabled until you grant trust. After updating the extension, use **Developer: Reload Window** once.

1. Open a trusted project in **desktop VS Code 1.93 or newer** and click the Coding Buddy robot icon.
2. Open the **⚙ settings menu** to choose an AI provider, configure its model/connection, and add a key if required. Keys use VS Code secret storage. Provider/key/model options, pause/resume, celebrations, retry/reset, and advanced terminal tools live in this menu.
3. Open a saved code file. A top comment describing its goal helps the buddy understand your intent.
4. For Python or plain JavaScript, click the editor’s **Run with Buddy** play-circle button, or use **Ctrl+Shift+P → Coding Buddy: Run with Buddy**. It saves the file and launches a linked run in its own terminal. **No terminal attachment, command-entry dialog, or yes/no reply is required.** Other project commands can still run normally in an integrated terminal.
5. Read the clue, try your own change, save, and run again.

Buddy watches completed runs across the opened folder and integrated terminals. An explicit source path in the command owns that learning session, even when a helper fails; otherwise a workspace traceback/stack frame identifies the file. Relative and quoted paths use the terminal’s working directory. When local Linux shells omit that metadata, Buddy reads the running shell’s actual folder from `/proc` before the command ends; it does not infer the folder from the active editor. This fallback skips remote windows and compound commands. Shell command markers remove echoed commands/prompts when available. You can run Python with a JavaScript tab focused. If no source is identified, Buddy quietly skips analysis and points to Run with Buddy or explicit result sharing. It never asks “Was that result from this file?” or guesses that the active tab produced unrelated output. Outside-folder runs are ignored. Recognized housekeeping commands such as `git status` and `ls` are ignored.

Switch between code files and back: each file retains its hints, clarification, and attempt count for this window session. Related-file edits also invalidate cached analysis and count as changed-code attempts when the same issue remains. Buddy includes a source-file index and bounded related code, prioritizing imports and error references. It can point to a helper file and offer a reviewed fix there; each proposal changes one file. It does not read every file’s full contents.

The run button supports `.py`, `.js`, `.mjs` and `.cjs` files, using `python3` (`python` on Windows) or `node` on VS Code’s PATH. It saves and launches only the active file, with the opened workspace folder as the working directory. Its dedicated terminal supports basic line input and Ctrl+C and refuses a second run while busy. Output is captured directly from the program, without shell integration, prompt text or shell evaluation of filenames. Clicking it intentionally runs code even when automatic watching is paused. It does not select a project virtual environment or run React/dev-server commands; use your normal terminal and result sharing for those workflows. Linux runtime is verified; Windows runtime is unverified.

After the initial clue, three unsuccessful **changed-code retries for the same problem** unlock an inline arrow hint. Three more unlock a colored diff with an explanation. **Accept fix** applies that reviewed change; **Keep my code** rejects it. Accepted changes remain unsaved and support normal VS Code undo. Save and run again to check your result.

Rerunning identical code with the same result/context does not spend another AI request or advance the attempt count, including after a failed provider response. Use **⚙ → Retry last result** for an intentional retry. Clarification messages do not count as code attempts. A new problem starts with a fresh clue.

When the same exception type and source line persist, the extension counts changed-code retries locally; the model cannot reset that count just by rephrasing the issue. At the inline threshold, a known error line gets an arrow even if the model fails to supply its own line hint. Other diagnostic formats still rely on the model identifying the same issue and its line. Each new source/result replaces the old guidance. Successful execution removes outdated execution-error advice while the intended output is checked separately for logic mistakes.

## Build an idea with Buddy

Choose **Project** at the top of the sidebar, or **Ctrl+Shift+P → Coding Buddy: Project Mode**.

1. Describe your idea. Buddy asks whether you have features in mind or want a suggested plan.
2. Choose **I have features in mind** and describe them, or **Suggest a plan**. Mention your preferred language/tools. Buddy may ask a short clarification question.
3. Review the 3–8 small tasks, refine the plan in the reply box, then click **Start building**.
4. Work on the current task yourself. **Nudge me** gives a conceptual hint. Open and save your attempt, run it, then click **Check my attempt** for feedback using bounded related-folder context and the latest matching captured run. You can also explain what you tried in the reply box.
5. Try the task’s check and click **Mark done** when satisfied. Buddy suggests; you decide when to advance. Finishing the last step celebrates your progress.

**Cancel project** is visible throughout planning and building, even while Buddy is thinking. After confirmation, it stops the pending request and clears the saved plan/progress, keeping your source files.

One plan and its progress are saved locally with the opened VS Code workspace. Return to Project after reopening the same folder to continue. **Gear → Start a new project plan** replaces the saved plan after confirmation; it keeps your code. Project mode uses your existing selected provider/key. Planning shares your idea, feature notes and plan conversation; task coaching also shares saved code/context when available. It guides you without creating files, running AI commands or writing your implementation.

Terminal runs in Project mode do not automatically request debugging advice. Request **Check my attempt** when ready; use **Debug** for the progressive clue → inline → reviewed-fix loop. With automatic watching paused, use Run with Buddy or explicitly share a result. Code-only review is not proof that a task works, and AI review never marks tasks done. Source files still need to be saved normally.

## Browser, API, and other results

Automatic observation covers completed commands in integrated terminals with working [VS Code shell integration](https://code.visualstudio.com/docs/terminal/shell-integration). It is not tied to Python; `examples/loop_logic.js` can be run with `node loop_logic.js`.

For browser results, Postman responses, long-running servers, or unavailable terminal capture, use **⚙ → Share a run result** and paste the relevant output. Open and save the corresponding code file first. These are treated as results you report, not results the extension automatically observed. Use the reply box to answer a question or explain the expected outcome instead.

The buddy checks the intended behavior in the top comment, tentatively infers intent if it is missing, and asks for clarification if needed. A successful exit alone does not mean a logic problem is solved. Confetti celebrates a resolved issue; disable it with the panel toggle or `codingBuddy.confetti` in settings. Reduced-motion preferences are respected. The robot gently bobs while idle and tilts while thinking; pause or resume this from **⚙ → Pause/Resume character animation**, independently of confetti.

## Providers and privacy

| Provider | Default model | Credentials |
| --- | --- | --- |
| Google Gemini | `gemini-3.5-flash-lite` | Gemini API key |
| OpenAI | `gpt-6-luna` | OpenAI API key with model access/billing |
| Groq | `openai/gpt-oss-120b` | Groq API key |
| [Anthropic Claude](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) | `claude-sonnet-4-6` | Anthropic API key |
| [OpenRouter](https://openrouter.ai/docs/guides/features/structured-outputs) | `openai/gpt-oss-120b` | OpenRouter API key |
| [DeepSeek](https://api-docs.deepseek.com/guides/json_mode/) | `deepseek-flash` | DeepSeek API key |
| [Mistral](https://docs.mistral.ai/api/endpoint/chat) | `mistral-large-latest` | Mistral API key |
| [Ollama (local)](https://docs.ollama.com/capabilities/structured-outputs) | `qwen3:8b` | Optional; local server/model must already be installed |
| Custom OpenAI-compatible | Set your server’s model ID | Optional, depending on your server |

These are configurable starting values, not guarantees of model access or availability. **Gear → Model and connection** (also **Coding Buddy: Configure Model and Connection** in the palette) changes the selected provider’s model. Ollama/custom also ask for the full request URL. Hosted providers require their own API keys; a chat subscription is not an API key. Existing Gemini/OpenAI/Groq keys stay in their original secret-storage slots.

For **Ollama**, install/start Ollama and download a model yourself before selecting it. The [default model](https://ollama.com/library/qwen3:8b) is `qwen3:8b`; you can enter another downloaded model tag. The default full endpoint is `http://localhost:11434/api/chat`. No key is required for a normal local installation. Buddy does not install models or start the server; local performance and context capacity depend on your hardware/model. Ollama Cloud is not the local structured-output connection offered here.

For **Custom OpenAI-compatible**, enter your server’s exact model ID and full `/v1/chat/completions` URL. The default `http://localhost:1234/v1/chat/completions` follows [LM Studio’s documented interface](https://lmstudio.ai/docs/developer/openai-compat/structured-output); replace `local-model` with your loaded model ID and start the server. Use **JSON schema** where supported, or explicitly choose **JSON object** for a compatible server without schema support. This is an API compatibility option, not a promise that every service/model works. Servers must return completed, non-streaming chat-completion JSON, with a JSON string in `choices[0].message.content`.

Endpoint settings are application-wide. Full HTTPS URLs are accepted; unencrypted HTTP is limited to loopback (`localhost`, `127.x.x.x`, `::1`). Credentials, query parameters and fragments in URLs are rejected. Store an optional Ollama/custom token using **Add or update API key**; that provider’s saved token is sent to its configured endpoint, including after you deliberately change it. Redirects are not followed. The extension runs on the desktop side, so localhost means your desktop even in a remote VS Code workspace.

Use a model supporting the relevant structured-output API. Access, quotas, prices, and data policies belong to your provider; the extension does not supply shared credentials. DeepSeek uses JSON object output with the schema in its instructions; other built-in cloud connections request schema output. All replies still pass Buddy’s local teaching/plan validation. OpenRouter routes to a compatible model host through your OpenRouter account. A failed request does not automatically retry, downgrade output format or switch providers.

The run’s source, related source excerpts, relative source-file index, relevant output, and your clarification are sent directly to the **selected provider**. Git-ignored sources, hidden files, credential filenames, dependencies, generated directories, and symlinks escaping the folder are excluded from related context. Without Git, built-in directory exclusions apply. Coding Buddy does not execute AI commands or operate a separate backend. Avoid putting secrets into code or chat. Known saved keys and credential files are blocked from being used as coding context; this is not a universal secret detector.

Provider/model preferences, confetti, and encrypted keys survive restarting VS Code. Project plans, recent project messages and task progress persist locally in workspace storage; they are not written into your repository. Debug conversation, captured output, active file/session, and attempt counts stay in memory and reset on restart. Closing the panel alone preserves that session.

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

Project tests cover custom/suggested planning, approval, progress restoration, learner-controlled completion, trust and stale/cancelled replies. The native suite also checks the actual Project Mode command and saved-source coaching with HTTP fixture replies; this is not live AI acceptance.

Unit tests exercise the activated controller across language switches, workspace boundaries/freshness, fresh playground copies, attempt rules, early-answer guards, and HTTP fixtures for all nine provider choices plus actual loopback HTTP against a test server (not a local model). Live Groq checks now use the key already stored in VS Code without exposing it. They found early-answer leakage, prompting stricter stage schemas and a local hint guard. See the [verification report](devpost/verification.md) for the exact live and automated coverage. New provider/local-model teaching quality and account access remain unverified; HTTP fixtures alone do not establish them.

Context limits: 12,000 characters in the run’s primary file; up to 500 source paths in its workspace-folder index; up to eight related files, 6,000 characters each and 30,000 combined; the last 8,000 output characters; 2,000 clarification/result-input characters. Omissions and truncated excerpts are labeled for the model; truncated related files cannot be replaced. Related files over 100 KB are omitted. Save related changes before rerunning. New or excluded files may not be read, so the buddy cannot prove the entire project is correct.

Browser inspection, Postman capture, debugger capture, saved Debug chat histories remain outside this version. Long-running servers need a manually shared result. Commands without an identifiable source are skipped without confirmation; compound shell commands and every language/toolchain have not been verified. A local guard catches obvious early edit instructions/code, but subtle answer leakage and diagnosis quality still require real-model review.

The implementation plan and remaining acceptance checks live in [devpost/checklist.md](devpost/checklist.md). [The app map](devpost/app-map.html) is an offline reference to the code.

## Release status

The source is public for development. An open-source license has not yet been selected, so this repository does not currently grant an open-source license. Select a license before publishing the Marketplace release. API keys, learner profiles, and development/course files are excluded from the VSIX.
