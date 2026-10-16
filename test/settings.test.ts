import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { defaults, providerLabels, Provider } from '../src/providers';
import * as providers from '../src/providers';
import type * as vscode from 'vscode';

function fixture() {
  const values = new Map<string, unknown>(); const secrets = new Map<string, string>();
  const inputs: (string | undefined)[] = []; let picks: any[] = [];
  let choose: (items: any[]) => any = items => items[0];
  const config = { get: (key: string, fallback: unknown) => values.has(key) ? values.get(key) : fallback,
    update: async (key: string, value: unknown, target: number) => { assert.equal(target, 1); values.set(key, value); } };
  const exports = {};
  runInNewContext(readFileSync(resolve(__dirname, '../src/settings.js'), 'utf8'), { exports, require: (name: string) => name === './providers' ? providers : {
    ConfigurationTarget: { Global: 1 }, workspace: { getConfiguration: () => config },
    window: { showQuickPick: async (items: any[]) => { picks = items; return choose(items); }, showInputBox: async (options: vscode.InputBoxOptions) => {
      const value = inputs.shift(); if (value !== undefined) assert.equal(await options.validateInput?.(value), undefined); return value;
    } }
  } });
  const context = { secrets: { get: async (key: string) => secrets.get(key), store: async (key: string, value: string) => { secrets.set(key, value); } } } as unknown as vscode.ExtensionContext;
  return { api: exports as typeof import('../src/settings'), values, secrets, inputs, context, picks: () => picks, choose: (callback: typeof choose) => { choose = callback; } };
}

test('every provider has a distinct label, model setting and secret; only local/custom keys are optional', async () => {
  const f = fixture(); const manifest = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'));
  const ids = Object.keys(defaults) as Provider[];
  assert.deepEqual(manifest.contributes.configuration.properties['codingBuddy.provider'].enum, ids);
  assert.equal(new Set(ids.map(f.api.keyName)).size, ids.length);
  for (const provider of ids) {
    f.values.set('provider', provider);
    const config = f.api.configuration();
    assert.equal(config.model, defaults[provider]);
    assert.equal(config.requiresKey, provider !== 'ollama' && provider !== 'custom');
    assert.ok(providerLabels[provider]);
    assert.equal(manifest.contributes.configuration.properties[`codingBuddy.models.${provider}`].default, defaults[provider]);
  }
  f.choose(items => items.find(item => item.provider === 'custom'));
  await f.api.chooseProvider(); assert.equal(f.values.get('provider'), 'custom'); assert.equal(f.picks().length, ids.length);
});

test('model/connection setup saves global settings only after all prompts and accepts tagged local model IDs', async () => {
  const f = fixture(); f.values.set('provider', 'custom');
  f.inputs.push('model:8b', undefined); await f.api.configureProvider();
  assert.equal(f.values.size, 1, 'dismissed endpoint prompt must not partially change settings');
  f.inputs.push('model:8b', 'http://127.0.0.1:1234/v1/chat/completions');
  f.choose(items => items.find(item => item.format === 'json_object'));
  await f.api.configureProvider();
  const config = f.api.configuration();
  assert.equal(config.endpoint, 'http://127.0.0.1:1234/v1/chat/completions');
  assert.equal(config.model, 'model:8b'); assert.equal(config.format, 'json_object');
  f.values.set('endpoints.custom', 'http://remote.example/api'); assert.throws(() => f.api.configuration(), /HTTPS/);
  f.values.delete('endpoints.custom'); f.values.set('customFormat', 'text'); assert.throws(() => f.api.configuration(), /JSON schema/);
  f.values.set('provider', 'ollama'); f.values.set('models.ollama', 'qwen3:8b'); assert.equal(f.api.configuration().model, 'qwen3:8b');
});

test('all saved provider keys, including optional local/custom keys, stay in secret storage and block context leaks', async () => {
  const f = fixture();
  for (const provider of Object.keys(defaults) as Provider[]) {
    f.values.set('provider', provider); const key = `test-private-${provider}-12345`;
    f.inputs.push(key); await f.api.setKey(f.context);
    assert.equal(f.secrets.get(f.api.keyName(provider)), key);
    assert.ok(!JSON.stringify([...f.values]).includes(key));
    await assert.rejects(f.api.checkKnownKeys(f.context, `some text ${key} more text`), /saved API key/);
  }
  await f.api.checkKnownKeys(f.context, 'public example');
});
