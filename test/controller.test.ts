import { test, TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import type { PanelState } from '../src/panel';
import type { RunSnapshot, TeachingReply } from '../src/teaching';
import type { ProjectSnapshot, WorkspaceContext } from '../src/workspace';
import { ProviderRequestError } from '../src/providers';

type Document = { uri: ReturnType<typeof uri>; fileName: string; languageId: string; version: number; isDirty: boolean; isClosed: boolean; source: string; getText(): string };
type Input = { output: string; source: string; allowedLevel: 'clue' | 'inline' | 'fix'; previousIssue: string; clarification: string; workspace: ProjectSnapshot['data'] & { currentFile: string } };
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

async function controllerFixture(t: TestContext, trusted = true, storage = new Map<string, unknown>()) {
  const root = await mkdtemp(join(tmpdir(), 'coding-buddy-controller-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const documents: Document[] = [];
  const commands = new Map<string, () => unknown>();
  const subscriptions: { dispose(): void }[] = [];
  let activeEditor: ((editor: { document: Document }) => void) | undefined;
  let changedDocument: ((event: { document: Document; contentChanges: object[] }) => void) | undefined;
  let emit!: (run: RunSnapshot) => void;
  let action!: (name: string, text?: string) => Promise<unknown>;
  let state!: PanelState;
  let collected = 0;
  let granted: (() => void) | undefined;
  let watching = true;
  let configurationChanged: ((event: { affectsConfiguration(key: string): boolean }) => void) | undefined;
  const preferences = new Map<string, unknown>();
  const emitConfiguration = (...keys: string[]) => configurationChanged?.({ affectsConfiguration: section => section === 'codingBuddy' || keys.some(key => `codingBuddy.${key}` === section || `codingBuddy.${key}`.startsWith(`${section}.`)) });
  let finishRun!: () => void;
  const directRuns: { document: Document; executable: string; args: string[] }[] = [];
  const executed: string[] = [];
  const hints: { run: RunSnapshot; reply: unknown }[] = [];
  const proposals: { run: RunSnapshot; reply: unknown }[] = [];
  let acceptCount = 0;
  let confirmReset = false;
  const providerConfig = { provider: 'groq', model: 'test-model', requiresKey: true, endpoint: undefined as string | undefined, format: undefined as string | undefined };
  let providerKey: string | undefined = 'test-placeholder-key';
  const projectRequests: { input: Record<string, unknown>; signal: AbortSignal; connection?: unknown; key?: string }[] = [];
  let respondProject: (input: Record<string, unknown>) => unknown | Promise<unknown> = input => input.operation === 'plan' ? projectPlan() : { message: 'Follow one value through your attempt. What changes?', ready: false };
  const requests: { input: Input; signal: AbortSignal; connection?: unknown; key?: string }[] = [];
  let respond: (input: Input) => unknown | Promise<unknown> = input => reply(input);
  const folder = { uri: uri(root), name: 'project', index: 0 };
  async function sourceFiles(path: string): Promise<string[]> {
    return (await Promise.all((await readdir(path, { withFileTypes: true })).map(entry => entry.isDirectory()
      ? sourceFiles(join(path, entry.name)) : [join(path, entry.name)]))).flat();
  }
  const workspace = {
    isTrusted: trusted, textDocuments: documents, workspaceFolders: [folder],
    asRelativePath: (target: ReturnType<typeof uri>) => relative(root, target.fsPath).split(sep).join('/'),
    getWorkspaceFolder: (target: ReturnType<typeof uri>) => {
      const part = relative(root, target.fsPath);
      return part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part) ? folder : undefined;
    },
    getConfiguration: () => ({ get: (key: string, fallback: unknown) => preferences.get(key) ?? fallback,
      update: async (key: string, value: unknown) => { preferences.set(key, value); emitConfiguration(key); } }),
    findFiles: async () => (await sourceFiles(root)).map(uri),
    openTextDocument: async (target: ReturnType<typeof uri>) => documents.find(document => document.uri.fsPath === target.fsPath)!,
    onDidChangeTextDocument: (callback: typeof changedDocument) => { changedDocument = callback; return disposable(); },
    onDidChangeConfiguration: (callback: typeof configurationChanged) => { configurationChanged = callback; return disposable(); },
    onDidGrantWorkspaceTrust: (callback: () => void) => { granted = callback; return disposable(); },
  };
  const window = {
    showWarningMessage: async (_message: string, _options: unknown, label: string) => confirmReset ? label : undefined,
    activeTextEditor: undefined as { document: Document } | undefined,
    createOutputChannel: () => ({ appendLine() {}, dispose() {} }),
    registerWebviewViewProvider: () => disposable(),
    onDidChangeActiveTextEditor: (callback: typeof activeEditor) => { activeEditor = callback; return disposable(); },
    showTextDocument: async (target: ReturnType<typeof uri>) => ({ document: await workspace.openTextDocument(target) }),
  };
  const vscode = {
    workspace, window, Uri: { file: uri, parse: (value: string) => uri(fileURLToPath(value)) },
    RelativePattern: class {}, ConfigurationTarget: { Global: 1 },
    commands: { executeCommand: async (command: string) => { executed.push(command); }, registerCommand: (name: string, handler: () => unknown) => { commands.set(name, handler); return disposable(); } },
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
      disconnect() { watching = false; } watch() { watching = true; } connect() { watching = true; } dispose() {}
    } },
    './runner': { FileRunner: class {
      busy = false;
      async run(document: Document, executable: string, args: string[]): Promise<RunSnapshot> {
        this.busy = true; directRuns.push({ document, executable, args });
        await new Promise<void>(resolve => { finishRun = resolve; });
        this.busy = false;
        return { uri: document.uri.toString(), source: document.source, version: document.version, language: document.languageId,
          command: executable, output: 'TypeError: invalid data\n', exitCode: 1, reported: false, truncated: false, sourceConfirmed: true };
      }
      dispose() {}
    } },
    './providers': { ProviderRequestError: localRequire('./providers').ProviderRequestError, projectReply: async (_provider: string, _model: string, key: string, input: Record<string, unknown>, signal: AbortSignal, connection?: unknown) => { projectRequests.push({ input: JSON.parse(JSON.stringify(input)), signal, connection, key }); return respondProject(input); }, analyze: async (_provider: string, _model: string, key: string, input: Input, signal: AbortSignal, connection?: unknown) => {
      requests.push({ input: JSON.parse(JSON.stringify(input)), signal, connection, key });
      return respond(input);
    } },
    './settings': { configuration: () => ({ ...providerConfig }), keyName: () => 'test-key',
      checkKnownKeys: async () => {}, chooseProvider: async () => {}, configureProvider: async () => {}, setKey: async () => {} },
    './playground': { openPlayground: async () => {} },
  };
  const projectModeExports = {};
  runInNewContext(readFileSync(resolve(__dirname, '../src/projectMode.js'), 'utf8'), { exports: projectModeExports,
    require: (name: string) => boundaries[name] ?? localRequire(name), AbortController, AbortSignal });
  boundaries['./projectMode'] = projectModeExports;
  runInNewContext(readFileSync(filename, 'utf8'), {
    exports: extensionExports,
    require: (name: string) => boundaries[name] ?? localRequire(name),
    AbortController, AbortSignal, process: { platform: process.platform }, setTimeout, clearTimeout,
  });
  extensionExports.activate({ extensionUri: uri(root), subscriptions, workspaceState: { get: (key: string) => storage.get(key), update: async (key: string, value: unknown) => { storage.set(key, value); } },
    secrets: { get: async () => providerKey, onDidChange: () => disposable() } });
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
  async function run(document: Document, pending = false, confirmed = true, output = 'TypeError: invalid data\n', exitCode = 1) {
    const before = collected;
    emit({ uri: document.uri.toString(), version: document.version, language: document.languageId, source: document.getText(),
      command: `${document.languageId === 'python' ? 'python3' : 'node'} ${document.fileName}`, output, exitCode,
      sourceConfirmed: confirmed, reported: false, truncated: false });
    if (!workspace.isTrusted || !confirmed || state.mode === 'project') { await flush(); return; }
    await until(() => collected > before, 'workspace collection');
    await flush(); await flush();
    if (!pending) await until(() => !state.working, 'analysis completion');
  }
  return { root, add, select, change, run, action: (name: string, text?: string) => action(name, text), requests, hints, proposals,
    configure: (overrides: Partial<typeof providerConfig>, key?: string) => { Object.assign(providerConfig, overrides); providerKey = key; emitConfiguration('provider'); },
    executed, directRuns, projectRequests, storage, respondProject: (handler: typeof respondProject) => { respondProject = handler; },
    confirmReset: (value: boolean) => { confirmReset = value; }, project: () => state.project!, emitConfiguration, finishRun: () => finishRun(), watching: () => watching, collected: () => collected,
    grantTrust: async () => { workspace.isTrusted = true; granted?.(); await flush(); },
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

test('a rejected provider request cannot assess the code and an explicit retry can publish a logic clue', async t => {
  const fixture = await controllerFixture(t);
  const document = await fixture.add('maximum.py', '# Find the largest number.\ndef maximum(values):\n    candidate = 0\n    for value in values:\n        if value > candidate:\n            candidate = value\n    return candidate\nprint(maximum([-10, -5, -3]))\n');
  fixture.respond(() => { throw new ProviderRequestError(400, 'json_validate_failed', 'Groq couldn’t format this hint. Your code has not been assessed yet.'); });
  await fixture.select(document); await fixture.run(document, false, true, '0\n', 0);
  assert.equal(fixture.state().messages.length, 0);
  assert.equal(fixture.state().celebration, 0);
  assert.match(fixture.state().status, /not been assessed/);
  await fixture.run(document, false, true, '0\n', 0);
  assert.equal(fixture.requests.length, 1, 'a failure does not create an automatic retry loop');
  fixture.respond(input => reply(input, { category: 'logic', line: 3, message: 'Is the starting candidate part of the original list?' }));
  await fixture.action('retry');
  assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.state().hasIssue, true);
  assert.match(fixture.state().messages.at(-1)!.text, /starting candidate/);
  assert.equal(fixture.state().celebration, 0);
});

test('real greeting edits preserve effort across NameError, TypeError and logic issues, pointing at the current line', async t => {
  const fixture = await controllerFixture(t);
  const expressions = [
    '"Hello " + user_name + ", you are " + age + " years old."',
    '"Hello " + user_name + ", you are " + age + " years old."',
    'f"Hello " + user_name + ", you are " + age + " years old."',
    'f"Hello + user_name + , you are + {age} + years old."',
    'f"Hello {user_name}, you are + {age} years old."',
    'f"Hello {user_name}, you are {{age}} years old."',
    'f"Hello {user_name}, you are {age + 1} years old."'
  ];
  const source = (index: number) => `user_name = ${index === 0 ? 'Alex' : '"Alex"'}\nage = 22\n\ngreeting = ${expressions[index]}\n\nprint(greeting)\n`;
  const document = await fixture.add('greeting.py', source(0));
  fixture.respond(input => reply(input, { relationship: 'new', category: input.output.includes('Error:') ? 'runtime' : 'logic',
    intentSource: 'inferred', expectedOutcome: 'Greet the user by name and age.',
    message: input.output.includes('NameError:') ? 'What does this name refer to?' : 'Which values become part of the greeting?',
    line: input.output.includes('NameError:') ? 1 : 4,
    inlineHint: input.allowedLevel === 'inline' ? 'Trace the values used to build this greeting.' : null,
    replacement: input.allowedLevel === 'fix' ? source(6).replace('{age + 1}', '{age}') : null }));
  await fixture.select(document);
  for (let index = 0; index < expressions.length; index++) {
    if (index) await fixture.change(document, source(index));
    const result = spawnSync('python3', [document.fileName], { encoding: 'utf8' });
    assert.ifError(result.error); assert.notEqual(result.status, null);
    const output = result.stdout + result.stderr;
    await fixture.run(document, false, true, output, result.status!);
    assert.equal(fixture.state().retries, index, 'a new diagnostic must not reset effort');
    assert.doesNotMatch(fixture.state().status, /couldn.t read|same issue/);
    if (index < 3) assert.equal(fixture.hints.length, 0);
    if (index === 3) {
      assert.equal(fixture.requests.at(-1)!.input.allowedLevel, 'inline');
      const hint = fixture.hints.at(-1)!;
      assert.equal(hint.run.source, document.source);
      assert.equal((hint.reply as TeachingReply).line, 4, 'use the current expression, not the old name error');
    }
    const requests = fixture.requests.length;
    await fixture.run(document, false, true, output, result.status!);
    assert.equal(fixture.requests.length, requests, 'unchanged reruns remain cached');
  }
  assert.equal(fixture.proposals.length, 1);
  assert.equal(fixture.state().celebration, 0);
  assert.equal(document.source, source(6), 'the learner still reviews the fix before source changes');
  await fixture.action('reset');
  assert.equal(fixture.state().retries, 0);
  assert.equal(fixture.state().hasIssue, false);
});

test('inconsistent no-stage logic replies still establish an issue and reach inline and reviewed-fix stages', async t => {
  const fixture = await controllerFixture(t);
  const source = 'user_name = "Alex"\nage = 22\ngreeting = f"hello + {user_name} + you are + {age} + years old."\nprint(greeting)\n';
  const document = await fixture.add('greeting.py', source);
  fixture.respond(input => reply(input, { category: 'logic', intentSource: 'inferred', expectedOutcome: 'Format a greeting.',
    level: input.allowedLevel === 'fix' ? 'fix' : 'none', line: 3,
    message: 'Which parts of this formatted string are literal text, and which parts are expressions?',
    replacement: input.allowedLevel === 'fix' ? source.replace('hello + {user_name} + you are + {age} +', 'hello {user_name}, you are {age}') : null }));
  await fixture.select(document); await fixture.run(document, false, true, 'hello + Alex + you are + 22 + years old.\n', 0);
  assert.equal(fixture.state().hasIssue, true);
  assert.doesNotMatch(fixture.state().status, /couldn.t read/);
  for (let attempt = 1; attempt <= 6; attempt++) {
    await fixture.change(document, source.replace('hello +', `hello${'!'.repeat(attempt)} +`));
    await fixture.run(document, false, true, `hello${'!'.repeat(attempt)} + Alex + you are + 22 + years old.\n`, 0);
    assert.equal(fixture.state().retries, attempt);
    assert.doesNotMatch(fixture.state().status, /couldn.t read/);
    const count = fixture.requests.length;
    await fixture.run(document, false, true, `hello${'!'.repeat(attempt)} + Alex + you are + 22 + years old.\n`, 0);
    assert.equal(fixture.requests.length, count, 'an unchanged rerun remains cached');
    if (attempt === 3) assert.equal(fixture.hints.at(-1)?.run.uri, document.uri.toString());
  }
  assert.equal(fixture.proposals.length, 1);
  assert.equal(fixture.state().celebration, 0, 'an inferred goal does not establish success');
  assert.equal(document.source.includes('hello!!!!!! +'), true, 'a proposed fix does not silently edit source');
});

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
  assert.match(fixture.state().messages.at(-1)!.text, /^In helper\.py:/, 'name the helper even before inline escalation');
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

test('Restricted Mode keeps the panel visible but blocks watching, context and AI until trust is granted', async t => {
  const fixture = await controllerFixture(t, false);
  const python = await fixture.add('main.py', '# Print a value.\nx = None\nprint(x.value)\n');
  assert.equal(fixture.state().trusted, false);
  assert.match(fixture.state().status, /Trust this folder/);
  assert.equal(fixture.watching(), false);
  await fixture.select(python);
  await fixture.run(python);
  await fixture.action('shareResult', 'TypeError: invalid data');
  await fixture.action('clarify', 'The expected output is 1');
  await fixture.action('connect');
  await fixture.action('runFile');
  assert.equal(fixture.collected(), 0);
  assert.equal(fixture.requests.length, 0);
  await fixture.action('trust');
  assert.deepEqual(fixture.executed, ['workbench.trust.manage']);
  assert.equal(fixture.state().trusted, false, 'opening trust management does not grant trust');
  await fixture.grantTrust();
  await until(() => fixture.state().trusted, 'trusted panel state');
  assert.equal(fixture.watching(), true);
  await fixture.select(python);
  await fixture.run(python);
  assert.equal(fixture.requests.length, 1);
});

test('Run with CodeNudge routes saved Python/JavaScript arguments and refuses to interrupt an active run', async t => {
  const fixture = await controllerFixture(t);
  const python = await fixture.add('my folder/expenses.py', '# Print 18\nprint(18)\n');
  await fixture.select(python);
  const first = fixture.action('runFile');
  await until(() => fixture.directRuns.length === 1, 'Python launch');
  assert.equal(fixture.directRuns[0].executable, process.platform === 'win32' ? 'python' : 'python3');
  assert.deepEqual(Array.from(fixture.directRuns[0].args), [python.fileName]);
  await fixture.action('runFile');
  assert.equal(fixture.directRuns.length, 1, 'do not interrupt the first command');
  fixture.finishRun(); await first;
  await until(() => fixture.requests.length === 1 && !fixture.state().working, 'Python analysis');
  const js = await fixture.add('countdown.js', '// Print 1\nconsole.log(1);\n');
  await fixture.select(js);
  const second = fixture.action('runFile');
  await until(() => fixture.directRuns.length === 2, 'JavaScript launch');
  assert.equal(fixture.directRuns[1].executable, 'node');
  fixture.finishRun(); await second;
  await until(() => fixture.requests.length === 2 && !fixture.state().working, 'JavaScript analysis');
});

test('an unlinked terminal result does not create a yes/no question or spend an AI request', async t => {
  const fixture = await controllerFixture(t);
  const document = await fixture.add('main.py', '# Print a value.\nx = None\nprint(x.value)\n');
  await fixture.select(document); await fixture.run(document);
  const messages = fixture.state().messages;
  await fixture.run(document, false, false);
  await until(() => /Run with CodeNudge/.test(fixture.state().status), 'quiet unlinked-run status');
  assert.equal(fixture.requests.length, 1);
  assert.deepEqual(fixture.state().messages, messages);
  assert.doesNotMatch(fixture.state().status, /yes|Was that result/);
});

test('correct output replaces old error clues, celebrates once, and unchanged success makes no new request', async t => {
  const fixture = await controllerFixture(t);
  const document = await fixture.add('expenses.py', '# Print 18.\nprices = [10, "5", 3]\nprint(sum(prices))\n');
  fixture.respond(input => input.output.trim() === '18'
    ? reply(input, { status: 'solved', relationship: 'same', level: 'none', category: 'unknown',
      expectedOutcome: 'Print 18.', message: 'You got it! The total is 18.', line: null })
    : reply(input, { category: input.output.includes('SyntaxError') ? 'syntax' : 'runtime' }));
  await fixture.select(document); await fixture.run(document);
  await fixture.change(document, '# Print 18.\nprices = [10, 5", 3]\nprint(sum(prices))\n');
  await fixture.run(document, false, true, 'SyntaxError: unterminated string literal\n', 1);
  assert.equal(fixture.state().celebration, 0);
  assert.equal(fixture.state().hasIssue, true);
  await fixture.change(document, '# Print 18.\nprices = [10, 5, 3]\nprint(sum(prices))\n');
  await fixture.run(document, false, true, '18\n', 0);
  assert.match(fixture.state().status, /matches the stated goal/);
  assert.equal(fixture.state().celebration, 1);
  assert.equal(fixture.state().hasIssue, false);
  assert.equal(fixture.state().retries, 0);
  assert.deepEqual(fixture.state().messages.map(message => message.text), ['You got it! The total is 18.']);
  assert.equal(fixture.requests.length, 3);
  await fixture.run(document, false, true, '18\n', 0);
  assert.equal(fixture.requests.length, 3);
  assert.equal(fixture.state().celebration, 1);
});

test('a behavioral goal supports checking a computed answer without a learner-supplied result', async t => {
  const fixture = await controllerFixture(t);
  const source = '# Find the largest number in a list of numbers.\ndef find_maximum(numbers):\n    max_val = 0\n    for num in numbers:\n        if num > max_val:\n            max_val = num\n    return max_val\n\nprint(find_maximum([-10, -5, -3]))\n';
  const document = await fixture.add('maximum.py', source);
  fixture.respond(input => input.output.trim() === '-3'
    ? reply(input, { status: 'solved', relationship: 'same', level: 'none', category: 'unknown', line: null,
      expectedOutcome: 'Find the largest member of the supplied list.',
      message: 'For this list, -3 is greater than -10 and -5. This run matches the goal.' })
    : reply(input, { category: 'logic', line: 3, expectedOutcome: 'Find the largest member of the supplied list.',
      message: 'How does your starting candidate compare with the negative values in this list?' }));
  await fixture.select(document); await fixture.run(document, false, true, '0\n', 0);
  assert.equal(fixture.state().hasIssue, true);
  assert.equal(fixture.state().celebration, 0);
  await fixture.change(document, source.replace('max_val = 0', 'max_val = numbers[0]'));
  await fixture.run(document, false, true, '-3\n', 0);
  assert.equal(fixture.state().hasIssue, false);
  assert.equal(fixture.state().celebration, 1);
  assert.match(fixture.state().status, /matches the stated goal/);
  assert.equal(fixture.requests.length, 2);
  assert.ok(fixture.requests.every(request => request.input.clarification === ''));
  assert.ok(fixture.state().messages.every(message => message.role === 'buddy'));
  assert.match(fixture.state().messages.at(-1)!.text, /For this list/);
});

test('ambiguous tasks ask for a goal and accept not knowing the answer without another code attempt', async t => {
  const fixture = await controllerFixture(t);
  const document = await fixture.add('numbers.py', '# Process these numbers.\nprint(max([-10, -5, -3]))\n');
  fixture.respond(input => input.clarification
    ? reply(input, { status: 'solved', relationship: 'none', category: 'unknown', intentSource: 'clarified',
      expectedOutcome: 'Find the largest member of the list.', level: 'none', line: null,
      message: 'For this input, -3 is the largest member. This run matches your goal.' })
    : reply(input, { status: 'needs_clarification', relationship: 'unknown', category: 'unknown', intentSource: 'unknown',
      expectedOutcome: null, level: 'none', line: null, message: 'Are you practising finding the largest number or adding the numbers?' }));
  await fixture.select(document); await fixture.run(document, false, true, '-3\n', 0);
  assert.match(fixture.state().status, /task or concept/);
  assert.doesNotMatch(fixture.state().status, /what you expected/);
  await fixture.action('clarify', 'I want to find the largest number. I do not know the correct answer.');
  assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.state().retries, 0);
  assert.equal(fixture.state().celebration, 0, 'checking an initially correct run is not a resolved tracked issue');
  assert.match(fixture.state().status, /matches the stated goal/);
});

