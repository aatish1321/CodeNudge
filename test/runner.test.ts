import { test, TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import type * as vscode from 'vscode';
import type { FileRunner } from '../src/runner';

async function fixture(t: TestContext, deferredOpen = false) {
  const root = await mkdtemp(join(tmpdir(), 'buddy-runner-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const terminals: { show(): void; dispose(): void; pty: vscode.Pseudoterminal }[] = [];
  let screen = '';
  const workspace = { isTrusted: true, asRelativePath: (uri: {fsPath: string}) => basename(uri.fsPath) };
  const vscode = { workspace, EventEmitter: class {
    private listeners: ((text: string) => void)[] = [];
    event = (listener: (text: string) => void) => { this.listeners.push(listener); return { dispose() {} }; };
    fire(text: string) { for (const listener of this.listeners) listener(text); }
    dispose() { this.listeners = []; }
  }, window: { createTerminal: ({ pty }: {pty: vscode.Pseudoterminal}) => {
    const terminal = { pty, show() {}, dispose() { pty.close(); } };
    terminals.push(terminal); pty.onDidWrite(text => { screen += text; });
    if (!deferredOpen) queueMicrotask(() => pty.open(undefined));
    return terminal;
  } } };
  const filename = resolve(__dirname, '../src/runner.js');
  const localRequire = createRequire(filename);
  const moduleExports = {} as { FileRunner: typeof FileRunner };
  runInNewContext(readFileSync(filename, 'utf8'), { exports: moduleExports,
    require: (name: string) => name === 'vscode' ? vscode : localRequire(name) });
  const runner = new moduleExports.FileRunner();
  t.after(() => runner.dispose());
  async function file(source: string, name = 'program.js') {
    const path = join(root, name); await writeFile(path, source);
    return { uri: { scheme: 'file', fsPath: path, toString: () => pathToFileURL(path).toString() }, fileName: path,
      version: 1, languageId: 'javascript', isClosed: false, isDirty: false, getText: () => source } as vscode.TextDocument;
  }
  const run = (doc: vscode.TextDocument, executable = process.execPath) => runner.run(doc, executable, [doc.fileName], root);
  const waitFor = async (text: string) => {
    const deadline = Date.now() + 5_000;
    while (!screen.includes(text)) {
      if (Date.now() > deadline) throw new Error(`Missing terminal output: ${text}`);
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  };
  return { root, runner, workspace, terminals, file, run, waitFor };
}

test('direct runs capture only program output, preserve exact source and reuse their terminal with literal filenames', async t => {
  const f = await fixture(t);
  const doc = await f.file("console.log('18'); console.error('a warning');", 'plain $(touch unwanted).js');
  const first = await f.run(doc);
  assert.equal(first.uri, doc.uri.toString()); assert.equal(first.source, doc.getText());
  assert.equal(first.version, doc.version); assert.equal(first.sourceConfirmed, true); assert.equal(first.reported, false);
  assert.equal(first.exitCode, 0); assert.equal(first.truncated, false);
  assert.match(first.output, /18\na warning\n|a warning\n18\n/);
  assert.doesNotMatch(first.output, /▶|Finished|program\.js/);
  assert.equal(existsSync(join(f.root, 'unwanted')), false);
  const stable = await f.file("console.log('21');", 'second.js');
  assert.equal((await f.run(stable)).output, '21\n');
  assert.equal((await f.run(stable)).output, '21\n');
  assert.equal(f.terminals.length, 1);
});

test('direct runs bound output and recover from missing runtimes without shell fallback', async t => {
  const f = await fixture(t);
  const doc = await f.file("process.stdout.write('\u001b[31m' + 'x'.repeat(20000) + '\u001b[0m'); process.exitCode = 2;");
  const result = await f.run(doc);
  assert.equal(result.output, 'x'.repeat(8000)); assert.equal(result.truncated, true); assert.equal(result.exitCode, 2);
  await assert.rejects(f.run(doc, join(f.root, 'missing-runtime')), /Could not start/);
  assert.equal(f.runner.busy, false);
  const next = await f.file("console.log('ready');", 'next.js');
  assert.equal((await f.run(next)).output, 'ready\n');
});

test('direct runs refuse busy interruption, support basic line input and stop on Ctrl+C', async t => {
  const f = await fixture(t);
  const doc = await f.file("console.log('waiting'); process.stdin.once('data', text => { console.log('heard:' + text.toString().trim()); process.exit(0); });");
  const pending = f.run(doc);
  await f.waitFor('waiting\r\n');
  await assert.rejects(f.run(doc), /still active/);
  f.terminals[0].pty.handleInput!('Adx\x7fa\r');
  assert.match((await pending).output, /heard:Ada/);
  const loop = await f.file("console.log('running loop'); setInterval(() => {}, 1000);", 'loop.js');
  const stopped = assert.rejects(f.run(loop), /Run stopped/);
  await f.waitFor('running loop\r\n');
  f.terminals[0].pty.handleInput!('\x03');
  await stopped; assert.equal(f.runner.busy, false);
});

test('trust, dirty files and changes during terminal startup block execution', async t => {
  const f = await fixture(t, true);
  const doc = await f.file("require('node:fs').writeFileSync('started', 'yes');");
  f.workspace.isTrusted = false;
  await assert.rejects(f.run(doc), /Trust this folder/);
  f.workspace.isTrusted = true;
  Object.assign(doc, { isDirty: true });
  await assert.rejects(f.run(doc), /Save this file/);
  Object.assign(doc, { isDirty: false });
  const pending = assert.rejects(f.run(doc), /changed while starting/);
  Object.assign(doc, { version: 2 }); f.terminals[0].pty.open(undefined);
  await pending; assert.equal(existsSync(join(f.root, 'started')), false);
  assert.equal(f.runner.busy, false);
});

test('closing the Buddy terminal stops its own process and a later run opens a fresh terminal', async t => {
  const f = await fixture(t);
  const doc = await f.file("console.log('alive'); setInterval(() => {}, 1000);");
  const stopped = assert.rejects(f.run(doc), /Run stopped/);
  await f.waitFor('alive\r\n'); f.terminals[0].dispose(); await stopped;
  const next = await f.file("console.log('new run');", 'next.js');
  assert.equal((await f.run(next)).output, 'new run\n'); assert.equal(f.terminals.length, 2);
});
