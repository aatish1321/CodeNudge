import { test, TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import type { PanelState } from '../src/panel';
import type { RunSnapshot, TeachingReply } from '../src/teaching';
import type { ProjectSnapshot, WorkspaceContext } from '../src/workspace';

type Document = { uri: ReturnType<typeof uri>; fileName: string; languageId: string; version: number; isDirty: boolean; isClosed: boolean; source: string; getText(): string };
type Input = { source: string; allowedLevel: 'clue' | 'inline' | 'fix'; previousIssue: string; clarification: string; workspace: ProjectSnapshot['data'] & { currentFile: string } };
const uri = (path: string) => ({ scheme: 'file', fsPath: resolve(path), toString: () => pathToFileURL(resolve(path)).toString() });
const disposable = () => ({ dispose() {} });
async function until(check: () => boolean, description: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${description}`);
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

async function controllerFixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'coding-buddy-controller-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const documents: Document[] = [];
  const commands = new Map<string, () => unknown>();
  const subscriptions: { dispose(): void }[] = [];
  let activeEditor: ((editor: { document: Document }) => void) | undefined;
  let changedDocument: ((event: { document: Document; contentChanges: object[] }) => void) | undefined;
  let emit!: (run: RunSnapshot) => void;
  let action!: (name: string, text?: string) => Promise<void>;
  let state!: PanelState;
  let collected = 0;
  const hints: { run: RunSnapshot; reply: unknown }[] = [];
  const proposals: { run: RunSnapshot; reply: unknown }[] = [];
  let acceptCount = 0;
  const requests: { input: Input; signal: AbortSignal }[] = [];
  let respond: (input: Input) => unknown | Promise<unknown> = input => reply(input);
  const folder = { uri: uri(root), name: 'project', index: 0 };
  async function sourceFiles(path: string): Promise<string[]> {
    return (await Promise.all((await readdir(path, { withFileTypes: true })).map(entry => entry.isDirectory()
      ? sourceFiles(join(path, entry.name)) : [join(path, entry.name)]))).flat();
  }
  const workspace = {
    isTrusted: true, textDocuments: documents,
    asRelativePath: (target: ReturnType<typeof uri>) => relative(root, target.fsPath).split(sep).join('/'),
    getWorkspaceFolder: (target: ReturnType<typeof uri>) => {
      const part = relative(root, target.fsPath);
      return part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part) ? folder : undefined;
    },
    getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }),
    findFiles: async () => (await sourceFiles(root)).map(uri),
    openTextDocument: async (target: ReturnType<typeof uri>) => documents.find(document => document.uri.fsPath === target.fsPath)!,
    onDidChangeTextDocument: (callback: typeof changedDocument) => { changedDocument = callback; return disposable(); },
    onDidChangeConfiguration: () => disposable(),
  };
  const window = {
    activeTextEditor: undefined as { document: Document } | undefined,
    createOutputChannel: () => ({ appendLine() {}, dispose() {} }),
    registerWebviewViewProvider: () => disposable(),
    onDidChangeActiveTextEditor: (callback: typeof activeEditor) => { activeEditor = callback; return disposable(); },
    showTextDocument: async (target: ReturnType<typeof uri>) => ({ document: await workspace.openTextDocument(target) }),
  };
  const vscode = {
    workspace, window, Uri: { file: uri, parse: (value: string) => uri(fileURLToPath(value)) },
    RelativePattern: class {},
    commands: { registerCommand: (name: string, handler: () => unknown) => { commands.set(name, handler); return disposable(); } },
  };
  const filename = resolve(__dirname, '../src/extension.js');
  const localRequire = createRequire(filename);
  const projectExports = {} as { WorkspaceContext: typeof WorkspaceContext };
  runInNewContext(readFileSync(resolve(__dirname, '../src/workspace.js'), 'utf8'), {
    exports: projectExports, require: (name: string) => name === 'vscode' ? vscode : localRequire(name),
  });
  class Project extends projectExports.WorkspaceContext {
    override async collect(...args: Parameters<WorkspaceContext['collect']>) {
      try { return await super.collect(...args); } finally { collected++; }
    }
  }
  const extensionExports = {} as { activate(context: unknown): void };
  const boundaries: Record<string, unknown> = {
    vscode,
    './workspace': { ...projectExports, WorkspaceContext: Project },
    './panel': { BuddyPanel: class {
      constructor(_uri: unknown, handler: typeof action) { action = handler; }
      update(value: PanelState) { state = JSON.parse(JSON.stringify(value)); }
    } },
    './editor': { EditorGuidance: class {
      proposalId = '';
      clear() { this.proposalId = ''; }
      showHint(run: RunSnapshot, hint: unknown) { hints.push({ run, reply: hint }); }
      async showProposal(run: RunSnapshot, proposal: unknown) { this.proposalId = 'proposal'; proposals.push({ run, reply: proposal }); }
      async accept() { acceptCount++; this.proposalId = ''; }
      dispose() {}
    } },
    './terminal': { TerminalCapture: class {
      constructor(callback: typeof emit) { emit = callback; }
      disconnect() {} watch() {} connect() {} dispose() {}
    } },
    './providers': { analyze: async (_provider: string, _model: string, _key: string, input: Input, signal: AbortSignal) => {
      requests.push({ input: JSON.parse(JSON.stringify(input)), signal });
      return respond(input);
    } },
    './settings': { configuration: () => ({ provider: 'groq', model: 'test-model' }), keyName: () => 'test-key',
      checkKnownKeys: async () => {}, chooseProvider: async () => {}, setKey: async () => {} },
    './playground': { openPlayground: async () => {} },
  };
  runInNewContext(readFileSync(filename, 'utf8'), {
    exports: extensionExports,
    require: (name: string) => boundaries[name] ?? localRequire(name),
    AbortController, AbortSignal,
  });
  extensionExports.activate({ extensionUri: uri(root), subscriptions,
    secrets: { get: async () => 'test-placeholder-key', onDidChange: () => disposable() } });
  t.after(() => subscriptions.forEach(subscription => subscription.dispose()));
  await until(() => !!state, 'initial panel state');
  async function add(name: string, source: string): Promise<Document> {
    const path = join(root, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, source);
    const document: Document = { uri: uri(path), fileName: path, version: 1, languageId: name.endsWith('.py') ? 'python' : 'javascript',
      isDirty: false, isClosed: false, source, getText() { return this.source; } };
    documents.push(document);
    return document;
  }
  async function select(document: Document) {
    window.activeTextEditor = { document }; activeEditor?.({ document }); await flush();
  }
  async function change(document: Document, source: string) {
    document.source = source; document.version++;
    await writeFile(document.fileName, source);
    changedDocument?.({ document, contentChanges: [{}] }); await flush();
  }
  async function run(document: Document, pending = false) {
    const before = collected;
    emit({ uri: document.uri.toString(), version: document.version, language: document.languageId, source: document.getText(),
      command: `${document.languageId === 'python' ? 'python3' : 'node'} ${document.fileName}`, output: 'TypeError: invalid data\n', exitCode: 1,
      sourceConfirmed: true, reported: false, truncated: false });
    await until(() => collected > before, 'workspace collection');
    await flush(); await flush();
    if (!pending) await until(() => !state.working, 'analysis completion');
  }
  return { root, add, select, change, run, action: (name: string, text?: string) => action(name, text), requests, hints, proposals,
    state: () => state, acceptCount: () => acceptCount, respond: (handler: typeof respond) => { respond = handler; } };
}

function reply(input: Input, changes: Partial<TeachingReply> = {}): TeachingReply {
  return { targetFile: null, status: 'issue', relationship: input.previousIssue ? 'same' : 'new', category: 'runtime',
    intentSource: 'comment', expectedOutcome: 'Produce the expected report.', level: input.allowedLevel,
    message: `${input.workspace.currentFile}: inspect the data being passed.`, line: 2,
    inlineHint: input.allowedLevel === 'inline' ? 'Compare the data shape with what this operation expects.' : null,
    replacement: input.allowedLevel === 'fix' ? input.source : null,
    explanation: input.allowedLevel === 'fix' ? 'Keep the input and calculation consistent.' : null,
    ...changes };
}

test('one activated controller preserves Python and JavaScript progress and clarification, dedupes reruns, and counts helper-only changes', async t => {
  const fixture = await controllerFixture(t);
  const python = await fixture.add('main.py', '# Print the report.\nfrom invoice import total\nprint(total())\n');
  const helper = await fixture.add('invoice.py', '# Compute the total.\ndef total():\n    return 1\n');
  const javascript = await fixture.add('client.js', '// Load the account.\nconst account = undefined;\nconsole.log(account.name);\n');
  await fixture.select(python);
  await fixture.run(python);
  assert.equal(fixture.requests.length, 1);
  await fixture.action('clarify', 'The report should total only paid invoices.');
  assert.equal(fixture.requests.length, 2);
  await fixture.run(python);
  assert.equal(fixture.requests.length, 2, 'unchanged reruns should reuse the last result');
  await fixture.change(helper, `${helper.source}# First attempt\n`);
  await fixture.run(python);
  assert.equal(fixture.state().retries, 1, 'a dependency change is an attempt');
  await fixture.select(javascript);
  assert.equal(fixture.state().retries, 0);
  assert.ok(!fixture.state().messages.some(message => message.text.includes('paid invoices')));
  await fixture.run(javascript);
  assert.equal(fixture.requests.at(-1)!.input.clarification, '');
  await fixture.select(python);
  assert.equal(fixture.state().retries, 1);
  await fixture.run(python);
  const beforeNext = fixture.requests.length;
  await fixture.change(helper, `${helper.source}# Second attempt\n`);
  await fixture.run(python);
  assert.equal(fixture.requests.length, beforeNext + 1);
  assert.equal(fixture.state().retries, 2);
  assert.match(fixture.requests.at(-1)!.input.clarification, /paid invoices/);
  assert.match(fixture.requests.at(-1)!.input.previousIssue, /main.py/);
});