test('animation preferences refresh without cancelling guidance, while a combined provider change still cancels it', async t => {
  const fixture = await controllerFixture(t);
  const document = await fixture.add('main.py', '# Print the value.\nx = None\nprint(x.value)\n');
  let finish!: (value: TeachingReply) => void;
  fixture.respond(() => new Promise(resolve => { finish = resolve; }));
  await fixture.select(document); await fixture.run(document, true);
  await until(() => fixture.requests.length === 1, 'pending guidance');
  await fixture.action('toggleCharacterAnimation');
  await until(() => fixture.state().animateCharacter === false, 'paused motion');
  assert.equal(fixture.requests[0].signal.aborted, false);
  assert.equal(fixture.state().working, true);
  finish(reply(fixture.requests[0].input));
  await until(() => !fixture.state().working, 'completed guidance');
  const messages = fixture.state().messages;
  await fixture.action('toggleCharacterAnimation');
  await until(() => fixture.state().animateCharacter, 'resumed motion');
  assert.deepEqual(fixture.state().messages, messages);
  assert.equal(fixture.requests.length, 1);
  await fixture.change(document, document.source + '# Try again\n');
  await fixture.run(document, true);
  await until(() => fixture.requests.length === 2, 'second pending guidance');
  fixture.emitConfiguration('animateCharacter', 'provider');
  assert.equal(fixture.requests[1].signal.aborted, true);
  finish(reply(fixture.requests[1].input));
  await flush(); await flush();
});

