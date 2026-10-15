# Coding Buddy

A VS Code learning companion that gives clues before answers. The first build connects a saved code file to a terminal and offers a real first hint through Gemini. Progressive hints, reviewed fixes, and additional providers are being built in ordered steps.

## Run locally

1. Install Node.js and desktop VS Code 1.93 or newer.
2. Run `npm install` and `npm test`.
3. Open this project in VS Code and press **F5** to open an Extension Development Host.
4. In that new window, open the `examples` folder and click the Coding Buddy robot icon.
5. Use **Add key** to enter your Gemini API key locally. It is stored in VS Code secret storage.
6. Open and save `loop_syntax.py`. Click **Connect terminal**, select a terminal, and run `python3 loop_syntax.py` as the next command.

Automatic capture needs VS Code terminal shell integration. The buddy reads only the connected file and watched command output, then sends that context to your selected provider. Provider costs, quotas, and data-use policies apply. Never put API keys into your code or clarification messages.

The Python file is intentionally broken for learning. Do not use it as a passing application test.

## Project status

See [the build checklist](devpost/checklist.md) for implementation and verification status. No live model validation is claimed until real provider credentials have been configured and tested.

The open-source license will be selected before public release. No license grant has been chosen yet.
