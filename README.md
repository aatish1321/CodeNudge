<h1 align="center">CodeNudge</h1>

<p align="center"><strong>A little nudge. A lot of learning.</strong></p>

<p align="center">
  <img src="media/buddy.png" alt="CodeNudge’s friendly robot mascot typing at a keyboard" width="380">
</p>

<p align="center">
  An AI coding companion inside VS Code.<br>
  Practise a new concept, work through an error, or build your first idea—one discovery at a time.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=aatishdev.codenudge"><img src="https://img.shields.io/badge/VS_Code-Install-64d8cb?style=flat-square" alt="Install CodeNudge for VS Code"></a>
  <a href="https://github.com/aatish1321/CodeNudge/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-f6c66c?style=flat-square" alt="MIT license"></a>
  <a href="https://learn-ai-basics.devpost.com/"><img src="https://img.shields.io/badge/Build_With_AI-Basics-b6a0ff?style=flat-square" alt="Built for Build With AI: Basics"></a>
</p>

<p align="center">
  <a href="#two-ways-to-learn">Explore the modes</a> ·
  <a href="#get-started">Get started</a> ·
  <a href="#hackathon-field-guide">Hackathon files</a> ·
  <a href="https://github.com/aatish1321/CodeNudge/blob/main/CONTRIBUTING.md">Contribute</a>
</p>

## Why CodeNudge?

You have an idea. You write a few lines. An error appears—and suddenly you have no idea what to try next.

CodeNudge is built for that moment. It sits beside your code like a patient senior helping a junior: a small clue first, a closer look when you remain stuck, and an explained fix you can review when you need more help. You still get to investigate, experiment, and make the discovery yourself.

It is designed for people starting to code, learners building their first projects, and anyone who wants support while developing the confidence to solve problems independently.

## Two ways to learn

| 💡 “I'm learning something new.” | 🌱 “I've got an idea to build.” |
| --- | --- |
| **Debug mode** follows your completed runs and offers clues about errors or unexpected output. | **Project mode** helps turn your idea into a reviewable plan of 3–8 small tasks. |
| Try a change, run again, and receive more specific help when you remain stuck. | Write the implementation yourself, ask for a nudge, and review one task at a time. |
| Your conversations and attempts stay with each file while you switch tabs in the current window. | Your plan and progress stay saved with the opened workspace. |

### The learning loop

<p align="center">
  <code>YOUR ATTEMPT</code> → <code>A CLUE</code> → <code>A CLOSER LOOK</code> → <code>YOUR DISCOVERY</code>
</p>

| Moment | What CodeNudge does | What stays in your hands |
| --- | --- | --- |
| **First linked run needs help** | Gives a short clue or asks about your intended result. | Investigating and trying your own fix. |
| **Three changed, unsuccessful retries on the same issue** | Points toward the relevant line with an inline arrow and hint. | Deciding what to change next. |
| **Three more unsuccessful retries** | Offers a colored diff and an explanation of the proposed fix. | Accepting or rejecting the reviewed change. |
| **The run supports the intended result** | Shows solved feedback and optional confetti. | Checking what you learned and trying it again. |

The first failure starts the issue; it is not a retry. Identical source, result and context reuse the previous analysis without another AI request or stage advancement. Clarification messages do not count as attempts. An explicit Retry is available in settings.

Accepted changes remain unsaved and support VS Code undo. Save and rerun to verify the result. A successful exit alone does not establish that a logic problem is solved.

## Get started