function projectPlan() {
  return { kind: 'plan', title: 'A tiny tracker', message: 'Here is a small first version. Change anything before starting.', tasks: [
    { title: 'Choose an entry', prompt: 'Think about the smallest useful piece of information to keep.', check: 'Describe one example entry you want to track.' },
    { title: 'Show the entries', prompt: 'Find a way to present the entries clearly.', check: 'Two different entries are visible.' },
    { title: 'Try an empty list', prompt: 'Think about what someone should see before adding anything.', check: 'An empty list has a helpful message.' }
  ] };
}

test('Project mode collects custom features, requires plan approval, persists tasks and keeps Debug separate', async t => {
  const fixture = await controllerFixture(t);
  const doc = await fixture.add('app.py', '# Track entries.\nprint("ready")\n');
  await fixture.select(doc); await fixture.run(doc);
  const debugMessages = fixture.state().messages;
  await fixture.action('modeProject'); await fixture.action('clarify', 'A tiny habit tracker');
  await until(() => fixture.project().phase === 'choice', 'feature choice');
  assert.equal(fixture.projectRequests.length, 0);
  await fixture.action('projectFeatures'); await fixture.action('clarify', 'I want to add and show habits. Practise Python.');
  await until(() => fixture.project().phase === 'plan', 'reviewable plan');
  assert.match(String(fixture.projectRequests[0].input.features), /Practise Python/);
  assert.equal(fixture.projectRequests[0].input.code, undefined, 'planning sends no project code');
  await fixture.run(doc);
  assert.equal(fixture.requests.length, 1, 'Project mode does not trigger automatic Debug AI calls');
  assert.equal(fixture.project().phase, 'plan');
  await fixture.action('projectDone');
  assert.equal(fixture.project().current, 0, 'a plan cannot advance before approval');
  await fixture.action('projectStart'); await fixture.action('projectDone');
  await until(() => fixture.project().current === 1, 'next task');
  const reopened = await controllerFixture(t, true, fixture.storage);
  await reopened.action('modeProject');
  await until(() => reopened.project().current === 1, 'restored task');
  assert.equal(reopened.project().phase, 'building');
  await fixture.action('modeDebug'); await until(() => fixture.state().mode === 'debug', 'Debug restored');
  assert.deepEqual(fixture.state().messages, debugMessages);
});

