import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';

test('opens fresh independent playground copies in new windows without overwriting earlier learner edits', async t => {
  const extension = await mkdtemp(join(tmpdir(), 'coding-buddy-bundled-fixture-'));
  const copies: { source: string; destination: string; overwrite: boolean }[] = [];
  const opened: { command: string; folder: string; forceNewWindow: boolean }[] = [];
  t.after(async () => {
    await rm(extension, { recursive: true, force: true });
    await Promise.all(copies.map(copy => rm(dirname(copy.destination), { recursive: true, force: true })));
  });
  const examples = join(extension, 'examples');
  await mkdir(join(examples, 'nested'), { recursive: true });
  await writeFile(join(examples, 'main.py'), 'print("original example")\n');
  await writeFile(join(examples, 'nested', 'helper.js'), 'module.exports = 42;\n');
  const uri = (path: string) => ({ fsPath: path, toString: () => pathToFileURL(path).toString() });
  const filename = resolve(__dirname, '../src/playground.js');
  const localRequire = createRequire(filename);
  const exports = {} as { openPlayground(target: ReturnType<typeof uri>): Promise<void> };
  runInNewContext(readFileSync(filename, 'utf8'), { exports,
    require: (name: string) => name === 'vscode' ? {
      Uri: { file: uri, joinPath: (base: ReturnType<typeof uri>, ...parts: string[]) => uri(join(base.fsPath, ...parts)) },
      workspace: { fs: { copy: async (source: ReturnType<typeof uri>, destination: ReturnType<typeof uri>, options: { overwrite: boolean }) => {
        copies.push({ source: source.fsPath, destination: destination.fsPath, overwrite: options.overwrite });
        await cp(source.fsPath, destination.fsPath, { recursive: true, force: options.overwrite, errorOnExist: !options.overwrite });
      } } },
      commands: { executeCommand: async (command: string, folder: ReturnType<typeof uri>, options: { forceNewWindow: boolean }) => {
        opened.push({ command, folder: folder.fsPath, forceNewWindow: options.forceNewWindow });
      } },
    } : localRequire(name),
  });
  await exports.openPlayground(uri(extension));
  await writeFile(join(copies[0].destination, 'main.py'), 'print("my first attempt")\n');
  await exports.openPlayground(uri(extension));
  assert.equal(copies.length, 2);
  assert.notEqual(copies[0].destination, copies[1].destination);
  assert.ok(copies.every(copy => copy.source === examples && copy.overwrite === false));
  assert.equal(await readFile(join(copies[0].destination, 'main.py'), 'utf8'), 'print("my first attempt")\n');
  assert.equal(await readFile(join(copies[1].destination, 'main.py'), 'utf8'), 'print("original example")\n');
  assert.equal(await readFile(join(examples, 'main.py'), 'utf8'), 'print("original example")\n');
  assert.equal(await readFile(join(copies[1].destination, 'nested', 'helper.js'), 'utf8'), 'module.exports = 42;\n');
  assert.equal(opened.length, 2);
  for (let index = 0; index < 2; index++) {
    assert.equal(opened[index].command, 'vscode.openFolder');
    assert.equal(opened[index].folder, copies[index].destination);
    assert.equal(opened[index].forceNewWindow, true);
  }
});
