# Fresh beginner practice

These three exercises deliberately contain mistakes. Try them in order, without asking for the full solution. Their top comments describe the intended behavior.

## Open and run

With **CodeNudge 0.0.17 or later**, run **CodeNudge: Open Playground** and expand `practice`. After updating the extension, run **Developer: Reload Window** first and open a new playground; existing copies retain your edits and do not gain new files automatically. You can also open this `practice` folder directly from the repository.

Trust the folder when you are ready, open the robot sidebar, choose Debug and configure your provider. Open an exercise and use **CodeNudge: Run with CodeNudge** from the Command Palette. It saves the active file before running. Python 3 and Node.js are needed for their respective examples.

Opening the repository's practice folder directly also works with an existing installed extension; it does not require a rebuild.

## Three exercises

| File | Intended result | What you are testing |
| --- | --- | --- |
| [count_up.py](count_up.py) | `1`, `2`, `3`, on separate lines. | An understandable first clue about a syntax error. |
| [last_fruit.py](last_fruit.py) | `mango` | Help with a runtime error in valid Python. |
| [delivery.js](delivery.js) | `0` | Detecting a logic mistake even though the program runs successfully. |

For each exercise:

1. Run the original, read the clue and decide whether it gives you something useful to investigate without immediately giving the answer.
2. Run it once unchanged. Its help stage should stay the same; identical source/result/context should reuse the analysis.
3. Try your own change and run again. Keep doing that until the output matches the comment. It is fine to solve it quickly; you do not need to deliberately get stuck.
4. Check that the old error advice is replaced with solved feedback when the intended result is established. Celebration is optional in settings.
5. Before solving the next exercise, switch to another file and back. Your current window should retain each file's Debug conversation and progress.

Inline hints require three changed unsuccessful retries on the same issue; a reviewed fix requires three more. Unchanged reruns and clarification replies do not advance the count. For a separate controlled escalation check, use the [existing rehearsal sequence](../demo/README.md#1-clue--inline-pointer--reviewed-fix).

When you repair the delivery example, also try order totals **29**, **30** and **31**. Expected delivery fees are **5**, **0** and **0**. This checks the rule beyond a single input. Save before every run. Restore the intended order total or update the top comment when changing the test case so the stated goal matches it.

## Tiny Project-mode project: a three-question quiz

Create and open a separate folder named `my-first-quiz`. Keeping it separate prevents unrelated exercise files from confusing a review of your new work. Open CodeNudge, select Project and describe the idea:

> I want to build a tiny Python quiz in the terminal. Ask three fixed questions, accept my answers and print my score out of three. I am a beginner. Keep it in one file, with no packages, website or database.

Choose **Suggest a plan**. If the plan adds too much, ask it to simplify before starting. Then build one task at a time in `quiz.py` yourself.

Try these small milestones:

1. Ask one question and read the answer.
2. Decide whether that answer is correct and show feedback.
3. Add two more questions and print the total score.

If stuck, try **Nudge me** and judge whether it helps you think. After saving an attempt, use **Check my attempt**. Run the code and check its behavior yourself before **Mark done**; the AI's review is advice, not proof that it works.

Test three runs: all correct answers should score **3/3**, all wrong answers **0/3**, and a mixture should produce the matching score. For example, two correct and one wrong should score **2/3**. After the basic version works, optionally accept uppercase/lowercase and extra spaces.

Reload the same folder and return to Project to check that the plan/progress persists. If you try **Cancel project**, its confirmation should explain that it clears the plan/progress while keeping your source files. Only confirm when you intend to reset the plan.

## What to report

For a confusing result, note **file, provider/model, what you expected, what happened and the clue you received**. Particularly useful observations are a clue that gives away the answer too soon, an unhelpfully vague clue, advice about the wrong file, or old error advice remaining after the correct output.

These are practice tasks, not evidence that a provider or the full workflow has passed live testing.
