---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast. The learner explicitly requested the full build with no explanations, hands-on pauses, or additional approvals. Agent verification replaces the planned learner checkpoints; do not record unperformed learner testing as completed.

Git workflow: Keep verified checkpoints on `main`. Create a separate `build/NN-description` branch for each slice, commit its verified work, and merge it into `main` after agent checks pass. Learner feedback pauses were waived by explicit instruction.

We will build in slices: small working steps the learner can try. Each step includes its own checks and Git checkpoint. The first step proves real terminal capture and real hint generation before further interface polish.

## Slices

- [x] **1. Run broken code and receive a real first clue in VS Code**
  Becomes usable: The robot sidebar opens locally, a saved code file is connected to a selected terminal, and a completed command produces a real hint through Gemini. The learner can answer a clarification question.
  Why now: Includes bootstrapping while testing the two biggest assumptions immediately: actual terminal output capture and a real provider returning hint-first teaching guidance.
  PRD ref: `prd.md > The Core Journey`, `prd.md > Context and First Clue`, `prd.md > Screens and Layout`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Stack`, `spec.md > Development and Local Demo`, `spec.md > Extension Entry and Connections`, `spec.md > Terminal Capture`, `spec.md > Context and Teaching Response`, `spec.md > Google Gemini`, `spec.md > Buddy Panel and Settings`
  Build: Create the extension manifest, TypeScript build, F5 launch setup, bundled robot panel, Gemini key entry through secret storage, provider request/response validation, saved-file terminal linkage, and a Python syntax example. Show first clues and clarification replies; protect file/context boundaries, cancel stale requests, and suppress unchanged duplicate requests. Add understandable missing-key, capture, and request-failure feedback. Keys are entered locally, never in chat.
  Verify (mechanical): Run TypeScript compilation and focused Node tests for context limits, Gemini request/response parsing, invalid responses, duplicate requests, and stale snapshots. In a real Extension Development Host, observe a completed Python command's captured output/exit status and a valid Gemini clue, confirming no complete solution is revealed. Rerun unchanged code and verify that the provider-request count does not increase. A fixture alone does not satisfy either live feasibility check; record any inaccessible runtime/provider evidence as pending rather than passed.
  Learner check: Press F5, open the buddy icon, configure Gemini locally, connect the demo file and terminal, and run the broken Python example. Describe whether the clue is useful without giving away the answer and whether the robot panel feels like the intended buddy.
  Commit: `feat: show real coding hints from terminal runs`

- [x] **2. Escalate from clues to arrow hints and a fix the learner controls**
  Becomes usable: Three unsuccessful changed-code retries produce an inline arrow hint; three further retries produce a colored diff and explanation that the learner can accept or reject.
  Why now: Proves the distinctive progressive-help loop early, using the already working run-to-hint path.
  PRD ref: `prd.md > Attempts and Escalation`, `prd.md > Proposed Fix and Explanation`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Learning Session and Attempt Rules`, `spec.md > Inline Guidance and Fix Review`, `spec.md > Context and Teaching Response`, `spec.md > Data Model`
  Build: Add the local attempt controller, issue relationship checks, stage-specific response validation, inline decorations, native diff review, and accept/reject actions. Preserve undo, reject stale proposals, keep accepted edits unsaved for the learner to save/rerun, and prevent clarification or unchanged reruns from advancing stages.
  Verify (mechanical): Run compilation and Node tests covering initial clue versus retries 3/6, unchanged code, clarification, new/unknown issues, rejected/premature responses, and provider/context cancellation. Exercise real editor decorations and diff review in the Extension Development Host. Confirm rejection preserves source, acceptance matches the reviewed replacement, undo restores the original, and a source edit blocks acceptance of an outdated proposal. Exercise the complete escalation with genuine changed-code retries and the configured live provider.
  Learner check: Work through a broken example until the arrow appears, then continue to a proposed fix. Reject one proposal, review another, accept it, and try undo. Report anything that feels too eager, too vague, or confusing.
  Commit: `feat: add progressive hints and reviewed fixes`

- [ ] **3. Handle intended outcomes, external results, and solved-issue celebrations**
  Becomes usable: The buddy uses a top-of-file comment or clarification to judge results, accepts explicitly shared external run results, and celebrates a solved issue with configurable confetti.
  Why now: Closes the complete learning journey and checks logic mistakes that do not produce terminal errors before expanding provider coverage.
  PRD ref: `prd.md > Context and First Clue`, `prd.md > Solved State and Celebration`, `prd.md > Look and Feel`, `prd.md > Acceptance Criteria`
  Spec ref: `spec.md > Context and Teaching Response`, `spec.md > Learning Session and Attempt Rules`, `spec.md > Buddy Panel and Settings`, `spec.md > Look and Feel`, `spec.md > Important Failure Modes`
  Build: Add the Python logic-error example, expected-outcome/clarification flow, explicit Share Run Result action using the existing text area, evidence-aware solved handling, and one celebration per solved issue. Count learner-reported runs only when clearly submitted as such and code changed; ordinary messages remain clarification. Save the confetti preference, respect reduced motion, and retain textual success feedback with animation disabled.
  Verify (mechanical): Run tests for missing comments, unclear intention, a successful exit with wrong output, explicit external runs versus clarification, incomplete/truncated evidence, solved-count reset, and duplicate success events. In the Extension Development Host, use real Python logic examples, verify clarification when needed, and check confetti enabled/disabled plus reduced-motion behavior. Ensure accepting a fix alone does not trigger celebration.
  Learner check: Try code whose output disagrees with its top comment, then remove the comment and clarify through the text area. Share a result manually, solve the issue, and test celebration on/off. Describe what helped you understand the mistake.
  Commit: `feat: clarify outcomes and celebrate resolved issues`