test('suggested plans can clarify/refine and tasks complete only when the learner marks them done', async t => {
  const fixture = await controllerFixture(t);
  await fixture.action('modeProject'); await fixture.action('clarify', 'A small game');
  fixture.respondProject(() => ({ kind: 'question', title: '', tasks: [], message: 'Would you like to play it in a terminal or a browser?' }));
  await fixture.action('projectSuggest'); await until(() => fixture.project().phase === 'features', 'one planning question');
  fixture.respondProject(() => projectPlan());
  await fixture.action('clarify', 'In a browser, using JavaScript.');
  await until(() => fixture.project().phase === 'plan', 'suggested plan');
  await fixture.action('clarify', 'Keep it very small, with no sign-in.');
  assert.match(String(fixture.projectRequests.at(-1)!.input.features), /no sign-in/);
  await fixture.action('projectStart');
  fixture.respondProject(() => ({ message: 'Try the task check and tell me what happened.', ready: true }));
  await fixture.action('projectReview');
  await until(() => !fixture.project().working, 'advisory review');
  assert.equal(fixture.project().current, 0);
  assert.equal(fixture.project().ready, false, 'no observed successful run is not verified evidence');
  await fixture.action('projectDone'); await fixture.action('projectDone'); await fixture.action('projectDone');
  await until(() => fixture.project().phase === 'done', 'learner completion');
  assert.equal(fixture.state().celebration, 1);
  await fixture.action('projectReset'); assert.equal(fixture.project().phase, 'done', 'cancelled reset retains progress');
  fixture.confirmReset(true); await fixture.action('projectReset');
  await until(() => fixture.project().phase === 'idea', 'new idea');
});

