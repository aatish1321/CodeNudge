import * as vscode from 'vscode';
import { defaults, Provider } from './providers';

export function configuration(): { provider: Provider; model: string } {
  const config = vscode.workspace.getConfiguration('codingBuddy');
  const provider = config.get<Provider>('provider', 'gemini');
  if (!Object.hasOwn(defaults, provider)) throw new Error('Choose a supported Coding Buddy provider in settings.');
  const model = config.get<unknown>(`models.${provider}`, defaults[provider]);
  if (typeof model !== 'string' || !/^[a-zA-Z0-9._/-]{1,100}$/.test(model.trim())) throw new Error('Check the model name in Coding Buddy settings.');
  return { provider, model: model.trim() };
}

export function keyName(provider: Provider): string { return `codingBuddy.key.${provider}`; }

export async function chooseProvider(): Promise<void> {
  const choice = await vscode.window.showQuickPick((Object.keys(defaults) as Provider[]).map(provider => ({
    label: provider === 'openai' ? 'OpenAI' : provider === 'groq' ? 'Groq' : 'Google Gemini',
    description: defaults[provider], provider
  })), { title: 'Choose your buddy’s AI provider', placeHolder: 'Only the selected provider receives coding context.' });
  if (choice) await vscode.workspace.getConfiguration('codingBuddy').update('provider', choice.provider, vscode.ConfigurationTarget.Global);
}

export async function checkKnownKeys(context: vscode.ExtensionContext, text: string): Promise<void> {
  for (const provider of Object.keys(defaults) as Provider[]) {
    const key = await context.secrets.get(keyName(provider));
    if (key && text.includes(key)) throw new Error('A saved API key appears in this context. Remove it and use the Add key button for credentials.');
  }
}

export async function setKey(context: vscode.ExtensionContext): Promise<void> {
  const { provider } = configuration();
  const key = await vscode.window.showInputBox({ title: `API key for ${provider}`, prompt: 'Stored in VS Code secret storage. Your code and run output are sent to this provider when you use the buddy.',
    password: true, ignoreFocusOut: true, validateInput: value => value.trim().length < 10 ? 'Enter a valid provider API key.' : undefined });
  if (key !== undefined) await context.secrets.store(keyName(provider), key.trim());
}
