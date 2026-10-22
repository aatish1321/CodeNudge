# Changelog

Release changes are listed below. The [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=aatishdev.codenudge) shows the currently published version; preparing a package does not publish it.

## 0.0.28

- Reworked the sidebar as an arcade-inspired coding sidekick: a larger animated robot, pixel accents, chunky controls and bold mint/gold/coral panels.
- Added a three-segment effort meter tied to actual changed runs, with explicit clue/inline/review progress kept visible while scrolling. An unlocked review stage stays distinct from a fix ready to accept.
- Gave Project mode clearer task/check sections and primary/secondary actions. Kept the supplied character, optional motion/confetti, reduced-motion support, keyboard send and native-theme surfaces.
- Teaching, provider, terminal, stage thresholds, source sharing and reviewed-edit behavior are unchanged.

## 0.0.27

- Distinguished rejected analysis requests, malformed model generations, unavailable models and rate limits instead of blaming model support for every HTTP 400.
- Recovered complete JSON from Groq’s `json_validate_failed` response without a second request; the same local key/stage/target/edit validation still applies.
- Bounded error-body reads and logged only HTTP status plus an allowlisted error code, keeping raw provider messages and generations out of logs.
- Verified live Groq clues, inline targeting, a reviewed-fix response and corrected-output success for the negative-number maximum exercise; fixture tests cover the error-recovery path.

## 0.0.26

- Preserved changed-code retry effort across different errors in an unresolved task. Moving from a name error to a type error or output issue no longer restarts the clue stage.
- Made the host’s count control the provider help stage even for a new diagnosis, and refreshed the current issue summary and inline location.
- Kept the initial clue/three retries/three more rhythm, unchanged-run caching, separate file sessions, reviewed edits and verified-success/manual reset boundaries.
- Added a real Python greeting regression covering changing errors and a reviewed fix, with model replies supplied as fixtures.

## 0.0.25

- Recovered contradictory AI issue/stage labels as safe clues instead of repeatedly showing “couldn’t read that AI reply.”
- Clarified the shared provider instructions: a continuing problem keeps its stage, and an issue cannot use the no-hint stage.
- Added regressions for a valid-running greeting exercise progressing through clues, inline guidance and a reviewed fix. Unchanged reruns stay cached; premature fixes and invalid targets remain blocked.

## 0.0.24

- Prepared the goal-based teaching changes and polished README together as a Marketplace update.
- Updated setup, support, hackathon and contributor-facing release information; clarified that pausing automatic hints does not disable explicit analysis actions.
- Kept the existing extension identity, settings, saved-key slots, Project storage and non-Preview status. Runtime behavior is unchanged from the tested 0.0.23 build.

## 0.0.23

- Made Debug guidance goal-based: a comment describing the task can establish intent without the learner knowing the exact answer.
- Instructed the model to compare the supplied input/output with the task independently, and ask about the task/concept only when the goal is ambiguous.
- Reworded clarification and verification messages so they do not require the correct result; preserved evidence, stage and inferred-intent safeguards.

## 0.0.22

- Removed the manifest Preview flag so the next Marketplace update can remove the Preview label.
- Refreshed the repository README with a two-mode guide, the learning loop, Marketplace installation and a prominent index of hackathon planning evidence.
- Added contributor guidance and corrected current documentation to reflect the published extension identity and status.
- Runtime behavior, settings, saved keys and Project storage are unchanged.

## 0.0.21

- Resized the Marketplace icon to 512 × 512 pixels (69,722 bytes), within both upload limits: 1024 × 1024 pixels and 1024 KB.
- Runtime behavior is unchanged.

## 0.0.20

- Used the supplied compressed square JPEG for the Marketplace icon (276,157 bytes), below the 1024 KB upload limit.
- Kept the in-editor mascot and runtime behavior unchanged.

## 0.0.19

- Changed the package name to `codenudge`, matching the CodeNudge product name. The Marketplace extension ID is `aatishdev.codenudge`.
- Updated settings links and installed-extension checks for that ID. Earlier local identities do not automatically transfer saved keys or workspace progress.

## 0.0.18

- Prepared the Marketplace preview listing with the robot icon, gallery styling, and source/support links.
- Added installation guidance, provider cost information, and a clearer explanation of automatic code sharing and privacy.
- Corrected the Marketplace publisher to `aatishdev` (`aatishdev.coding-buddy`). Local builds under `aatish1321.coding-buddy` have a different identity; saved keys and workspace progress do not automatically transfer.
- Updated the extension settings link for the corrected identity; teaching behavior is unchanged.

## 0.0.17

- Bundled the three fresh beginner exercises and tiny quiz project guide in new playgrounds under `practice`.
- Included the MIT license, hackathon readiness guide and direct planning-document links in the updated local package.
- Existing playground copies keep their edits; reload after updating and open a new playground for the new files.

## 0.0.16

- Added the MIT license and aligned package metadata and release documentation.
- Updated the extension, sidebar, commands, settings, terminal, diff view and playground to the CodeNudge name.
- Kept existing extension identifiers, saved provider keys, settings and Project progress compatible.
- Renamed the installable package to `codenudge-0.0.16.vsix`.
- Updated setup instructions and the demo walkthrough.

## 0.0.15

- Added Anthropic Claude, OpenRouter, DeepSeek, Mistral, local Ollama and custom OpenAI-compatible connections alongside Gemini, OpenAI and Groq.
- Added model/connection setup, optional local/custom authentication and a custom JSON output setting.
- Applied the selected connection to both Debug and Project mode.

## 0.0.14

- Added a visible Cancel project button during planning and building.
- Confirmation clears saved plan/progress, stops pending guidance and preserves source files.

## 0.0.13

- Added Project mode: describe an idea, supply features or request a plan, review the plan and build one small task at a time.
- Added conceptual nudges, attempt reviews, learner-controlled task completion and saved workspace progress.

## Earlier local builds

- Added progressive Debug clues, inline hints, explained fix proposals and native accept/reject review.
- Added workspace context, per-file learning sessions, direct Python/JavaScript runs and fresh practice playgrounds.
- Added the robot sidebar, character animation, optional celebrations and Restricted Mode onboarding.

Detailed development verification is recorded in [devpost/verification.md](devpost/verification.md).
