import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import type * as vscode from 'vscode';
import type { TerminalCapture } from '../src/terminal';
import type { RunSnapshot } from '../src/teaching';

function terminalFixture(confirm: () => Promise<string | undefined>) {
  let start!: (event: vscode.TerminalShellExecutionStartEvent) => void;
  let end!: (event: vscode.TerminalShellExecutionEndEvent) => void;
  let confirmations = 0;
  const runs: RunSnapshot[] = []; const statuses: string[] = [];
  const terminal = {} as vscode.Terminal;
  const document = { fileName: '/demo.py', uri: { toString: () => 'file:///demo.py' }, version: 1,
    languageId: 'python', isDirty: false, isClosed: false, getText: () => 'print(1)\n' };
  const moduleExports = {} as { TerminalCapture: typeof TerminalCapture };
  const filename = resolve(__dirname, '../src/terminal.js');
  const localRequire = createRequire(filename);
  runInNewContext(readFileSync(filename, 'utf8'), { exports: moduleExports,
    require: (name: string) => name === 'vscode' ? {
      TerminalShellExecutionCommandLineConfidence: { Low: 0 },
      window: {
        onDidStartTerminalShellExecution: (callback: typeof start) => { start = callback; return { dispose() {} }; },
        onDidEndTerminalShellExecution: (callback: typeof end) => { end = callback; return { dispose() {} }; },
        onDidCloseTerminal: () => ({ dispose() {} }),
        showInputBox: () => { confirmations++; return confirm(); }
      }
    } : localRequire(name)
  });
  const capture = new moduleExports.TerminalCapture(run => runs.push(run), status => statuses.push(status));
  capture.connect(document as unknown as vscode.TextDocument, terminal);
  const run = async (command = 'python3 demo.py', confidence = 0) => {
    const execution = { cwd: undefined, commandLine: { value: command, confidence, isTrusted: false },
      read: async function* () { yield '1\r\n'; } } as vscode.TerminalShellExecution;
    start({ terminal, execution, shellIntegration: {} as vscode.TerminalShellIntegration });
    end({ terminal, execution, exitCode: 0, shellIntegration: {} as vscode.TerminalShellIntegration });
    await new Promise(resolve => setImmediate(resolve));
  };
  return { capture, document, terminal, runs, statuses, run, confirmations: () => confirmations };
}

test('uncertain commands need one confirmation; matching retries work and other commands are ignored', async () => {
  const fixture = terminalFixture(async () => 'python3 demo.py');
  await fixture.run();
  assert.equal(fixture.confirmations(), 1);
  assert.equal(fixture.runs[0].command, 'python3 demo.py');
  assert.equal(fixture.runs[0].output, '1\n');
  await fixture.run();
  await fixture.run('echo unrelated');
  assert.equal(fixture.confirmations(), 1);
  assert.equal(fixture.runs.length, 2);
  fixture.capture.disconnect();
  fixture.capture.connect(fixture.document as unknown as vscode.TextDocument, fixture.terminal);
  await fixture.run();
  assert.equal(fixture.confirmations(), 2, 'reconnecting requires a fresh confirmation');
  fixture.capture.dispose();
});

test('dismissing confirmation never shares a result', async () => {
  const fixture = terminalFixture(async () => undefined);
  await fixture.run();
  await fixture.run('');
  assert.equal(fixture.runs.length, 0);
  assert.equal(fixture.confirmations(), 2);
  assert.match(fixture.statuses.at(-1)!, /Share run result/);
  fixture.capture.dispose();
});

test('confirmed code changed or disconnected during the dialog is not analyzed', async () => {
  for (const invalidate of ['edit', 'disconnect']) {
    let confirm!: (choice: string) => void;
    const fixture = terminalFixture(() => new Promise(resolve => { confirm = resolve; }));
    await fixture.run();
    if (invalidate === 'edit') fixture.document.version++;
    else fixture.capture.disconnect();
    confirm('python3 demo.py');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(fixture.runs.length, 0);
    fixture.capture.dispose();
  }
});

test('empty command names need confirmation for each run, including retries, without guessing unrelated commands', async () => {
  let command = 'python3 demo.py';
  const fixture = terminalFixture(async () => command);
  await fixture.run('');
  await fixture.run('');
  assert.equal(fixture.runs.length, 2);
  assert.equal(fixture.runs[1].command, command);
  assert.equal(fixture.confirmations(), 2);
  command = 'echo unrelated';
  await fixture.run('');
  assert.equal(fixture.runs.length, 2);
  fixture.capture.dispose();
});

test('reliably identified commands do not prompt', async () => {
  const fixture = terminalFixture(async () => { throw new Error('Unexpected confirmation'); });
  await fixture.run('python3 demo.py', 2);
  assert.equal(fixture.runs.length, 1);
  assert.equal(fixture.confirmations(), 0);
  fixture.capture.dispose();
});
