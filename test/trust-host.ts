import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

export async function run(): Promise<void> {
  assert.equal(vscode.workspace.isTrusted, false, 'This check must actually run in Restricted Mode');
  const extension = vscode.extensions.getExtension('aatishdev.coding-buddy');
  assert.ok(extension);
  assert.equal(extension.packageJSON.capabilities.untrustedWorkspaces.supported, 'limited');
  await extension.activate();
  assert.ok(extension.isActive, 'CodeNudge must activate before folder trust');
  await vscode.commands.executeCommand('codingBuddy.panel.focus');
  await vscode.commands.executeCommand('workbench.trust.manage');
  assert.equal(vscode.workspace.isTrusted, false, 'Opening trust management must not grant trust');
  const checks = ['real-restricted-mode', 'extension-activation-before-trust', 'buddy-view-focus', 'trust-management-without-auto-trust'];
  console.log(`HOST CHECK PASSED: ${checks.join(', ')}`);
  if (process.env.CODING_BUDDY_TEST_REPORT) await writeFile(process.env.CODING_BUDDY_TEST_REPORT,
    JSON.stringify({ passed: true, checks }));
}