test('keyless local providers work in both modes and endpoint/format edits invalidate pending replies', async t => {
  const fixture = await controllerFixture(t);
  fixture.configure({ provider: 'ollama', model: 'qwen3:8b', requiresKey: false, endpoint: 'http://127.0.0.1:11434/api/chat' });
  const doc = await fixture.add('main.py', '# Print 18.\nprint(18)\n');
  await fixture.select(doc); await fixture.run(doc);
  assert.equal(fixture.state().keyConfigured, true); assert.equal(fixture.requests[0].key, '');
  assert.equal((fixture.requests[0].connection as { endpoint: string }).endpoint, 'http://127.0.0.1:11434/api/chat');
  let finishDebug!: (value: unknown) => void;
  fixture.respond(() => new Promise(resolve => { finishDebug = resolve; }));
  await fixture.change(doc, '# Print 18.\nprint(18 + 0)\n'); await fixture.run(doc, true);
  await until(() => fixture.requests.length === 2, 'local pending Debug reply');
  fixture.emitConfiguration('endpoints'); assert.equal(fixture.requests[1].signal.aborted, true);
  finishDebug(reply(fixture.requests[1].input)); await flush();
  await fixture.action('modeProject'); await fixture.action('clarify', 'A local tracker'); await fixture.action('projectSuggest');
  assert.equal(fixture.projectRequests[0].key, '');
  assert.equal((fixture.projectRequests[0].connection as { endpoint: string }).endpoint, 'http://127.0.0.1:11434/api/chat');
  await fixture.action('projectStart');
  let finishProject!: (value: unknown) => void;
  fixture.respondProject(() => new Promise(resolve => { finishProject = resolve; }));
  const pending = fixture.action('projectHint');
  await until(() => fixture.projectRequests.length === 2, 'local pending project reply');
  fixture.emitConfiguration('customFormat'); assert.equal(fixture.projectRequests[1].signal.aborted, true);
  finishProject({ message: 'OLD CONNECTION REPLY', ready: false }); await pending;
  assert.ok(!fixture.project().messages.some(message => message.text.includes('OLD CONNECTION')));
});