test('editing a related file aborts pending guidance and an uncooperative provider cannot publish the old reply', async t => {
  const fixture = await controllerFixture(t);
  const main = await fixture.add('main.py', '# Show the total.\nimport helper\nprint(helper.VALUE)\n');
  const helper = await fixture.add('helper.py', '# Provide the value.\nVALUE = 1\n');
  let finish!: (reply: TeachingReply) => void;
  fixture.respond(() => new Promise<TeachingReply>(resolve => { finish = resolve; }));
  await fixture.select(main);
  await fixture.run(main, true);
  await until(() => fixture.requests.length === 1, 'pending provider call');
  await fixture.change(helper, '# Provide the value.\nVALUE = 2\n');
  assert.equal(fixture.requests[0].signal.aborted, true);
  finish(reply(fixture.requests[0].input, { message: 'STALE RELATED FILE RESPONSE' }));
  await flush(); await flush();
  assert.ok(!fixture.state().messages.some(message => message.text.includes('STALE')));
  assert.match(fixture.state().status, /changed/i);
  assert.equal(fixture.hints.length, 0);
  assert.equal(fixture.proposals.length, 0);
  fixture.respond(input => reply(input));
  await fixture.change(helper, '# Provide the value.\nVALUE = 1\n');
  await fixture.run(main);
  assert.equal(fixture.requests.length, 2, 'a cancelled request can rerun after an edit is undone');
});

