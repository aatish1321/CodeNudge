import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import type * as vscode from 'vscode';
import type { TerminalCapture } from '../src/terminal';
import type { RunSnapshot } from '../src/teaching';

function terminalFixture() {
  let start!: (event: vscode.TerminalShellExecutionStartEvent) => void;
  let end!: (event: vscode.TerminalShellExecutionEndEvent) => void;
  const runs: RunSnapshot[] = []; const statuses: string[] = []; const clears: boolean[] = [];
  const terminal = {} as vscode.Terminal;
  const document = { fileName: '/demo.py', uri: { scheme: 'file', toString: () => 'file:///demo.py' }, version: 1,
    languageId: 'python', isDirty: false, isClosed: false, getText: () => 'print(1)\n' };
  const window = {
    activeTextEditor: { document },
    onDidStartTerminalShellExecution: (callback: typeof start) => { start = callback; return { dispose() {} }; },
    onDidEndTerminalShellExecution: (callback: typeof end) => { end = callback; return { dispose() {} }; },
    onDidCloseTerminal: () => ({ dispose() {} }),
    showInputBox: () => { throw new Error('Automatic capture must not ask for a command'); }
  };
  const moduleExports = {} as { TerminalCapture: typeof TerminalCapture };
  const filename = resolve(__dirname, '../src/terminal.js');
  const localRequire = createRequire(filename);
  runInNewContext(readFileSync(filename, 'utf8'), { exports: moduleExports,
    require: (name: string) => name === 'vscode' ? { TerminalShellExecutionCommandLineConfidence: { Low: 0 }, window } : localRequire(name)
  });
  const capture = new moduleExports.TerminalCapture(run => runs.push(run), (status, clear) => { statuses.push(status); clears.push(!!clear); });
  const run = async (command = 'python3 demo.py', output = '1\r\n', confidence = 2, duringRun?: () => void, cwd = '/') => {
    const execution = { cwd: { fsPath: cwd } as vscode.Uri, commandLine: { value: command, confidence, isTrusted: false },
      read: async function* () { yield output; } } as vscode.TerminalShellExecution;
    start({ terminal, execution, shellIntegration: {} as vscode.TerminalShellIntegration });
    duringRun?.();
    end({ terminal, execution, exitCode: 0, shellIntegration: {} as vscode.TerminalShellIntegration });
    await new Promise(resolve => setImmediate(resolve));
  };
  return { capture, document, terminal, runs, statuses, clears, run };
}

test('automatically observes the active saved file without attaching a terminal or prompting', async () => {
  const fixture = terminalFixture();
  await fixture.run();
  assert.equal(fixture.runs[0].command, 'python3 demo.py');
  assert.equal(fixture.runs[0].output, '1\n');
  assert.equal(fixture.runs[0].sourceConfirmed, true);
  fixture.capture.dispose();
});

test('another absolute or relative copy with the same basename cannot be diagnosed as the active file', async () => {
  const fixture = terminalFixture();
  await fixture.run('python3 /tmp/other/demo.py', 'File "/tmp/other/demo.py", line 2\nSyntaxError: invalid syntax');
  await fixture.run('', 'File "/tmp/other/demo.py", line 2\nSyntaxError: invalid syntax', 0);
  await fixture.run('python3 demo.py', '1', 2, undefined, '/other');
  assert.equal(fixture.runs.length, 0);
  assert.equal(fixture.clears.filter(Boolean).length, 3);
  assert.match(fixture.statuses.at(-1)!, /another copy/);
  fixture.capture.dispose();
});

test('quoted paths with spaces and file URLs match the complete active file path', async () => {
  const fixture = terminalFixture();
  fixture.document.fileName = '/my project/demo.py';
  await fixture.run('python3 "/my project/demo.py"');
  await fixture.run('', 'at file:///my%20project/demo.py:2:1', 0);
  assert.equal(fixture.runs.length, 2);
  assert.ok(fixture.runs.every(run => run.sourceConfirmed));
  fixture.capture.dispose();
});

test('zsh runs with empty command names use filename evidence without a command dialog', async () => {
  const fixture = terminalFixture();
  await fixture.run('', 'File "/demo.py", line 2\nSyntaxError: invalid syntax', 0);
  await fixture.run('', 'File "/demo.py", line 2\nSyntaxError: invalid syntax', 0);
  assert.equal(fixture.runs.length, 2);
  assert.equal(fixture.runs[0].sourceConfirmed, true);
  assert.equal(fixture.runs[0].command, 'Terminal run (command unavailable)');
  fixture.capture.dispose();
});

test('unidentified results retain uncertainty instead of claiming they came from the file', async () => {
  const fixture = terminalFixture();
  await fixture.run('', '1\n2\n3\n4', 0);
  assert.equal(fixture.runs[0].sourceConfirmed, false);
  fixture.capture.dispose();
});

test('ignores shell housekeeping and respects pause/resume', async () => {
  const fixture = terminalFixture();
  await fixture.run('git status');
  await fixture.run('ls');
  fixture.capture.disconnect();
  await fixture.run();
  assert.equal(fixture.runs.length, 0);
  fixture.capture.watch();
  await fixture.run();
  assert.equal(fixture.runs.length, 1);
  fixture.capture.dispose();
});

test('dirty, changed-during-run and non-code files are not analyzed', async () => {
  const fixture = terminalFixture();
  fixture.document.isDirty = true;
  await fixture.run();
  fixture.document.isDirty = false;
  await fixture.run('python3 demo.py', '1', 2, () => { fixture.document.version++; });
  fixture.document.languageId = 'markdown';
  await fixture.run();
  assert.equal(fixture.runs.length, 0);
  fixture.capture.dispose();
});

test('optional manual attachment still pins one command and disconnect invalidates pending output', async () => {
  const fixture = terminalFixture();
  fixture.capture.connect(fixture.document as unknown as vscode.TextDocument, fixture.terminal);
  await fixture.run();
  await fixture.run('python3 other.py');
  assert.equal(fixture.runs.length, 1);
  await fixture.run('python3 demo.py', '1', 2, () => fixture.capture.disconnect());
  assert.equal(fixture.runs.length, 1);
  fixture.capture.dispose();
});
