# Bigger CodeNudge playgrounds

These projects contain deliberate mistakes. They run locally without installing dependencies or contacting a service. Each has more than one issue, so getting past an exception does not necessarily mean the result is correct.

Open this folder in your CodeNudge test window. Keep either module open, run the entry point in a terminal, and work through the clues. Save each attempt before running again. Switch between Python and JavaScript to check whether CodeNudge remembers each problem separately.

## Python: an invoice report

From this folder, run:

```sh
python3 python_invoices/main.py
```

The report should include only paid orders, count each customer once, and apply each order's percentage discount to its whole subtotal. The data and the report are in `main.py`; the reusable calculation is in `invoice.py`.

A correct report has three paid orders, two customers, and revenue of $61.00. Try explaining why those numbers are right before changing the code.

## JavaScript: an asynchronous account service

From this folder, run:

```sh
node javascript_accounts/main.js valid
node javascript_accounts/main.js missing
node javascript_accounts/main.js unavailable
```

This simulates an API client using an asynchronous local response object. No server, API key, or network is needed. `main.js` supplies the responses and prints the result; `service.js` interprets them.

- `valid` should show Ada with 15 credits.
- `missing` should show that account 99 was not found, without crashing.
- `unavailable` should report HTTP 503 and exit with an error status.

Investigate how successful, missing, and unavailable responses differ. The client should preserve those differences when handling an asynchronous body.

## Things to check in CodeNudge

1. Run a project while its helper module is open, then while its entry point is open. Clues should point to the relevant file.
2. Make an attempt in Python, switch to JavaScript, and return to Python. Its earlier context should still make sense.
3. Run the same unchanged project twice. It should not count as two attempts.
4. Change a helper while its program is running. An old result should not be presented as a verdict on the new code.
5. Compare the final output with the intended behavior above. A program can exit successfully and still produce the wrong result.
