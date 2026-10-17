<h1 align="center">CodeNudge</h1>

<p align="center">
  <img src="media/buddy.png" alt="CodeNudge’s friendly robot mascot typing at a keyboard" width="480">
</p>

<p align="center"><strong>A little nudge. A lot of learning.</strong></p>

<p align="center">
  An AI coding companion inside VS Code that helps beginners think through errors<br>
  and turn their project ideas into small, achievable steps.
</p>

<p align="center">
  <a href="#how-it-works">How it works</a> ·
  <a href="#features">Features</a> ·
  <a href="#try-it">Try it</a> ·
  <a href="examples/demo/README.md">Demo walkthrough</a>
</p>

## Why CodeNudge?

You have an idea. You write a few lines. An error appears—and suddenly you have no idea what to try next.

CodeNudge is built for that moment. It sits beside your code like a patient senior helping a junior: a small clue first, a closer look when you remain stuck, and an explained fix you can review when you need more help. You still get to investigate, experiment, and make the discovery yourself.

It is designed for people starting to code, learners building their first projects, and anyone who wants support while developing the confidence to solve problems independently.

## How it works

### Debug mode: learn through the error

Run your code, read a clue, try a change, and run again. Help becomes more specific as you work through the same problem.

| Stage | What you see | When it appears |
| --- | --- | --- |
| **A clue** | A short, beginner-friendly question or hint about the issue. | The first linked run that needs help. |
| **A closer look** | An inline arrow and a hint beside the relevant line. | After three unsuccessful changed-code retries for the same issue. |
| **A little backup** | A colored diff showing a proposed fix, plus an explanation of what changed and why. | After three more unsuccessful changed-code retries. |
| **Your discovery** | Solved feedback and optional confetti. | When the run’s evidence supports the intended result. |

**You control the fix.** Accept the proposal or keep your code. Accepted edits stay unsaved and support VS Code undo; save and run again to check the result. A successful exit alone does not prove the output is correct.

Rerunning identical code with the same result and context reuses the previous analysis. It does not spend another AI request or advance the help stage. You can explicitly retry from settings.

### Project mode: build an idea one step at a time

1. **Describe your idea.** A rough starting point is enough.
2. **Choose how to plan.** Share features you already have in mind, or ask CodeNudge to suggest a plan.
3. **Make it yours.** Review and refine a plan of 3–8 small tasks before starting.
4. **Try the current task.** Write your own code, ask for a conceptual nudge, or request feedback on your saved attempt and available run output.
5. **Decide when to move on.** Try the task’s check, then mark it done yourself.

Your plan and progress stay saved with the opened workspace. **Cancel project** lets you change your mind, including while a request is pending; it clears the plan after confirmation and keeps your code files.

While building, use **Check my attempt** when you want a review. Switch to **Debug** for the automatic error-help loop. AI feedback never marks a task complete for you.

## Features

| Feature | What it helps you do |
| --- | --- |
| **Help inside your editor** | Keep your code, terminal, and learning companion together in a VS Code sidebar. |
| **Context across files** | Investigate entry files and relevant helpers using bounded workspace context; retain Debug conversations and attempts when switching files within the window. |
| **Support beyond Python** | Work across source languages and identifiable completed terminal runs. Python and JavaScript are the verified demo paths. |
| **Run with CodeNudge** | Save and run a Python or plain JavaScript file directly, with its source and output linked automatically. |
| **Bring your own AI** | Choose a hosted provider, a local Ollama model, or a compatible custom server. |
| **A companion with character** | Meet an animated robot with a patient teaching voice, optional celebrations, and reduced-motion support. |
| **Your work stays yours** | Review proposed edits, control task completion, and keep provider keys in VS Code’s secure storage. |

## Choose your AI

The same selected connection works in both Debug and Project mode.

| Hosted providers | Local and custom options |
| --- | --- |
| Google Gemini · OpenAI · Groq | **Ollama** with a locally installed model |
| Anthropic Claude · OpenRouter · DeepSeek · Mistral | **Custom OpenAI-compatible** chat completions, including the documented LM Studio interface |

Use **⚙ → AI provider** to choose a connection, then **Model and connection** to set its model and, where applicable, full endpoint. Named hosted services require your own API key; Ollama/custom can work without a key when the server allows it.