test('cancelling a project confirms first, stops pending coaching and persists a fresh start without changing code', async t => {
  const fixture = await controllerFixture(t);
  const doc = await fixture.add('app.js', '// Show a total.\nconsole.log(18);\n');
  await fixture.select(doc); await fixture.action('modeProject'); await fixture.action('clarify', 'An expense tracker');
  await fixture.action('projectSuggest'); await fixture.action('projectStart'); await fixture.action('projectDone');
  await fixture.action('projectCancel');
  assert.equal(fixture.project().phase, 'building'); assert.equal(fixture.project().current, 1, 'dismissal retains progress');
  let finish!: (value: unknown) => void;
  fixture.respondProject(() => new Promise(resolve => { finish = resolve; }));
  const pending = fixture.action('projectReview');
  await until(() => fixture.projectRequests.length === 2, 'pending coaching');
  fixture.confirmReset(true); await fixture.action('projectCancel');
  assert.equal(fixture.projectRequests.at(-1)!.signal.aborted, true);
  finish({ message: 'OLD PROJECT RESPONSE', ready: true }); await pending;
  assert.equal(fixture.project().phase, 'idea'); assert.equal(fixture.project().plan, null);
  assert.equal(fixture.project().working, false); assert.equal(fixture.project().error, '');
  assert.ok(!fixture.project().messages.some(message => message.text.includes('OLD PROJECT')));
  assert.equal(doc.source, '// Show a total.\nconsole.log(18);\n');
  const reopened = await controllerFixture(t, true, fixture.storage);
  await reopened.action('modeProject'); await reopened.action('projectRetry');
  assert.equal(reopened.project().phase, 'idea'); assert.equal(reopened.project().plan, null);
  assert.equal(reopened.projectRequests.length, 0, 'cancelled work cannot be retried after reopening');
});

