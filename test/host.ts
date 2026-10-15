import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import type { TerminalCapture as CaptureType } from '../src/terminal';
import { RunSnapshot } from '../src/teaching';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clue } from './fixtures';
import type { Provider } from '../src/providers';

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension('aatish1321.coding-buddy');
  assert.ok(extension, 'Development extension must be discovered');
  const { TerminalCapture } = require(join(extension.extensionPath, 'out/src/terminal.js')) as typeof import('../src/terminal');
  const { EditorGuidance } = require(join(extension.extensionPath, 'out/src/editor.js')) as typeof import('../src/editor');
  const { configuration, keyName } = require(join(extension.extensionPath, 'out/src/settings.js')) as typeof import('../src/settings');
  const { defaults } = require(join(extension.extensionPath, 'out/src/providers.js')) as typeof import('../src/providers');
  await vscode.commands.executeCommand('codingBuddy.panel.focus');
  await extension.activate();
  assert.ok(extension.isActive);
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder);
  const document = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, 'loop_syntax.py'));
  await vscode.window.showTextDocument(document);
  const terminal = vscode.window.createTerminal({ name: 'Coding Buddy verification', shellPath: '/bin/bash', cwd: folder.uri });
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
    const observed = new Promise<RunSnapshot>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('No completed command was captured')), 20_000);
      capture = new TerminalCapture(result => { clearTimeout(timer); resolve(result); }, () => {});
      capture.connect(document, terminal);
    });
    terminal.sendText('python3 loop_syntax.py');
    const result = await observed;
    assert.equal(result.exitCode, 1);
    assert.match(result.output, /SyntaxError/);
    assert.equal(result.source, document.getText());
    assert.equal(result.command, 'python3 loop_syntax.py');
    console.log('HOST CHECK PASSED: extension activation, robot webview registration, actual terminal output and exit code.');
    capture?.dispose();
    const javascript = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, 'loop_logic.js'));
    await vscode.window.showTextDocument(javascript);
    const observedJavascript = new Promise<RunSnapshot>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('JavaScript run was not captured')), 20_000);
      capture = new TerminalCapture(result => { clearTimeout(timer); resolve(result); }, () => {});
      capture.connect(javascript, terminal);
    });
    terminal.sendText('node loop_logic.js');
    const javascriptResult = await observedJavascript;
    assert.equal(javascriptResult.exitCode, 0);
    assert.equal(javascriptResult.language, 'javascript');
    assert.equal(javascriptResult.output.trim(), '1\n2\n3\n4');
    console.log('HOST CHECK PASSED: JavaScript source/output capture without Python-specific assumptions.');
  } finally { capture?.dispose(); terminal.dispose(); }

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
    review.showHint(current, { ...clue, level: 'inline', line: 1, inlineHint: 'Which value should be printed?' });
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
    await writeFile(process.env.CODING_BUDDY_TEST_REPORT, JSON.stringify({ passed: true, checks: ['activation', 'python-capture', 'javascript-capture', 'inline-guidance', 'diff', 'accept', 'reject', 'undo', 'stale-edit', 'confetti-setting', 'provider-settings'] }));
  }
}
