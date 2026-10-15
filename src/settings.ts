import * as vscode from 'vscode';
import { defaults, Provider } from './providers';

export function configuration(): { provider: Provider; model: string } {
  const config = vscode.workspace.getConfiguration('codingBuddy');
  const provider = config.get<Provider>('provider', 'gemini');
  if (!(provider in defaults)) throw new Error('Choose a supported Coding Buddy provider in settings.');
  return { provider, model: config.get<string>(`models.${provider}`, defaults[provider]).trim() };
}

export function keyName(provider: Provider): string { return `codingBuddy.key.${provider}`; }

export async function setKey(context: vscode.ExtensionContext): Promise<void> {
  const { provider } = configuration();
  const key = await vscode.window.showInputBox({ title: `API key for ${provider}`, prompt: 'Stored in VS Code secret storage. Your code and run output are sent to this provider when you use the buddy.',
    password: true, ignoreFocusOut: true, validateInput: value => value.trim().length < 10 ? 'Enter a valid provider API key.' : undefined });
  if (key !== undefined) await context.secrets.store(keyName(provider), key.trim());
}