test('a late reply after switching languages cannot replace the new file conversation or status', async t => {
  const fixture = await controllerFixture(t);
  const python = await fixture.add('main.py', '# Print a value.\nx = None\nprint(x.value)\n');
  const javascript = await fixture.add('main.js', '// Print a value.\nconst x = undefined;\nconsole.log(x.value);\n');
  let finish!: (reply: TeachingReply) => void;
  fixture.respond(input => input.workspace.currentFile.endsWith('.py')
    ? new Promise<TeachingReply>(resolve => { finish = resolve; }) : reply(input));
  await fixture.select(python);
  await fixture.run(python, true);
  await until(() => fixture.requests.length === 1, 'Python provider call');
  await fixture.select(javascript);
  await fixture.run(javascript);
  const status = fixture.state().status;
  finish(reply(fixture.requests[0].input, { message: 'STALE PYTHON RESPONSE' }));
  await flush(); await flush();
  assert.equal(fixture.requests[0].signal.aborted, true);
  assert.equal(fixture.state().file, 'main.js');
  assert.equal(fixture.state().status, status);
  assert.ok(!fixture.state().messages.some(message => message.text.includes('STALE')));
  assert.ok(fixture.state().messages.some(message => message.text.includes('main.js')));
});

test('related-file hints use fully read project files and reject truncated or unprovided model targets', async t => {
  const fixture = await controllerFixture(t);
  const main = await fixture.add('main.py', '# Calculate the result.\nimport helper\nprint(helper.VALUE)\n');
  const helper = await fixture.add('helper.py', '# Compute the value.\nVALUE = 1\n');
  await fixture.add('large.py', `# ${'x'.repeat(7_000)}\n`);
  fixture.respond(input => reply(input, { targetFile: 'helper.py' }));
  await fixture.select(main);
  await fixture.run(main);
  for (let index = 0; index < 3; index++) {
    await fixture.change(helper, `${helper.source}# attempt ${index}\n`);
    await fixture.run(main);
  }
  assert.equal(fixture.state().retries, 3);
  assert.equal(fixture.hints.at(-1)!.run.uri, helper.uri.toString());
  assert.equal(fixture.hints.at(-1)!.run.source, helper.source);
  const hints = fixture.hints.length;
  for (const targetFile of ['large.py', '../outside.py', 'not-provided.py']) {
    fixture.respond(input => reply(input, { targetFile }));
    await fixture.action('retry');
    assert.match(fixture.state().status, /did not fully read/);
    assert.equal(fixture.hints.length, hints);
    assert.equal(fixture.proposals.length, 0);
  }
});

