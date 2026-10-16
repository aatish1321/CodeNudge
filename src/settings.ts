import * as vscode from 'vscode';
import { Connection, defaultEndpoints, defaults, modelPattern, Provider, providerLabels, requiresKey, validateEndpoint } from './providers';

export function configuration(): Connection & { provider: Provider; model: string; requiresKey: boolean } {
  const config = vscode.workspace.getConfiguration('codingBuddy');
  const provider = config.get<Provider>('provider', 'gemini');
  if (!Object.hasOwn(defaults, provider)) throw new Error('Choose a supported Coding Buddy provider in settings.');
  const model = config.get<unknown>(`models.${provider}`, defaults[provider]);
  if (typeof model !== 'string' || !modelPattern.test(model.trim())) throw new Error('Check the model name in Coding Buddy settings.');
  const endpoint = provider === 'ollama' || provider === 'custom' ? validateEndpoint(config.get(`endpoints.${provider}`, defaultEndpoints[provider])) : undefined;
  const format = provider === 'custom' ? config.get<Connection['format']>('customFormat', 'json_schema') : undefined;
  if (format !== undefined && !['json_schema', 'json_object'].includes(format)) throw new Error('Choose JSON schema or JSON object output in Buddy settings.');
  return { provider, model: model.trim(), requiresKey: requiresKey(provider), endpoint, format };
}

export function keyName(provider: Provider): string { return `codingBuddy.key.${provider}`; }

export async function chooseProvider(): Promise<void> {
  const choice = await vscode.window.showQuickPick((Object.keys(defaults) as Provider[]).map(provider => ({
    label: providerLabels[provider],
    description: defaults[provider], provider
  })), { title: 'Choose your buddy’s AI provider', placeHolder: 'Only the selected provider receives coding context.' });
  if (choice) await vscode.workspace.getConfiguration('codingBuddy').update('provider', choice.provider, vscode.ConfigurationTarget.Global);
}

export async function configureProvider(): Promise<void> {
  const config = vscode.workspace.getConfiguration('codingBuddy');
  const provider = config.get<Provider>('provider', 'gemini');
  if (!Object.hasOwn(defaults, provider)) throw new Error('Choose a supported provider first.');
  const model = await vscode.window.showInputBox({ title: `Model for ${providerLabels[provider]}`, value: config.get(`models.${provider}`, defaults[provider]),
    prompt: provider === 'ollama' ? 'Enter a model already downloaded in your local Ollama installation, including its tag.' : 'Enter a model ID supported by your provider.',
    ignoreFocusOut: true, validateInput: value => modelPattern.test(value.trim()) ? undefined : 'Enter a valid model ID.' });
  if (model === undefined) return;
  let endpoint: string | undefined;
  let format: Connection['format'];
  if (provider === 'ollama' || provider === 'custom') {
    endpoint = await vscode.window.showInputBox({ title: provider === 'ollama' ? 'Ollama chat endpoint' : 'Custom chat completions endpoint',
      value: config.get(`endpoints.${provider}`, defaultEndpoints[provider]), prompt: 'Full request URL. This server receives your coding context. Keep credentials in API key storage.', ignoreFocusOut: true,
      validateInput: value => { try { validateEndpoint(value); return undefined; } catch (error) { return (error as Error).message; } } });
    if (endpoint === undefined) return;
    endpoint = validateEndpoint(endpoint);
    if (provider === 'custom') {
      const choice = await vscode.window.showQuickPick([{ label: 'JSON schema', description: 'Constrain the reply to Buddy’s structure', format: 'json_schema' as const },
        { label: 'JSON object', description: 'For servers without schema output; Buddy still validates replies', format: 'json_object' as const }], { title: 'Output supported by your server' });
      if (!choice) return;
      format = choice.format;
    }
  }
  if (endpoint !== undefined) await config.update(`endpoints.${provider}`, endpoint, vscode.ConfigurationTarget.Global);
  if (format !== undefined) await config.update('customFormat', format, vscode.ConfigurationTarget.Global);
  await config.update(`models.${provider}`, model.trim(), vscode.ConfigurationTarget.Global);
}

export async function checkKnownKeys(context: vscode.ExtensionContext, text: string): Promise<void> {
  for (const provider of Object.keys(defaults) as Provider[]) {
    const key = await context.secrets.get(keyName(provider));
    if (key && text.includes(key)) throw new Error('A saved API key appears in this context. Remove it and enter credentials through Buddy settings.');
  }
}

export async function setKey(context: vscode.ExtensionContext): Promise<void> {
  const { provider } = configuration();
  const key = await vscode.window.showInputBox({ title: `API key for ${provider}`, prompt: 'Stored in VS Code secret storage. Your code and run output are sent to this provider when you use the buddy.',
    password: true, ignoreFocusOut: true, validateInput: value => value.trim().length < 10 || /\s/.test(value.trim()) ? 'Enter a valid provider API key without whitespace.' : undefined });
  if (key !== undefined) await context.secrets.store(keyName(provider), key.trim());
}
