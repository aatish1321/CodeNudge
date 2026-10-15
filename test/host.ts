import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { TerminalCapture } from '../src/terminal';
import { RunSnapshot } from '../src/teaching';

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension('aatish1321.coding-buddy');
  assert.ok(extension, 'Development extension must be discovered');
  await vscode.commands.executeCommand('codingBuddy.panel.focus');
  await extension.activate();
  assert.ok(extension.isActive);
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder);
  const document = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, 'loop_syntax.py'));
  await vscode.window.showTextDocument(document);
  const terminal = vscode.window.createTerminal({ name: 'Coding Buddy verification', shellPath: '/bin/bash', cwd: folder.uri });
  let capture: TerminalCapture | undefined;
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
  } finally { capture?.dispose(); terminal.dispose(); }
}