- [ ] **4. Switch the same teaching workflow between Gemini, OpenAI, and Groq**
  Becomes usable: Settings expose all three working providers, each using its own stored key and model preference, while the learning rules remain consistent.
  Why now: Adds the required provider demonstration after the core teaching behavior is stable, reducing the number of moving parts during early debugging.
  PRD ref: `prd.md > Provider Settings and Open Source`, `prd.md > Attempts and Escalation`, `prd.md > Acceptance Criteria`
  Spec ref: `spec.md > Provider Connections`, `spec.md > Shared Contract`, `spec.md > OpenAI`, `spec.md > Groq`, `spec.md > Buddy Panel and Settings`, `spec.md > Data Model`
  Build: Add the direct OpenAI and Groq HTTP functions, provider/model selection, and per-provider set/remove-key actions. Preserve counts during a switch, invalidate obsolete responses/proposals, and never automatically fail over to another provider. Check documented model access and correct any internal API-contract errors using current official documentation; discuss consequential model/provider changes with the learner.
  Verify (mechanical): Run compilation and HTTP-fixture tests for each provider's authentication, payload, response shape, refusal/truncation handling, timeout, and quota/credential errors. With keys configured locally, exercise the real hint-to-inline-to-fix workflow for all three providers; a generic connection check is insufficient. Verify switching does not advance counts or send requests to an unselected provider, and settings never expose keys in source, logs, or panel messages.
  Learner check: Switch providers through settings and try the same small exercise with each. Check that keys remain concealed and that all three preserve the teaching approach. Report differences that matter for the demo.
  Commit: `feat: support Gemini OpenAI and Groq`

- [ ] **5. Install the package and verify the complete journey across languages**
  Becomes usable: A VSIX installs into ordinary desktop VS Code, and another person can follow the README to configure a provider and try the buddy.
  Why now: Verifies the deliverable people will actually install, after the complete learning loop and all required providers work.
  PRD ref: `prd.md > The Core Journey`, `prd.md > What We're Building`, `prd.md > Acceptance Criteria`, `prd.md > Non-Goals`
  Spec ref: `spec.md > Installable Package and Public Release`, `spec.md > Development and Local Demo`, `spec.md > Verification and Early Feasibility Checks`, `spec.md > File Structure`, `spec.md > Data Model`
  Build: Add the small JavaScript verification example, finish installation/provider/capture-limit documentation, define the package exclusions and package command, and create the installable VSIX. Check sidebar readability/accessibility and actual restart behavior. Prepare the information needed for later Marketplace publication without publishing during this slice or choosing an open-source license on the learner's behalf.
  Verify (mechanical): Run the established compilation/tests, package with vsce, inspect the exact package file list for private/course/development material, and install the resulting VSIX. Exercise the real Python core journey and JavaScript example in the installed extension. Confirm preferences and keys survive a restart while hints/counts reset. Record actual environment/provider coverage and fix any failures before marking this slice complete.
  Learner check: Install the VSIX, follow the README, and explore the full journey freely, including a confusing input, an unchanged rerun, an accepted/rejected fix, and a restart. Report anything broken or unclear before shipping preparation.
  Commit: `build: package and verify the coding buddy extension`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 1, the learner tries the real robot panel and first clue; feedback shapes the remaining experience.
- [ ] Integrated teaching journey explored — after slice 3, the learner checks escalation, fix control, outcome clarification, and celebration together.
- [ ] Final kick-the-tires exploration and feedback completed — after slice 5, using the installed package.

The learner explicitly waived these hands-on sessions. Keep their boxes unchecked to avoid implying they occurred; use agent verification and record remaining live checks in Final Review.

## Final Review

- [ ] Live provider acceptance — configure real keys locally and exercise the full teaching loop with Gemini, OpenAI, and Groq. HTTP fixtures are not live model validation.
- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — follow one real run through two or three code locations, connecting the plan, implementation, and verification to the learner's AI-workflow goal.
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: Not started.
Route and stops: Choose actual files and functions from the completed implementation; no invented code route.
Edit outcome: Not offered yet.
Reflection: Not offered yet; any personal answer belongs in the ignored learner profile.
Activity mode: Not established; default to the running extension and editor.

## Revisions

- The learner selected fast mode and explicitly waived explanations, hands-on checkpoints, and further approval pauses. Continue implementing and verifying all slices without those pauses.
- No Gemini, OpenAI, or Groq API key is configured in the task environment. Build the real integrations and verify their contracts with HTTP fixtures; keep live model acceptance checks pending rather than claiming they passed. This missing external setup does not prevent implementing the remaining slices.
- Slice 1 agent checks passed: TypeScript compilation; eight Node assertions/tests across two test files; actual VS Code 1.141 Extension Development Host activation/sidebar registration; real Bash shell integration captured the Python SyntaxError and exit code 1. Live Gemini guidance remains pending in Final Review because no key is configured.
- Slice 2 agent checks passed: seven session tests plus provider tests; real VS Code host verified arrows, native diff, no source mutation on review/reject, accepted edits, undo, and stale-edit rejection. Request fingerprints exclude the help level because resetting a new issue must not make an unchanged rerun billable. Live-model escalation remains pending.
- Slice 3 agent checks passed: nine session tests verify outcome evidence, no false celebration on errors/truncation/inferred intent, explicit manual-run attempts versus clarification, and one celebration per resolved issue. Real VS Code verifies the persistent confetti toggle and retains all capture/editor checks. Hands-on learner checks remain waived; live model judgments remain unverified.
