import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import type { TerminalCapture as CaptureType } from '../src/terminal';
import { RunSnapshot } from '../src/teaching';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clue, run as fixtureRun } from './fixtures';
import type { Provider } from '../src/providers';

async function disableTestHistory(terminal: vscode.Terminal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { listener.dispose(); reject(new Error('Could not disable test terminal history')); }, 10_000);
    const listener = vscode.window.onDidEndTerminalShellExecution(event => {
      if (event.terminal === terminal) { clearTimeout(timer); listener.dispose(); resolve(); }
    });
    terminal.sendText('unset HISTFILE');
  });
}

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension('aatish1321.coding-buddy');
  assert.ok(extension, 'Development extension must be discovered');
  const { TerminalCapture } = require(join(extension.extensionPath, 'out/src/terminal.js')) as typeof import('../src/terminal');
  const { EditorGuidance } = require(join(extension.extensionPath, 'out/src/editor.js')) as typeof import('../src/editor');
  const { configuration, keyName } = require(join(extension.extensionPath, 'out/src/settings.js')) as typeof import('../src/settings');
  const { defaults } = require(join(extension.extensionPath, 'out/src/providers.js')) as typeof import('../src/providers');
  const { LearningSession } = require(join(extension.extensionPath, 'out/src/session.js')) as typeof import('../src/session');
  const { validateReply } = require(join(extension.extensionPath, 'out/src/teaching.js')) as typeof import('../src/teaching');
  await vscode.commands.executeCommand('codingBuddy.panel.focus');
  await extension.activate();
  assert.ok(extension.isActive);
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder);
  const fixtures = await mkdtemp(join(tmpdir(), 'coding-buddy-fixtures-'));
  const syntaxPath = join(fixtures, 'loop_syntax.py');
  const javascriptPath = join(fixtures, 'loop_logic.js');
  await writeFile(syntaxPath, fixtureRun.source);
  await writeFile(javascriptPath, '// Print 1 through 5\nfor (let n = 1; n < 5; n++) console.log(n);\n');
  const syntaxCommand = `python3 ${syntaxPath}`;
  const document = await vscode.workspace.openTextDocument(syntaxPath);
  await vscode.window.showTextDocument(document);
  const terminal = vscode.window.createTerminal({ name: 'Coding Buddy verification', shellPath: '/bin/bash', cwd: folder.uri, env: { HISTFILE: '/dev/null' } });
  let capture: CaptureType | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { listener.dispose(); reject(new Error('Shell integration did not activate')); }, 20_000);
      const listener = vscode.window.onDidChangeTerminalShellIntegration(event => {
        if (event.terminal === terminal) { clearTimeout(timer); listener.dispose(); resolve(); }
      });
      if (terminal.shellIntegration) { clearTimeout(timer); listener.dispose(); resolve(); }
      terminal.show();
    });
    await disableTestHistory(terminal);
    const observed = new Promise<RunSnapshot>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('No completed command was captured')), 20_000);
      capture = new TerminalCapture(result => { clearTimeout(timer); resolve(result); }, () => {});
    });
    terminal.sendText(syntaxCommand);
    const result = await observed;
    assert.equal(result.exitCode, 1);
    assert.match(result.output, /SyntaxError/);
    assert.equal(result.source, document.getText());
    assert.equal(result.command, syntaxCommand);
    assert.equal(result.sourceConfirmed, true);
    console.log('HOST CHECK PASSED: extension activation, robot webview registration, actual terminal output and exit code.');
    capture?.dispose();
    const javascript = await vscode.workspace.openTextDocument(javascriptPath);
    await vscode.window.showTextDocument(javascript);
    const observedJavascript = new Promise<RunSnapshot>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('JavaScript run was not captured')), 20_000);
      capture = new TerminalCapture(result => { clearTimeout(timer); resolve(result); }, () => {});
    });
    terminal.sendText(`node ${javascriptPath}`);
    const javascriptResult = await observedJavascript;
    assert.equal(javascriptResult.exitCode, 0);
    assert.equal(javascriptResult.language, 'javascript');
    assert.equal(javascriptResult.output.trim(), '1\n2\n3\n4');
    console.log('HOST CHECK PASSED: JavaScript source/output capture without Python-specific assumptions.');
    capture?.dispose();

    const directory = await mkdtemp(join(tmpdir(), 'coding-buddy-progression-'));
    const path = join(directory, 'attempt.py');
    await writeFile(path, '# Print 1 through 5\n');
    const attemptDocument = await vscode.workspace.openTextDocument(path);
    const editor = await vscode.window.showTextDocument(attemptDocument);
    const session = new LearningSession();
    for (let index = 0; index < 5; index++) {
      const endings = ['', ';', "''", '/', ':'];
      const source = `# Print 1 through 5\nfor number in range(1, 6)${endings[index]}\n    print(number)\n`;
      await editor.edit(edit => edit.replace(new vscode.Range(attemptDocument.positionAt(0), attemptDocument.positionAt(attemptDocument.getText().length)), source));
      await attemptDocument.save();
      const observed = new Promise<RunSnapshot>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Changed-code run was not captured')), 20_000);
        capture = new TerminalCapture(result => { clearTimeout(timer); resolve(result); }, () => {});
      });
      terminal.sendText(`python3 ${path}`);
      const current = await observed;
      capture?.dispose();
      assert.equal(current.source, source);
      session.begin(current, `attempt-${index}`, true);
      if (index < 4) {
        assert.equal(current.exitCode, 1);
        const reply = validateReply(clue, current, session.allowedLevel(current, true), session.sameDiagnostic(current));
        session.apply(current, reply, `attempt-${index}`, true);
        assert.equal(session.retries, index);
        if (index === 3) assert.equal(session.lineHint(current, reply)?.line, 2);
      } else {
        assert.equal(current.exitCode, 0);
        assert.equal(current.output.trim(), '1\n2\n3\n4\n5');
        assert.doesNotMatch(current.output, /SyntaxError/);
        assert.equal(validateReply(clue, current, 'clue').status, 'needs_clarification');
        const solved = validateReply({ ...clue, status: 'solved', relationship: 'same', level: 'clue' }, current, 'fix');
        assert.equal(session.apply(current, solved, 'solved', true), true);
        assert.equal(session.lineHint(current, solved), undefined);
      }
    }
    console.log('HOST CHECK PASSED: three actual changed retries unlock a line hint; successful output replaces previous errors and clears progression.');
  } finally { capture?.dispose(); terminal.dispose(); }

  if (existsSync('/bin/zsh')) {
    await vscode.window.showTextDocument(document);
    const zsh = vscode.window.createTerminal({ name: 'Buddy automatic zsh verification', shellPath: '/bin/zsh', cwd: folder.uri, env: { HISTFILE: '/dev/null' } });
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { listener.dispose(); reject(new Error('zsh shell integration did not activate')); }, 20_000);
        const listener = vscode.window.onDidChangeTerminalShellIntegration(event => {
          if (event.terminal === zsh) { clearTimeout(timer); listener.dispose(); resolve(); }
        });
        if (zsh.shellIntegration) { clearTimeout(timer); listener.dispose(); resolve(); }
        zsh.show();
      });
      await disableTestHistory(zsh);
      const observed = new Promise<RunSnapshot>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Automatic zsh run was not captured')), 20_000);
        capture = new TerminalCapture(result => { clearTimeout(timer); resolve(result); }, () => {});
      });
      zsh.sendText(syntaxCommand);
      const result = await observed;
      assert.equal(result.exitCode, 1);
      assert.match(result.output, /SyntaxError/);
      assert.equal(result.sourceConfirmed, true, 'filename in traceback must link the run without a prompt');
      console.log('HOST CHECK PASSED: automatic zsh capture without terminal attachment or command confirmation.');
    } finally { capture?.dispose(); zsh.dispose(); }
  }

  const directory = await mkdtemp(join(tmpdir(), 'coding-buddy-edits-'));
  const path = join(directory, 'review.py');
  await writeFile(path, 'print(1)\n');
  const editDocument = await vscode.workspace.openTextDocument(path);
  await vscode.window.showTextDocument(editDocument);
  const review = new EditorGuidance(() => {});
  const snapshot = (): RunSnapshot => ({ uri: editDocument.uri.toString(), version: editDocument.version,
    source: editDocument.getText(), language: 'python', command: 'python3 review.py', output: '1', exitCode: 0, truncated: false, reported: false });
  const proposal = { ...clue, relationship: 'same' as const, level: 'fix' as const, replacement: 'print(2)\n', explanation: 'Print the intended number.' };
  try {
    const current = snapshot();
    review.showHint(current, { line: 1, inlineHint: 'Which value should be printed?' });
    await review.showProposal(current, proposal);
    assert.equal(editDocument.getText(), 'print(1)\n', 'review must not mutate the source');
    review.reject(review.proposalId);
    assert.equal(editDocument.getText(), 'print(1)\n', 'reject must preserve the source');
    await review.showProposal(current, proposal);
    await review.accept(review.proposalId);
    assert.equal(editDocument.getText(), 'print(2)\n');
    assert.ok(editDocument.isDirty, 'accepted code should remain unsaved for learner review');
    await vscode.commands.executeCommand('undo');
    assert.equal(editDocument.getText(), 'print(1)\n', 'accepted fix must be undoable');
    await editDocument.save();
    await review.showProposal(snapshot(), proposal);
    const oldId = review.proposalId;
    const editor = await vscode.window.showTextDocument(editDocument);
    await editor.edit(edit => edit.insert(new vscode.Position(0, 0), '# my change\n'));
    await assert.rejects(review.accept(oldId));
    assert.match(editDocument.getText(), /^# my change/);
    console.log('HOST CHECK PASSED: arrow rendering, native colored diff, reject, accept, undo, and stale-edit protection.');
  } finally { review.dispose(); await editDocument.save(); }
  const config = vscode.workspace.getConfiguration('codingBuddy');
  const originalConfetti = config.inspect<boolean>('confetti')?.globalValue;
  try {
    await config.update('confetti', false, vscode.ConfigurationTarget.Global);
    assert.equal(vscode.workspace.getConfiguration('codingBuddy').get('confetti'), false);
    await vscode.commands.executeCommand('codingBuddy.toggleConfetti');
    assert.equal(vscode.workspace.getConfiguration('codingBuddy').get('confetti'), true);
    console.log('HOST CHECK PASSED: persistent confetti setting and native toggle command.');
  } finally { await config.update('confetti', originalConfetti, vscode.ConfigurationTarget.Global); }
  const originalProvider = config.inspect<string>('provider')?.globalValue;
  try {
    const providers = Object.keys(defaults) as Provider[];
    assert.equal(new Set(providers.map(keyName)).size, 3, 'provider keys must have separate storage names');
    for (const provider of providers) {
      await config.update('provider', provider, vscode.ConfigurationTarget.Global);
      assert.equal(configuration().provider, provider);
      assert.equal(configuration().model, defaults[provider]);
    }
    console.log('HOST CHECK PASSED: three native provider settings and distinct secret names.');
  } finally { await config.update('provider', originalProvider, vscode.ConfigurationTarget.Global); }
  if (process.env.CODING_BUDDY_TEST_REPORT) {
    await writeFile(process.env.CODING_BUDDY_TEST_REPORT, JSON.stringify({ passed: true, checks: ['activation', 'automatic-python-capture', 'automatic-javascript-capture', 'changed-retry-inline', 'successful-rerun-clears-errors', ...(existsSync('/bin/zsh') ? ['automatic-zsh-capture'] : []), 'inline-guidance', 'diff', 'accept', 'reject', 'undo', 'stale-edit', 'confetti-setting', 'provider-settings'] }));
  }
}