**[Install CodeNudge from the Visual Studio Marketplace →](https://marketplace.visualstudio.com/items?itemName=aatishdev.codenudge)**

Or install from your terminal:

```sh
code --install-extension aatishdev.codenudge
```

You need desktop **VS Code 1.93 or newer** and a supported AI connection. Hosted services require your own API key and may charge for use; a chat subscription does not supply an API key. Install Python or Node.js separately to run those practice files.

1. **Open a folder and the robot sidebar.** In Restricted Mode, CodeNudge stays visible; grant folder trust when you are ready to enable code sharing and execution.
2. **Choose your AI through ⚙.** Select a provider, configure the model/connection, and add a key when required.
3. **Choose Debug or Project.** For fresh examples, run **CodeNudge: Open Playground** and expand `practice`.
4. **Write, run, and investigate.** For Python and plain JavaScript, use the editor's **Run with CodeNudge** action. It saves and runs the active file with its output linked automatically.

The playground includes [three beginner exercises and a tiny quiz project](examples/practice/README.md), a [controlled feature walkthrough](examples/demo/README.md), and [harder multi-file Python/JavaScript examples](examples/projects/README.md). Their mistakes are intentional practice material. After an update, reload VS Code and open a new playground; existing copies preserve your edits.

For browser results, Postman responses and long-running servers, use **⚙ → Share a run result**. Automatic browser/API inspection is outside this preview. More setup and troubleshooting details are in the [usage guide](docs/usage.md) and [support guide](SUPPORT.md).

<details>
<summary>Upgrading from an early local build?</summary>

The published extension ID is `aatishdev.codenudge`. Earlier local builds used `aatish1321.coding-buddy` or `aatishdev.coding-buddy`. Remove the earlier extension to avoid duplicate commands/views. Saved keys and workspace progress do not automatically transfer between these identities; configure the published extension again. The internal `codingBuddy.*` settings prefix remains in use.

</details>

## Try a real learning exercise

Learning JavaScript array methods? Open a fresh folder, choose **Debug**, and start `passing_scores.js` with:

```javascript
// Keep scores of 50 or higher. Expected result: [76, 50, 91].
const scores = [42, 76, 50, 91, 33];
```

Write your own attempt using `filter()`, print the result, and run it. Use CodeNudge when you actually get stuck. Then test `[49, 50, 51]` and an empty array to check your understanding. If you solve it with the first clue, that is a useful outcome too; you do not need to force six failed attempts.

For **Project mode**, describe something small, such as a three-question Python quiz or a shared-expense splitter. Supply your own features or choose **Suggest a plan**, refine it, and start building. Use **Nudge me** for conceptual help and **Check my attempt** for saved-code/run feedback. Try the task's check yourself before **Mark done**. AI reviews are advisory and never advance a task automatically.

**Cancel project** clears the saved plan/progress after confirmation, including while a request is pending, and keeps your source files. Switch between Project and Debug as needed.

## Choose your AI

Both modes use your selected connection. There are **nine connection options**:

| Hosted providers | Local and custom options |
| --- | --- |
| Google Gemini · OpenAI · Groq | **Ollama** with an already-installed model |
| Anthropic Claude · OpenRouter · DeepSeek · Mistral | **Custom OpenAI-compatible** chat completions, including the documented LM Studio interface |

Choose **⚙ → AI provider**, then **Model and connection**. Hosted providers require keys; local/custom connections allow an optional key when the server supports it. Models must support the configured JSON output format. CodeNudge validates replies and does not automatically retry, switch providers or download models. See [connection defaults and compatibility](docs/usage.md#providers-and-privacy).

The character has idle/thinking motion and optional celebrations. Animation and confetti have separate settings, and reduced-motion preferences are respected.

## Hackathon field guide

Built for **[Build With AI: Basics](https://learn-ai-basics.devpost.com/)** using the [Devpost Learn Skill Pack](https://github.com/challengepost/learn-ai-basics).

The planning trail is part of the repository:

| Document | What it records |
| --- | --- |
| [**scope.md**](devpost/scope.md) | The audience, core learning loop and proof-of-concept boundary. |
| [**prd.md**](devpost/prd.md) | The user journey, progressive-help rules, states and acceptance criteria. |
| [**spec.md**](devpost/spec.md) | The extension architecture, providers, data boundaries and verification approach. |
| [Build checklist](devpost/checklist.md) | Ordered implementation, revisions and final-review status. |
| [App map](devpost/app-map.html) | A source-linked HTML reference to the implemented workflow; download and open locally. |
| [Verification report](devpost/verification.md) | Checks performed, live-provider probes and their limits. |

**All three required planning files are committed under `devpost/`.** The [reviewer index](devpost/README.md) connects the requirements to the files without duplicating the plans. They began under the working name *Coding Buddy*; later revisions record CodeNudge and the expanded features.

**Demo video:** a final public video link has not been added to this repository yet. The [recording/readiness guide](docs/hackathon-readiness.md) tracks the required video, submission checks and recording mechanics. A recording should show genuine use and the final result; clearly label cuts between attempts in a controlled feature demonstration.

## Under the hood

| Part | Implementation |
| --- | --- |
| Editor integration | TypeScript and the VS Code Extension API. |
| Sidebar and character | HTML, CSS and JavaScript with bundled artwork. |
| Teaching behavior | A local controller tracks attempts, duplicate runs and source freshness; the selected model supplies guidance within those limits. |
| Inline help and fixes | Native editor decorations and diff review; each proposal targets one reviewed file. |
| AI connection | Direct provider HTTP requests with validated JSON responses and cancellation; no separate CodeNudge backend. |
| Context | A bounded source index and related-file excerpts, prioritizing imports and error references. |

Python and JavaScript are the verified demo paths. The design supports other source languages and identifiable completed terminal runs; it does not read every workspace file in full or establish tested behavior for every toolchain.

## Privacy and control

- **Your connection, your choice.** Relevant code, bounded related excerpts, a source-file index, output and clarification go to the selected provider/server when needed. Initial Project planning shares your idea and feature notes without collecting source code.
- **Keys stay in VS Code SecretStorage.** Automatic hints are enabled by default in trusted folders once configured. Use **⚙ → Pause automatic hints** before running code you do not want shared.
- **Context has boundaries.** Hidden files, known credential filenames, dependencies, generated files, Git-ignored sources and paths escaping the workspace are excluded. These guards are not a universal secret detector; keep credentials out of source and messages.
- **Edits stay reviewable.** CodeNudge does not execute AI-supplied commands or automatically write project code. There is no CodeNudge analytics/telemetry service; provider/server data handling depends on your connection.

See the [full privacy and provider details](docs/usage.md#providers-and-privacy).

## Build and verify

For development or a local VSIX, use Git and Node.js/npm:

```sh
git clone https://github.com/aatish1321/CodeNudge.git
cd CodeNudge
npm ci
npm test
npm run package
```

Install the generated `codenudge-0.0.21.vsix` through **Extensions → … → Install from VSIX**, or press **F5 → Run CodeNudge** in the repository to open the Extension Development Host.

<details>
<summary>Additional VS Code integration checks</summary>

```sh
npm run test:host
npm run test:trust
npm run test:package
```

Package before running `test:package`. Native checks require an installed desktop VS Code and a graphical session; shell/runtime checks also require the corresponding tools. Run native suites separately because editor-focus assertions can be sensitive to concurrent windows.

</details>

The recorded verification includes **107 source tests**, installed VS Code workflows and a separate Restricted Mode check. Provider contract tests use fixtures and local HTTP responses; live Groq Debug-stage probes are documented separately. The maintainer reports a manual test pass. Broad live-provider/local-model teaching quality, Windows/macOS behavior and the minimum supported VS Code version still have incomplete coverage. See the [evidence and exact limits](devpost/verification.md) and [release record](docs/marketplace-release.md).

## Contribute a nudge

CodeNudge is a published **open-source preview**, currently **0.0.21**. Helpful contributions include clearer beginner guidance, reproducible bug reports, provider compatibility checks and verified language/toolchain examples.

Read [CONTRIBUTING.md](CONTRIBUTING.md) to work on the code, [SUPPORT.md](SUPPORT.md) for troubleshooting, or the [changelog](CHANGELOG.md) for the release history. Remove credentials and private code from reports and recordings.

## License

[MIT](LICENSE) · Copyright © 2026 aatish1321. Third-party components and AI services retain their own licenses and terms.