Models must support the connection’s JSON output format. CodeNudge validates replies before using them. It does not automatically switch providers, retry failed calls, or download local models. See the [provider setup guide](docs/usage.md#providers-and-privacy) for defaults, endpoint examples, compatibility, and privacy details.

## Try it

You need **desktop VS Code 1.93 or newer** and access to your chosen AI provider or local server. The extension is free; hosted AI services may charge for API use. A chat subscription does not include an API key. Install Python or Node.js separately to run the corresponding practice examples.

1. In VS Code, search Extensions for **CodeNudge** by **aatishdev** and install it once the Marketplace listing is live. Before publication, use **Extensions → … → Install from VSIX** with `codenudge-0.0.21.vsix` (see [building from source](#development-and-verification)).
2. Run **Developer: Reload Window**, then open a folder and click the robot icon.
3. Open **⚙** to choose your provider, configure its model/connection, and add a key if needed.
4. For a fresh practice folder, run **CodeNudge: Open Playground** from the Command Palette. Grant folder trust when you are ready; CodeNudge stays visible in Restricted Mode but code sharing and execution require trust.
5. Choose **Debug** and open `practice/count_up.py` for a fresh beginner exercise or `demo/expenses.py` for the presentation walkthrough. For a tiny Project-mode task, follow the [quiz practice guide](examples/practice/README.md#tiny-project-mode-project-a-three-question-quiz).

The three new exercises are bundled starting with **0.0.17**. After updating, reload VS Code and open a **new** playground to get them; existing playground copies preserve your edits.

For Python and plain JavaScript, the editor’s **Run with CodeNudge** button saves and runs the active file without manually attaching a terminal. For browser results, Postman responses, or long-running servers, use **⚙ → Share a run result**. Automatic browser/API inspection is outside this preview.


## Built with

- **TypeScript + the VS Code Extension API** for workspace access, commands, terminal observation, and local progress.
- **HTML, CSS, and JavaScript** for the sidebar and character animation.
- **Native editor decorations and diff review** for inline hints and proposed changes.
- **Direct provider HTTP requests** with JSON response contracts, validation, and cancellation; no separate application backend.
- **Node’s test runner** plus isolated VS Code integration checks.

The local learning controller manages attempts, duplicate runs, source freshness, and help stages. The selected model supplies guidance within those boundaries. Project plans and progress are saved in workspace storage; Debug conversations and attempt counts last for the current window session.

## Privacy and control

API keys are stored in **VS Code SecretStorage**. Relevant code, bounded related-file excerpts, a source-file index, run output, and your clarification go to the selected provider or configured server when needed. Initial Project planning shares your idea and feature notes without collecting source code.

Automatic checking is enabled by default in trusted folders once your connection is configured. Use **⚙ → Pause automatic hints** before running code you do not want shared. CodeNudge has no analytics or telemetry service; your AI provider or configured server has its own data-handling terms.

Hidden files, known credential filenames, dependencies, generated files, Git-ignored sources, and paths escaping the workspace are excluded from coding context. Known saved keys are checked before sharing. These checks are not a universal secret detector, so keep credentials out of code and messages. A local endpoint receives the context locally; where it processes data depends on how you configure that server.

CodeNudge does not execute AI-supplied commands or automatically apply project code. Full context limits and connection safeguards are documented in the [usage guide](docs/usage.md).

## Development and verification

The Devpost Learn Skill Pack planning documents are available in the repository: [scope](devpost/scope.md), [product requirements](devpost/prd.md) and [technical spec](devpost/spec.md). The [build checklist](devpost/checklist.md) records implementation, revisions and remaining final-review work.

```sh
git clone https://github.com/aatish1321/CodeNudge.git
cd CodeNudge
npm ci
npm test
npm run package
```

To run from source, open this repository in VS Code and press **F5 → Run CodeNudge**. The Extension Development Host opens the examples folder. Additional checks:

```sh
npm run test:host
npm run test:trust
npm run test:package
```

The latest verified build passed **107 source tests**, installed VS Code workflow checks, and a separate Restricted Mode check. Coverage includes progressive help, file switching, stale replies, diff review, Project progress, provider contracts, secure key handling, and actual local HTTP transport with fixture responses.

Live Groq Debug-stage probes are recorded separately. New provider/local-model teaching quality, full live Project-mode acceptance, and Windows runtime behavior remain unverified. See the [verification report](devpost/verification.md) for evidence and limitations, and the [usage guide](docs/usage.md#develop-and-test) for test setup.

## Project status and contributions

CodeNudge is an **open-source preview**, developed for the Build With AI hackathon. The current release candidate is **0.0.21**; Marketplace publication is pending.

The [Marketplace release checklist](docs/marketplace-release.md) tracks testing and publication preparation. See the [changelog](CHANGELOG.md) for local build history and [support guide](SUPPORT.md) for troubleshooting and bug reports.

Feedback is welcome: try a practice example, describe what you expected and what happened, and share a small reproduction through [GitHub Issues](https://github.com/aatish1321/CodeNudge/issues). Remove keys and personal data from reports and recordings. Development areas include wider live-provider testing, more language/toolchain verification, and public-release preparation.

## License

CodeNudge is licensed under the [MIT License](LICENSE). You may use, modify, and redistribute it, including commercially, while keeping the copyright and license notices. AI providers and third-party components retain their own terms.
