import * as vscode from 'vscode';
import { basename, dirname, extname, isAbsolute, normalize, relative, resolve, sep } from 'node:path';
import { readFile, realpath, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { checkSource, hash } from './teaching';

const execute = promisify(execFile);
const excluded = new Set(['node_modules', '.git', 'dist', 'out', 'build', 'coverage', 'vendor', 'venv', '__pycache__', 'devpost', 'agent']);
const extensions = new Set(['.py', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.cs', '.rb', '.php', '.swift', '.kt', '.html', '.css', '.scss', '.sql', '.vue', '.svelte']);
const inside = (root: string, path: string) => { const part = relative(root, path); return part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part); };

export function sourcePath(path: string): boolean {
  return extensions.has(extname(path).toLowerCase()) && !path.split(/[\\/]/).some(part =>
    part.startsWith('.') || excluded.has(part) || /^(?:secrets?|credentials?|private[_-]?keys?)(?:[._-]|$)/i.test(part));
}

export function referencedPaths(text: string, cwd?: string): string[] {
  const paths: string[] = [];
  for (const match of text.matchAll(/"([^"\r\n]+)"|'([^'\r\n]+)'|([^\s"'()]+)/g)) {
    let path = (match[1] ?? match[2] ?? match[3]).replace(/:\d+(?::\d+)?[,:]?$/, '');
    if (path.startsWith('file://')) { try { path = fileURLToPath(path); } catch { continue; } }
    if (!extensions.has(extname(path).toLowerCase())) continue;
    if (isAbsolute(path)) paths.push(normalize(path));
    else if (cwd && !path.startsWith('-')) paths.push(resolve(cwd, path));
  }
  return [...new Set(paths)];
}

export interface ProjectSnapshot {
  revision: string;
  data: { files: string[]; relatedFiles: { path: string; source: string; truncated: boolean }[]; omitted: string[]; indexTruncated: boolean };
  sources: { path: string; digest: string }[];
}

export class WorkspaceContext {
  async allowed(path: string): Promise<boolean> {
    const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(path));
    if (!folder || !sourcePath(relative(folder.uri.fsPath, path))) return false;
    try {
      const root = await realpath(folder.uri.fsPath);
      const target = await realpath(path);
      return inside(root, target) && sourcePath(relative(root, target));
    } catch { return false; }
  }

  async resolveRun(command: string, output: string, cwd?: string): Promise<vscode.Uri | undefined> {
    const frames = referencedPaths(output, cwd);
    if (/Traceback \(most recent call last\)/.test(output)) frames.reverse();
    // Keep an explicit entry file as the session owner when its helper fails or later succeeds.
    for (const path of [...referencedPaths(command, cwd), ...frames]) {
      if (await this.allowed(path)) return vscode.Uri.file(path);
    }
    return undefined;
  }

  private async inventory(folder: vscode.WorkspaceFolder): Promise<{ paths: string[]; truncated: boolean }> {
    let paths: string[];
    try {
      const result = await execute('git', ['-c', 'core.fsmonitor=false', 'ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '.'],
        { cwd: folder.uri.fsPath, timeout: 3_000, maxBuffer: 500_000 });
      paths = result.stdout.split('\0').filter(Boolean).map(path => resolve(folder.uri.fsPath, path));
    } catch {
      const uris = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, '**/*'), '**/{node_modules,.git,dist,out,build,coverage,vendor,venv,.venv,__pycache__,.agents,.claude,devpost}/**', 1001);
      paths = uris.map(uri => uri.fsPath);
    }
    paths = [...new Set(paths)].filter(path => inside(folder.uri.fsPath, path) && sourcePath(relative(folder.uri.fsPath, path))).sort();
    return { paths: paths.slice(0, 500), truncated: paths.length > 500 };
  }

  async collect(document: vscode.TextDocument, startedAt?: number, output = ''): Promise<ProjectSnapshot> {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!folder) return { revision: '', data: { files: [], relatedFiles: [], omitted: [], indexTruncated: false }, sources: [] };
    const primaryBefore = await stat(document.fileName);
    const primary = await readFile(document.fileName, 'utf8');
    const primaryAfter = await stat(document.fileName);
    if (document.isDirty || document.getText() !== primary || primaryBefore.mtimeMs !== primaryAfter.mtimeMs || primaryBefore.size !== primaryAfter.size ||
      (startedAt && primaryAfter.mtimeMs > startedAt)) throw new Error('Project code changed after this run started. Save and run it again.');
    const inventory = await this.inventory(folder);
    const label = (path: string) => relative(folder.uri.fsPath, path).split(sep).join('/');
    const imports = [...document.getText().matchAll(/(?:from\s+|import\s+(?:[^'"\n]*?from\s+)?|require\s*\()\s*['"]?([\w./-]+)/g)].map(match => match[1]);
    const score = (path: string) => (output.includes(path) || output.includes(basename(path)) ? 30 : 0) +
      (imports.some(name => name.split(/[/.]/).filter(Boolean).includes(basename(path, extname(path)))) ? 20 : 0) +
      (dirname(path) === dirname(document.fileName) ? 5 : 0) +
      (vscode.workspace.textDocuments.some(doc => doc.uri.fsPath === path) ? 2 : 0);
    const candidates = inventory.paths.filter(path => path !== document.fileName).sort((a, b) => score(b) - score(a) || a.localeCompare(b));
    const relatedFiles: ProjectSnapshot['data']['relatedFiles'] = [];
    const sources: ProjectSnapshot['sources'] = [{ path: document.fileName, digest: hash(primary) }];
    const omitted: string[] = [];
    let remaining = 30_000;
    for (const path of candidates) {
      if (relatedFiles.length >= 8 || remaining <= 0) { omitted.push(label(path)); continue; }
      if (!await this.allowed(path)) { omitted.push(label(path)); continue; }
      const open = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === path);
      if (open?.isDirty) throw new Error(`Save ${label(path)} and run again before checking the project.`);
      const before = await stat(path);
      if (before.size > 100_000) { omitted.push(label(path)); continue; }
      if (startedAt && before.mtimeMs > startedAt) throw new Error('Project code changed after this run started. Save and run it again.');
      const source = await readFile(path, 'utf8');
      const after = await stat(path);
      if (before.mtimeMs !== after.mtimeMs || before.size !== after.size || open?.isDirty || (open && open.getText() !== source)) throw new Error('Project code changed while I was reading it. Save and run again.');
      try { checkSource(source.slice(0, 12_000), path); } catch { omitted.push(label(path)); continue; }
      const excerpt = source.slice(0, Math.min(6_000, remaining)); remaining -= excerpt.length;
      relatedFiles.push({ path: label(path), source: excerpt, truncated: excerpt.length !== source.length });
      sources.push({ path, digest: hash(source) });
    }
    const data = { files: inventory.paths.map(label), relatedFiles, omitted, indexTruncated: inventory.truncated };
    return { revision: hash(JSON.stringify([data.files, sources.map(item => [label(item.path), item.digest])])), data, sources };
  }

  async current(snapshot: ProjectSnapshot): Promise<boolean> {
    for (const source of snapshot.sources) {
      const open = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === source.path);
      if (open?.isDirty || !await this.allowed(source.path)) return false;
      try {
        const disk = await readFile(source.path, 'utf8');
        if ((open && open.getText() !== disk) || hash(disk) !== source.digest) return false;
      } catch { return false; }
    }
    return true;
  }
}
