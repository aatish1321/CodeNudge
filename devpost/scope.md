---
doc: scope
status: approved
---

# Coding Buddy

A VS Code learning companion that helps beginners work through coding problems across programming languages, with progressively more useful hints before revealing a solution. Python is the demonstration language, not a product restriction.

## The Unique Kernel

Help the learner think before giving them code: start with a clue about the kind of problem, narrow the guidance after repeated attempts, and offer a solution with an explanation only as the final fallback.

## Who It's For

Someone starting to code, or someone who wants to build but feels held back by not knowing enough technical details. The first example is a beginner working on a small Python loop exercise in VS Code.

## The Core Loop

The learner runs their code and encounters an error or an unexpected result. The side-panel buddy gives a clue about the potential issue, such as syntax or logic. The learner edits and tries again. After repeated unsuccessful attempts, guidance points to the relevant line with an inline hint or comment. If they remain stuck, the buddy provides a solution and explains what went wrong. They apply what they learned and try again. This teaching workflow should apply across programming languages.

For logic issues, comments in the file can explain the intended behavior. Without clear intent, the buddy may tentatively infer it; if the issue persists, it asks the learner to explain the expected outcome. Guesses should be presented as possibilities rather than established errors.

## Inspiration & Identity

Inspired by the hint-first AI learning experience the learner describes in [Scrimba](https://scrimba.com/). The buddy should feel conversational and encouraging, with feedback such as “hmm… not quite” or “try this.” Its identity is a learning partner that encourages thinking.

## Why This Matters to the Learner

The learner wants to practice “using AI tools effectively and having a proper workflow and having a better result.” The product reflects their desire to learn through thinking rather than receiving complete code immediately.

## What "Working" Looks Like

In a short screen demo, a beginner opens a small Python file with a broken loop and runs it. The buddy identifies a likely problem category in the side panel without giving away the fix. Further unsuccessful attempts lead to a hint beside the relevant code. Continued difficulty leads to a solution with an explanation the learner can connect to their mistake.

Show a syntax-error example and a small logic-error example whose intended result is stated in a comment. The distinctive moment is the help becoming more specific as the learner struggles, while leaving room for them to solve the problem themselves.

The hackathon targets roughly 2–4 hours of active work and requires a short demo video and a public GitHub repository. Deployment is optional.

## The POC Boundary

- A VS Code extension with a side-panel conversation.
- Guidance across programming languages, without restricting the buddy to Python.
- Small Python examples, starting with loops, for the demo and initial verification.
- Clues about likely issue categories, followed by increasingly specific help.
- Line-specific inline guidance after repeated attempts.
- A final solution with an explanation when the learner remains stuck.
- Comments as context for expected behavior, with clarification when necessary.

Detailed run behavior, how run results reach the buddy across languages, what counts as an attempt, and the timing of each help stage belong in the PRD and technical plan. Python examples demonstrate and initially verify the learning loop; this does not establish tested behavior in every language.

## Later

- Project-building workflow: the learner describes an idea and the buddy breaks it into small tasks with deliberately light guidance. Consider only after the error-help loop works, if time remains; it is not required for this proof of concept.
- Harder Python and JavaScript multi-file examples are now included and verified as requested during testing; broader language/toolchain coverage still needs evidence.

## Explicitly Cut

- Project breakdown from the required first version: it adds a second teaching workflow and would dilute the small error-help demonstration. Retained above as a possible later extension.

## Workspace Revision

Requested during learner testing: keep hints, clarification, and attempt progress when moving between files/languages in the same window; investigate relevant code across the opened folder rather than pinning normal use to one file/terminal. Provide a self-service way to open fresh practice projects. Verify harder multi-file Python and JavaScript work, including runtime failures and wrong-but-successful output. Context is bounded and secret/generated files excluded; fixes remain reviewed one-file changes. The project-idea-to-tasks workflow stays deferred.
