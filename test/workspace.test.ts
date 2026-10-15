import { test, TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import type * as vscode from 'vscode';
import type { WorkspaceContext } from '../src/workspace';

async function workspaceFixture(t: TestContext) {
  const parent = await mkdtemp(join(tmpdir(), 'coding-buddy-workspace-'));
  const root = join(parent, 'project');
  await mkdir(root);
  t.after(() => rm(parent, { recursive: true, force: true }));
  const uri = (path: string) => ({ scheme: 'file', fsPath: resolve(path), toString: () => pathToFileURL(resolve(path)).toString() });
  const folder = { uri: uri(root), name: 'project', index: 0 };
  const documents: { uri: ReturnType<typeof uri>; fileName: string; isDirty: boolean; getText: () => string }[] = [];
  async function files(path: string): Promise<string[]> {
    const entries = await readdir(path, { withFileTypes: true });
    return (await Promise.all(entries.map(entry => entry.isDirectory()
      ? files(join(path, entry.name)) : [join(path, entry.name)]))).flat();
  }
  const workspace = {
    textDocuments: documents,
    getWorkspaceFolder: (target: { fsPath: string }) => {
      const part = relative(root, target.fsPath);
      return part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part) ? folder : undefined;
    },
    findFiles: async (_include: unknown, _exclude: unknown, maximum: number) => (await files(root)).slice(0, maximum).map(uri),
  };
  const moduleExports = {} as { WorkspaceContext: typeof WorkspaceContext };
  const filename = resolve(__dirname, '../src/workspace.js');
  const localRequire = createRequire(filename);
  runInNewContext(readFileSync(filename, 'utf8'), {
    exports: moduleExports,
    require: (name: string) => name === 'vscode'
      ? { workspace, Uri: { file: uri }, RelativePattern: class { constructor(readonly base: unknown, readonly pattern: string) {} } }
      : localRequire(name),
  });
  const context = new moduleExports.WorkspaceContext();
  async function add(name: string, source: string) {
    const path = join(root, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, source);
    return path;
  }
  function open(path: string, source: string, isDirty = false) {
    const document = { uri: uri(path), fileName: path, isDirty, getText: () => source };
    documents.push(document);
    return document;
  }
  return { root, parent, context, add, open, asDocument: (document: ReturnType<typeof open>) => document as unknown as vscode.TextDocument };
}

test('keeps the explicit Python entry file across failures and success, and resolves unnamed tracebacks to helpers', async t => {
  const fixture = await workspaceFixture(t);
  const main = await fixture.add('main.py', 'from invoice import total\nprint(total())\n');
  const helper = await fixture.add('invoice.py', 'def total():\n    return 1 / 0\n');
  fixture.open(main, 'from invoice import total\nprint(total())\n');
  const output = `Traceback (most recent call last):\n  File "${main}", line 2, in <module>\n    print(total())\n  File "${helper}", line 2, in total\n    return 1 / 0\nZeroDivisionError: division by zero`;
  assert.equal((await fixture.context.resolveRun('python3 main.py', output, fixture.root))?.fsPath, main);
  assert.equal((await fixture.context.resolveRun('python3 -m app', output, fixture.root))?.fsPath, helper);
  assert.equal((await fixture.context.resolveRun('python3 main.py', '', fixture.root))?.fsPath, main);
});

test('routes JavaScript async errors to the first workspace stack frame, including encoded file URLs', async t => {
  const fixture = await workspaceFixture(t);
  const main = await fixture.add('main.js', 'require("./services/account");\n');
  const helper = await fixture.add('services/account.js', 'throw new Error("missing account");\n');
  const output = `TypeError: missing account\n    at loadAccount (${pathToFileURL(helper)}:12:7)\n    at async main (${main}:5:3)`;
  assert.equal((await fixture.context.resolveRun('node main.js', output, fixture.root))?.fsPath, main);
  assert.equal((await fixture.context.resolveRun('npm test', output, fixture.root))?.fsPath, helper);
});