test('Project coaching sends bounded saved context and rejects dirty, protected, stale and cancelled attempts', async t => {
  const fixture = await controllerFixture(t);
  const doc = await fixture.add('main.py', '# Show entries.\nimport helper\nprint(helper.VALUE)\n');
  const helper = await fixture.add('helper.py', '# Supply an entry.\nVALUE = 1\n');
  await fixture.select(doc); await fixture.action('modeProject'); await fixture.action('clarify', 'Track a few entries');
  await fixture.action('projectSuggest'); await fixture.action('projectStart');
  fixture.respondProject(() => ({ message: 'Your sample matches this task’s check. Try another case too.', ready: true }));
  await fixture.run(doc, false, true, '1\n', 0);
  await fixture.action('projectReview');
  const input = fixture.projectRequests.at(-1)!.input;
  const code = input.code as { source: string; workspace: { relatedFiles: {path: string}[] }; run: { output: string } };
  assert.equal(code.source, doc.source); assert.ok(code.workspace.relatedFiles.some(file => file.path === 'helper.py'));
  assert.equal(code.run.output, '1\n');
  assert.equal(fixture.project().ready, true);
  await fixture.run(doc, false, true, '1\n', 0);
  assert.equal(fixture.project().ready, false, 'a new run invalidates the old review badge');
  await fixture.action('projectReview');
  assert.equal(fixture.project().ready, true);
  await fixture.change(helper, '# Supply an entry.\nVALUE = 2\n');
  assert.equal(fixture.project().ready, false, 'a source edit invalidates the old review badge');
  const before = fixture.projectRequests.length;
  doc.isDirty = true; await fixture.action('projectHint'); doc.isDirty = false;
  assert.equal(fixture.projectRequests.length, before);
  const secret = await fixture.add('credentials.py', 'token = "private"\n'); await fixture.select(secret); await fixture.action('projectHint');
  assert.equal(fixture.projectRequests.length, before);
  await fixture.select(doc);
  let finish!: (value: unknown) => void;
  fixture.respondProject(() => new Promise(resolve => { finish = resolve; }));
  const pending = fixture.action('projectReview');
  await until(() => fixture.projectRequests.length === before + 1, 'pending project review');
  await fixture.change(helper, '# Supply an entry.\nVALUE = 3\n');
  assert.equal(fixture.projectRequests.at(-1)!.signal.aborted, true);
  finish({ message: 'STALE PROJECT RESPONSE', ready: true }); await pending;
  assert.ok(!fixture.project().messages.some(message => message.text.includes('STALE')));
  assert.equal(fixture.project().current, 0);
});

test('Project mode blocks untrusted workspaces and ignores a late provider response after switching modes', async t => {
  const restricted = await controllerFixture(t, false);
  await restricted.action('modeProject'); await restricted.action('clarify', 'A tracker'); await restricted.action('projectSuggest');
  assert.equal(restricted.projectRequests.length, 0); assert.equal(restricted.storage.size, 0);
  const fixture = await controllerFixture(t);
  await fixture.action('modeProject'); await fixture.action('clarify', 'A tracker');
  let finish!: (value: unknown) => void;
  fixture.respondProject(() => new Promise(resolve => { finish = resolve; }));
  const pending = fixture.action('projectSuggest');
  await until(() => fixture.projectRequests.length === 1, 'pending plan');
  await fixture.action('modeDebug'); assert.equal(fixture.projectRequests[0].signal.aborted, true);
  finish(projectPlan()); await pending;
  await fixture.action('modeProject');
  assert.equal(fixture.project().phase, 'choice'); assert.equal(fixture.project().plan, null);
});