test('protected source files cannot bypass exclusions through manual result sharing', async t => {
  const fixture = await controllerFixture(t);
  for (const name of ['credentials.py', 'secrets.js', '.private/config.py']) {
    const document = await fixture.add(name, '# Private material\nVALUE = "not-a-real-secret"\n');
    await fixture.select(document);
    await fixture.action('shareResult', 'Error while running my code');
    assert.equal(fixture.requests.length, 0);
    assert.match(fixture.state().status, /excluded/);
  }
});

test('saved inline hints return after a file switch without spending a new AI request', async t => {
  const fixture = await controllerFixture(t);
  const python = await fixture.add('main.py', '# Print a value.\nx = None\nprint(x.value)\n');
  const js = await fixture.add('client.js', '// Print a value.\nconsole.log(unknown.value);\n');
  await fixture.select(python); await fixture.run(python);
  for (let index = 0; index < 3; index++) {
    await fixture.change(python, `${python.source}# Attempt ${index}\n`); await fixture.run(python);
  }
  const requests = fixture.requests.length;
  const hints = fixture.hints.length;
  await fixture.select(js);
  python.version = 1; // Reopening an unchanged document can reset its version.
  await fixture.select(python);
  await until(() => fixture.hints.length > hints, 'restored hint');
  assert.equal(fixture.hints.at(-1)!.run.uri, python.uri.toString());
  assert.equal(fixture.hints.at(-1)!.run.version, python.version);
  assert.equal(fixture.state().retries, 3);
  await fixture.run(python);
  assert.equal(fixture.requests.length, requests);
});

test('accepting a helper fix rechecks the whole read context before invoking the editor', async t => {
  const fixture = await controllerFixture(t);
  const main = await fixture.add('main.py', '# Calculate the result.\nimport helper\nprint(helper.VALUE)\n');
  const helper = await fixture.add('helper.py', '# Compute the value.\nVALUE = 1\n');
  const context = await fixture.add('context.js', '// Shared project context\nconst rate = 2;\n');
  fixture.respond(input => reply(input, { targetFile: 'helper.py', replacement: input.allowedLevel === 'fix' ? '# Compute the value.\nVALUE = 2\n' : null }));
  await fixture.select(main); await fixture.run(main);
  for (let index = 0; index < 6; index++) {
    await fixture.change(helper, `${helper.source}# Attempt ${index}\n`); await fixture.run(main);
  }
  assert.equal(fixture.proposals.at(-1)!.run.uri, helper.uri.toString());
  assert.equal(fixture.state().retries, 6);
  await writeFile(context.fileName, '// Changed externally before the watcher updates\nconst rate = 3;\n');
  await fixture.action('acceptFix');
  await until(() => /Project code changed/.test(fixture.state().status), 'stale-context status');
  assert.match(fixture.state().status, /Project code changed/);
  assert.equal(fixture.acceptCount(), 0);
});

test('editing an unrelated language example refreshes context without counting a retry on this problem', async t => {
  const fixture = await controllerFixture(t);
  const python = await fixture.add('main.py', '# Print the report.\nfrom helper import value\nprint(value)\n');
  const helper = await fixture.add('helper.py', '# Supply the value.\nvalue = 1\n');
  const js = await fixture.add('countdown.js', '// Count down\nconsole.log(3);\n');
  await fixture.select(python); await fixture.run(python);
  await fixture.change(js, '// Count down\nconsole.log(2);\n');
  await fixture.run(python);
  assert.equal(fixture.requests.length, 2, 'changed project context is rechecked');
  assert.equal(fixture.state().retries, 0, 'an unrelated edit is not an attempt on this issue');
  await fixture.change(helper, '# Supply the value.\nvalue = 2\n');
  await fixture.run(python);
  assert.equal(fixture.state().retries, 1, 'an imported helper edit still counts');
});
