# A simple Coding Buddy demo

Use these tiny examples for the presentation. The invoice/API projects are optional advanced examples. These files deliberately contain bugs.

## Prepare before recording

1. Install the latest local VSIX, run **Developer: Reload Window** once, then use **Ctrl+Shift+P → Coding Buddy: Open Playground**. This opens fresh copies. If it opens in **Restricted Mode**, click Buddy’s **Trust this folder…** button (or the top banner’s **Manage**), then grant trust for this playground. The robot is visible before trust, but hints wait for that choice. Your old playground does not update automatically.
2. Click the robot icon. In its gear menu, select your already-tested provider (Groq), check that its key is configured, enable automatic hints and celebrations.
3. Use the editor’s **Run with Buddy** play-circle button, or **Ctrl+Shift+P → Coding Buddy: Run with Buddy**. It saves/runs the active Python or plain JavaScript file in a dedicated terminal and knows the exact file without a yes/no reply. Manual commands below remain an alternative when your shell identifies them; keep that terminal at the playground root.
4. Open `demo/expenses.py`. Save before every run. Keep the code, terminal output and buddy visible together. Rehearse once, then open a fresh playground for the recording.
5. Do not show the provider-key input or personal files while recording. The character, hints, arrow and diff are the useful things to show.

## 1. Clue → inline pointer → reviewed fix

The Python example has just four lines. Its comment states the goal: total cost **18**.

Click **Run with Buddy** with `expenses.py` open. The equivalent manual command from the playground root is:

```sh
python3 demo/expenses.py
```

The initial run raises `TypeError`. Wait for Buddy's clue. This starts at **zero retries**: the first failure is the starting point, not attempt one.

Click Run with Buddy again without changing anything. The existing hint/count should stay; an identical result should not start another provider request.

To demonstrate escalation reproducibly, replace **only line 3** with each expression below, one at a time. **Click Run with Buddy and wait after each change.** The button saves the file before running. These are deliberately unsuccessful rehearsal attempts; explain that in the demo rather than presenting them as a normal way to learn.

| Changed retry | Put this on line 3 | What to show |
| --- | --- | --- |
| 1 | `total = sum(prices, start=0)` | A clue; no full replacement. |
| 2 | `total = sum(prices[:])` | The problem persists. |
| 3 | `total = sum(list(prices))` | An arrow beside the relevant line. |
| 4 | `total = sum(tuple(prices))` | Inline help continues. |
| 5 | `total = sum(prices, 0)` | Still no automatic edit. |
| 6 | `total = sum(prices.copy())` | A colored fix proposal and explanation. |

All six variants still fail with the same kind of error at line 3. The exact clue text, highlighted line and proposed repair can vary by model. If Buddy needs intent clarification, reply: **“The total should be 18.”** Clarification does not add an attempt.

At retry 6, show that your source is unchanged while the diff is open. Click **Keep my code** to reject it. Use **gear → Retry last result** for a fresh proposal, then review and **Accept fix**. Acceptance leaves the edit unsaved. Click Run with Buddy again: the result should be **18**, followed by solved feedback and optional confetti. Accepting alone should not celebrate.

For a short video, cut waiting time or jump between the rehearsed attempts; label the cuts. Keep the three-plus-three behavior honest rather than lowering the real threshold. Open a fresh playground to reset the entire rehearsal.

## 2. JavaScript logic error, plus file switching

Open `demo/countdown.js` and click **Run with Buddy**. Equivalent manual command:

```sh
node demo/countdown.js
```

It runs successfully but prints **3, 2, 1, 0**. Its comment says **3, 2, 1**. Show that Buddy can discuss a logic problem even with no crash.

Switch back to `expenses.py` and then back to `countdown.js`: each file's conversation and attempt progress should return. Switching tabs does not itself spend a request. To demonstrate a nonzero saved count, do this switch after Python retry 2, without fixing the JavaScript yet, then continue Python retry 3.

Now solve the JavaScript example yourself: change `count >= 0` to `count > 0`, save, and rerun. The output should be **3, 2, 1**. You do not need six attempts if you figure out the problem sooner.

## 3. Optional: show a helper file in the same folder

Open `demo/greeting.py`, which is only three lines, and click **Run with Buddy**. Equivalent manual command:

```sh
python3 demo/greeting.py
```

It calls `words.py`, where a `NameError` occurs. Show that Buddy receives the helper's code, not just the open entry file. Ask for clarification if needed: **“I expected Hello, Ada!”** Fix the mismatched name in `words.py`, save and rerun. Expected output: **Hello, Ada!**

Do not promise an inline arrow on the very first run: arrows follow the attempt rule. The failing helper is visible in the traceback immediately.

## A compact presentation order

1. Explain the idea in your own words: beginners try first; the buddy offers progressively more help.
2. Show Python's first clue and an unchanged rerun.
3. Show retry 3's arrow, then retry 6's reviewed diff and explanation.
4. Reject, request a fresh proposal, accept, save, run, and show success.
5. Show JavaScript's wrong-but-successful result and retained conversations across file switches.
6. If useful, finish with the three-line greeting/helper example and the gear menu's provider and celebration choices. Switching provider alone proves selection, not that an untested provider works.

## If the demo pauses unexpectedly

- **“I couldn’t identify that run”** is a quiet status for an ambiguous manual command. Use **Run with Buddy** for these examples; there is no yes/no confirmation. If you still see the old question, update to 0.0.9 and reload the window.
- **No new hint after an unchanged run:** expected. Make a real edit or use **gear → Retry last result** intentionally.
- **Quota/connection failure:** wait for quota recovery or fix the provider settings, then use Retry. Do not keep rerunning unchanged code hoping it will bypass caching.
- **Arrow/fix does not appear:** check that all edits were saved and actually run, the same issue remains, and the count reached 3/6. Reset/New Issue clears that count. Provider responses still need to validate.
- **Fresh demo files missing:** open a new playground after installing the newer package. Existing copies keep your edits.

Real model wording and quota behavior can vary. Rehearse with the same provider/model you will record. This guide's program outputs and six unsuccessful variants are checked mechanically; the exact new examples are not a guarantee of every live model reply.