test('does not resolve outside copies, symlink escapes, dependency sources, or secret filenames', async t => {
  const fixture = await workspaceFixture(t);
  const outside = join(fixture.parent, 'project-other', 'same.py');
  await mkdir(dirname(outside));
  await writeFile(outside, 'print("outside private data")\n');
  const escaped = join(fixture.root, 'escaped.py');
  await symlink(outside, escaped);
  const secret = await fixture.add('credentials.py', 'TOKEN = "private"\n');
  const secretAlias = join(fixture.root, 'ordinary.py');
  await symlink(secret, secretAlias);
  const hidden = await fixture.add('.private/config.js', 'const token = "private";\n');
  const dependency = await fixture.add('node_modules/lib/index.js', 'throw new Error();\n');
  for (const path of [outside, escaped, secret, secretAlias, hidden, dependency]) {
    assert.equal(await fixture.context.allowed(path), false, path);
    assert.equal(await fixture.context.resolveRun(`python3 "${path}"`, '', fixture.root), undefined, path);
  }
  const main = await fixture.add('main.py', 'print("safe")\n');
  const snapshot = await fixture.context.collect(fixture.asDocument(fixture.open(main, 'print("safe")\n')));
  assert.equal(snapshot.data.relatedFiles.length, 0);
  assert.ok(!snapshot.data.files.some(path => /credentials|private|node_modules/.test(path)));
});

test('includes imported helper source and a source-file index with a stable content revision', async t => {
  const fixture = await workspaceFixture(t);
  const source = 'from invoice import invoice_total\nprint(invoice_total({}))\n';
  const main = await fixture.add('main.py', source);
  await fixture.add('invoice.py', 'def invoice_total(order):\n    return 42\n');
  await fixture.add('client.js', 'console.log("another language");\n');
  const document = fixture.asDocument(fixture.open(main, source));
  const first = await fixture.context.collect(document);
  assert.equal(first.data.relatedFiles[0].path, 'invoice.py');
  assert.match(first.data.relatedFiles[0].source, /return 42/);
  assert.ok(first.data.files.includes('main.py'));
  assert.ok(first.data.files.includes('client.js'));
  assert.equal(await fixture.context.current(first), true);
  const again = await fixture.context.collect(document);
  assert.equal(again.revision, first.revision);
});

test('bounds related source excerpts and explicitly marks truncation and omitted files', async t => {
  const fixture = await workspaceFixture(t);
  const main = await fixture.add('main.py', 'import helper\n');
  await fixture.add('helper.py', `# ${'x'.repeat(7_000)}\n`);
  for (let index = 0; index < 10; index++) await fixture.add(`extra_${index}.py`, `# ${'y'.repeat(7_000)}\n`);
  const snapshot = await fixture.context.collect(fixture.asDocument(fixture.open(main, 'import helper\n')));
  assert.equal(snapshot.data.relatedFiles[0].path, 'helper.py');
  assert.ok(snapshot.data.relatedFiles.length <= 8);
  assert.ok(snapshot.data.relatedFiles.reduce((sum, file) => sum + file.source.length, 0) <= 30_000);
  assert.ok(snapshot.data.relatedFiles.every(file => file.source.length <= 6_000 && file.truncated));
  assert.ok(snapshot.data.omitted.length > 0);
});

test('caps the source index at 500 files and reports that the folder index is incomplete', async t => {
  const fixture = await workspaceFixture(t);
  const main = await fixture.add('main.py', 'print("ready")\n');
  await Promise.all(Array.from({ length: 505 }, (_, index) => fixture.add(`source_${String(index).padStart(3, '0')}.py`, `VALUE = ${index}\n`)));
  const snapshot = await fixture.context.collect(fixture.asDocument(fixture.open(main, 'print("ready")\n')));
  assert.equal(snapshot.data.files.length, 500);
  assert.equal(snapshot.data.indexTruncated, true);
  assert.ok(snapshot.data.relatedFiles.length <= 8);
});

