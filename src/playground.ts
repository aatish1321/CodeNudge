import * as vscode from 'vscode';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function openPlayground(extensionUri: vscode.Uri): Promise<void> {
  const parent = await mkdtemp(join(tmpdir(), 'coding-buddy-playground-'));
  const folder = vscode.Uri.file(join(parent, 'Coding Buddy Playground'));
  await vscode.workspace.fs.copy(vscode.Uri.joinPath(extensionUri, 'examples'), folder, { overwrite: false });
  await vscode.commands.executeCommand('vscode.openFolder', folder, { forceNewWindow: true });
}
