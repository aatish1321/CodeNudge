import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import type { WorkspaceContext } from '../src/workspace';
import type { RunSnapshot } from '../src/teaching';

export async function checkProjectMode(extensionPath: string, workspace: WorkspaceContext, run: RunSnapshot): Promise<void> {
  const { ProjectMode } = require(join(extensionPath, 'out/src/projectMode.js')) as typeof import('../src/projectMode');
  const { configuration, keyName } = require(join(extensionPath, 'out/src/settings.js')) as typeof import('../src/settings');
  const provider = configuration().provider;
  const fixtureKey = 'native-project-fixture-key';
  const storage = new Map<string, unknown>();
  const context = { secrets: { get: async (name: string) => name === keyName(provider) ? fixtureKey : undefined },
    workspaceState: { get: (name: string) => storage.get(name), update: async (name: string, value: unknown) => { storage.set(name, structuredClone(value)); } }
  } as unknown as vscode.ExtensionContext;
  const requests: Record<string, any>[] = [];
  const originalFetch = globalThis.fetch;
  const task = { title: 'Show a total', prompt: 'Choose a way to combine the prices.', check: 'The sample prints 18.' };
  const plan = { kind: 'plan', title: 'Tiny expense tracker', message: 'Here are three small steps.', tasks: [task,
    { title: 'Choose prices', prompt: 'Let someone choose their prices.', check: 'Two different lists work.' },
    { title: 'Empty input', prompt: 'Think about someone entering nothing.', check: 'Empty input has a helpful result.' }] };
  let celebrations = 0;
  const project = new ProjectMode(context, workspace, celebrate => { if (celebrate) celebrations++; });
  let restored: InstanceType<typeof ProjectMode> | undefined;
  try {
    globalThis.fetch = async (_url, init) => {
      const payload = JSON.parse(String(init?.body));
      const input = JSON.parse(provider === 'gemini' ? payload.contents[0].parts[0].text : provider === 'openai' ? payload.input : payload.messages[1].content);
      requests.push(input);
      const reply = JSON.stringify(input.operation === 'plan' ? plan : { message: 'Your sample output matches this check. Try a second example too.', ready: true });
      const body = provider === 'gemini' ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: reply }] } }] }
        : provider === 'openai' ? { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: reply }] }] }
        : { choices: [{ finish_reason: 'stop', message: { content: reply } }] };
      return new Response(JSON.stringify(body), { status: 200 });
    };
    await project.handle('clarify', fixtureKey);
    assert.match(project.view.error, /key/i);
    assert.equal(storage.size, 0, 'known keys must not be persisted as project ideas');
    await project.handle('clarify', 'A tiny expense tracker in Python');
    assert.equal(project.view.phase, 'choice'); assert.equal(requests.length, 0);
    await project.handle('projectFeatures');
    await project.handle('clarify', 'Add prices, show a total, handle empty input.');
    assert.equal(project.view.phase, 'plan'); assert.equal(requests[0].code, undefined);
    await project.handle('projectStart');
    project.observe(run);
    await project.handle('projectReview');
    assert.equal(project.view.error, ''); assert.equal(project.view.ready, true);
    assert.equal(project.view.current, 0, 'AI review cannot complete a task');
    assert.equal(requests[1].code.source, run.source); assert.equal(requests[1].code.run.output, run.output);
    await project.handle('projectDone');
    restored = new ProjectMode(context, workspace, celebrate => { if (celebrate) celebrations++; });
    await restored.handle('projectDone');
    assert.equal(restored.view.current, 2, 'the new controller must restore saved progress before acting');
    await restored.handle('projectDone');
    assert.equal(restored.view.phase, 'done'); assert.equal(celebrations, 1);
    assert.equal(vscode.window.activeTextEditor?.document.getText(), run.source, 'project coaching must not change code');
    await vscode.commands.executeCommand('codingBuddy.projectMode');
    console.log('HOST CHECK PASSED: actual Project Mode command, real saved-source context, key guard, plan approval, task review and restored progress (provider replies are HTTP fixtures).');
  } finally { globalThis.fetch = originalFetch; project.dispose(); restored?.dispose(); }
}