test('refuses dirty related files and helpers saved after the run started', async t => {
  const fixture = await workspaceFixture(t);
  const main = await fixture.add('main.py', 'import helper\n');
  const helper = await fixture.add('helper.py', 'VALUE = 1\n');
  const document = fixture.asDocument(fixture.open(main, 'import helper\n'));
  const openHelper = fixture.open(helper, 'VALUE = 2\n', true);
  await assert.rejects(fixture.context.collect(document), /Save helper.py/);
  openHelper.isDirty = false;
  const startedAt = Date.now();
  await utimes(helper, new Date(startedAt + 10_000), new Date(startedAt + 10_000));
  await assert.rejects(fixture.context.collect(document, startedAt), /changed after this run/);
});

test('invalidates related snapshots after changes, including changes beyond the transmitted excerpt', async t => {
  const fixture = await workspaceFixture(t);
  const main = await fixture.add('main.py', 'import helper\n');
  const longSource = `# ${'x'.repeat(7_000)}\nVALUE = 1\n`;
  const helper = await fixture.add('helper.py', longSource);
  const document = fixture.asDocument(fixture.open(main, 'import helper\n'));
  const snapshot = await fixture.context.collect(document);
  await writeFile(helper, longSource.replace('VALUE = 1', 'VALUE = 2'));
  assert.equal(await fixture.context.current(snapshot), false);
  const changed = await fixture.context.collect(document);
  assert.notEqual(changed.revision, snapshot.revision);
  const openHelper = fixture.open(helper, longSource.replace('VALUE = 1', 'VALUE = 2'), true);
  assert.equal(await fixture.context.current(changed), false);
  openHelper.isDirty = false;
  assert.equal(await fixture.context.current(changed), true);
  await writeFile(helper, longSource.replace('VALUE = 1', 'VALUE = 3'));
  assert.equal(await fixture.context.current(changed), false, 'a clean buffer must not conceal an external disk change');
  await assert.rejects(fixture.context.collect(document), /changed while I was reading/);
  await rm(helper);
  assert.equal(await fixture.context.current(changed), false);
});

test('Git inventory includes tracked and new source files while keeping ignored source out of context', async t => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const git = promisify(execFile);
  const fixture = await workspaceFixture(t);
  const source = 'from helper import VALUE\nprint(VALUE)\n';
  const main = await fixture.add('main.py', source);
  await fixture.add('helper.py', 'VALUE = 42\n');
  await fixture.add('new_client.js', 'console.log("untracked source");\n');
  await fixture.add('ignored.py', 'PRIVATE_SENTINEL = "not for model context"\n');
  await fixture.add('.gitignore', 'ignored.py\n');
  await git('git', ['-c', 'core.fsmonitor=false', 'init', '--quiet'], { cwd: fixture.root });
  await git('git', ['-c', 'core.fsmonitor=false', 'add', '--', '.gitignore', 'main.py', 'helper.py'], { cwd: fixture.root });
  const snapshot = await fixture.context.collect(fixture.asDocument(fixture.open(main, source)));
  assert.ok(snapshot.data.files.includes('main.py'));
  assert.ok(snapshot.data.files.includes('helper.py'));
  assert.ok(snapshot.data.files.includes('new_client.js'));
  assert.ok(!snapshot.data.files.includes('ignored.py'));
  assert.ok(!snapshot.data.relatedFiles.some(file => file.path === 'ignored.py' || file.source.includes('PRIVATE_SENTINEL')));
});

test('a clean primary buffer cannot conceal an external disk edit or a save during execution', async t => {
  const fixture = await workspaceFixture(t);
  const main = await fixture.add('main.py', 'print(1)\n');
  const document = fixture.asDocument(fixture.open(main, 'print(1)\n'));
  const snapshot = await fixture.context.collect(document);
  await writeFile(main, 'print(2)\n');
  assert.equal(await fixture.context.current(snapshot), false);
  await assert.rejects(fixture.context.collect(document), /code changed/);
  await writeFile(main, 'print(1)\n');
  const startedAt = Date.now();
  await utimes(main, new Date(startedAt + 10_000), new Date(startedAt + 10_000));
  await assert.rejects(fixture.context.collect(document, startedAt), /code changed/);
});
