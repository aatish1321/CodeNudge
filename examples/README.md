# Your Coding Buddy playground

Open the robot icon, use its gear to choose an AI provider and add its key, then open a project file and run it in VS Code's terminal. Buddy follows runs across this folder. Save edits before rerunning.

For a simple presentation, open [demo/README.md](demo/README.md). Start with four-line `demo/expenses.py` (`python3 demo/expenses.py`), then four-line `demo/countdown.js` (`node demo/countdown.js`). The walkthrough lists exactly how to show clues, retry 3’s arrow, retry 6’s reviewed fix, rejection/acceptance, success, and file switching.

For more advanced testing, use these projects:

- `projects/python_invoices`: an invoice report with a helper module, nested data, and discounts. Run `python3 projects/python_invoices/main.py`.
- `projects/javascript_accounts`: an asynchronous API client with valid, missing-account, and unavailable-service scenarios. Run `node projects/javascript_accounts/main.js valid`, then try `missing` and `unavailable`.

See `projects/README.md` for expected behavior and a test sequence without solutions.

Switch between Python and JavaScript and back: each file keeps its own hints, clarification, and attempt count during this window session. The buddy reads the folder structure and relevant code, including imported helpers. Three changed, failed retries on the same issue unlock an inline hint; three more unlock a reviewed fix. Repeating identical code/results does not spend another AI request.

To open fresh practice files again, press **Ctrl+Shift+P** and run **Coding Buddy: Open Playground**. Each playground is a separate temporary folder; copy your work into your own project if you want to keep it long-term.

If you are developing the extension, open its repository and press **F5** to launch the development window. Close that development window and press F5 again after changing the extension source.
