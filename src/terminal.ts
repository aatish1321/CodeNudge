import * as vscode from 'vscode';
import { basename, isAbsolute, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpath, stat } from 'node:fs/promises';
import { platform } from 'node:os';
import { referencedPaths } from './workspace';
import { stripVTControlCharacters } from 'node:util';
import { checkSource, RunSnapshot } from './teaching';

interface Captured {
  document?: vscode.TextDocument; terminal: vscode.Terminal; run?: RunSnapshot; cwd?: string; startedAt: number;
  command: string; confidence: vscode.TerminalShellExecutionCommandLineConfidence;
  snapshots: Map<string, { source: string; version: number }>;
  output: Promise<{ output: string; truncated: boolean; failed?: boolean }>; generation: number;
}

export class TerminalCapture implements vscode.Disposable {
  private document?: vscode.TextDocument;
  private terminal?: vscode.Terminal;
  private command?: string;
  private automatic = true;
  private generation = 0;
  private pending = new Map<vscode.TerminalShellExecution, Captured>();
  private subscriptions: vscode.Disposable[];

  constructor(private onRun: (run: RunSnapshot) => void, private onStatus: (message: string, clear?: boolean) => void,
    private resolveSource?: (command: string, output: string, cwd?: string) => Promise<vscode.Uri | undefined>) {
    this.subscriptions = [
      vscode.window.onDidStartTerminalShellExecution(event => this.start(event)),
      vscode.window.onDidEndTerminalShellExecution(event => { void this.end(event).catch(() => this.onStatus('Could not read this run. You can share its output from settings.')); }),
      vscode.window.onDidCloseTerminal(terminal => {
        for (const [execution, capture] of this.pending) if (capture.terminal === terminal) this.pending.delete(execution);
        if (terminal === this.terminal) { this.disconnect(); this.onStatus('Terminal closed. Resume automatic hints from settings when you are ready.'); }
      })
    ];
  }

  connect(document: vscode.TextDocument, terminal: vscode.Terminal): void {
    this.disconnect(); this.document = document; this.terminal = terminal;
    this.onStatus('Watching this file and terminal. Save your changes and run your code.');
  }

  watch(): void { this.disconnect(); this.automatic = true; }
  disconnect(): void { this.generation++; this.automatic = false; this.document = undefined; this.terminal = undefined; this.command = undefined; this.pending.clear(); }

  private start(event: vscode.TerminalShellExecutionStartEvent): void {
    const document = this.automatic ? vscode.window.activeTextEditor?.document : this.document;
    if ((!document && !this.resolveSource) || (!this.automatic && event.terminal !== this.terminal)) return;
    if (!this.resolveSource && document && (document.uri.scheme !== 'file' || ['plaintext', 'markdown', 'json', 'jsonc', 'yaml', 'toml', 'log'].includes(document.languageId))) return;
    const command = event.execution.commandLine.value.trim();
    if (/^(?:git|ls|pwd|cd|clear|echo|printf|cat|less|man|history|which|whoami)(?:\s|$)/.test(command)) return;
    if (!this.automatic && this.command && command && command !== this.command) return;
    if (!this.resolveSource && document && (document.isClosed || document.isDirty)) { this.onStatus('Save your code, then run it again.'); return; }
    const source = document?.getText() ?? '';
    if (!this.resolveSource && document) { try { checkSource(source, document.fileName); } catch (error) { this.onStatus((error as Error).message); return; } }
    const stream = event.execution.read();
    const startedAt = Date.now();
    const snapshots = new Map<string, { source: string; version: number }>();
    if (this.resolveSource) for (const doc of vscode.workspace.textDocuments) {
      if (doc.uri.scheme === 'file' && !doc.isDirty && doc.getText().length <= 12_000) snapshots.set(doc.uri.toString(), { source: doc.getText(), version: doc.version });
    }
    const generation = this.generation;
    const output = (async () => {
      let raw = ''; let truncated = false;
      for await (const chunk of stream) {
        if (generation !== this.generation) break;
        raw += chunk;
        if (raw.length > 16_000) { raw = raw.slice(-16_000); truncated = true; }
      }
      const start = /\x1b\](?:133|633);C(?:;[^\x07\x1b]*)?(?:\x07|\x1b\\)/.exec(raw);
      if (start) {
        raw = raw.slice(start.index + start[0].length);
        const end = raw.search(/\x1b\](?:133|633);(?:D(?:;[^\x07\x1b]*)?|A)(?:\x07|\x1b\\)/);
        if (end >= 0) raw = raw.slice(0, end);
      }
      const clean = stripVTControlCharacters(raw).replace(/\r\n/g, '\n').replace(/\r/g, '');
      return { output: clean.slice(-8_000), truncated: truncated || clean.length > 8_000 };
    })().catch(() => ({ output: '', truncated: true, failed: true }));
    const capture: Captured = { document, snapshots, startedAt, command, confidence: event.execution.commandLine.confidence, terminal: event.terminal, cwd: event.execution.cwd?.fsPath ?? event.shellIntegration.cwd?.fsPath, generation, output,
      run: document ? { uri: document.uri.toString(), version: document.version, language: document.languageId,
        source, command, output: '', exitCode: null, truncated: false, reported: false, startedAt } : undefined };
    this.pending.set(event.execution, capture);
    // shortcut: missing shell cwd is recoverable through /proc on local Linux; other hosts need shell metadata or Run with Buddy.
    if (!capture.cwd && !/[;&|<>`\n]|\$\(/.test(command) && platform() === 'linux' && !vscode.env?.remoteName) void (async () => {
      try {
        const pid = await event.terminal.processId;
        if (!pid) return;
        const cwd = await realpath(`/proc/${pid}/cwd`);
        if (this.pending.get(event.execution) === capture) capture.cwd = cwd;
      } catch {}
    })();
  }

  private async end(event: vscode.TerminalShellExecutionEndEvent): Promise<void> {
    const capture = this.pending.get(event.execution);
    this.pending.delete(event.execution);
    if (!capture) return;
    const result = await capture.output;
    if (capture.generation !== this.generation) return;
    if (result.failed) { this.onStatus('Could not read this result. You can share the output from settings.'); return; }
    if (event.exitCode === undefined) { this.onStatus('This run has not reported a result I can check yet.'); return; }
    // Some shells clear command metadata at completion; retain the value observed at start.
    const completedCommand = event.execution.commandLine.value.trim();
    const command = completedCommand || capture.command;
    const confidence = completedCommand ? event.execution.commandLine.confidence : capture.confidence;
    let document = capture.document;
    let run = capture.run;
    if (this.resolveSource && this.automatic) {
      const target = await this.resolveSource(command, result.output, capture.cwd);
      if (target) {
        document = await vscode.workspace.openTextDocument(target);
        const original = capture.snapshots.get(target.toString());
        if (!original && (await stat(document.fileName)).mtimeMs > capture.startedAt) {
          this.onStatus('Project code changed after the run started. Save and run it again.'); return;
        }
        run = { uri: target.toString(), source: original?.source ?? document.getText(), version: original?.version ?? document.version,
          language: document.languageId, command, output: '', exitCode: null, truncated: false, reported: false, startedAt: capture.startedAt };
      } else if (referencedPaths(command, capture.cwd).length || referencedPaths(result.output, capture.cwd).length) {
        this.onStatus('That run refers to a file outside this opened folder. Open its project folder to get help.', true); return;
      }
      if (!target) { this.onStatus('I couldn’t identify that run. Use Run with Buddy, or share its result from settings.'); return; }
      if (!document || !run || document.uri.scheme !== 'file') return;
      if (document.isDirty || document.isClosed || document.version !== run.version || document.getText() !== run.source) {
        this.onStatus('Project code changed while it ran. Save and run again.'); return;
      }
      checkSource(run.source, document.fileName);
      if (capture.generation !== this.generation) return;
      this.onRun({ ...run, ...result, command: command || 'Terminal run (command unavailable)', exitCode: event.exitCode, sourceConfirmed: !!target });
      return;
    }
    if (!document || !run) return;
    if (document.isClosed || document.isDirty || document.version !== run.version || document.getText() !== run.source) {
      this.onStatus('The code changed while it ran. Save and run the current version again.'); return;
    }
    if (!this.automatic && this.command && command && command !== this.command) return;
    const references = (text: string): string[] => {
      const paths: string[] = [];
      for (const match of text.matchAll(/"([^"\r\n]+)"|'([^'\r\n]+)'|([^\s"'()]+)/g)) {
        let path = (match[1] ?? match[2] ?? match[3]).replace(/:\d+(?::\d+)?[,:]?$/, '');
        if (path.startsWith('file://')) { try { path = fileURLToPath(path); } catch { continue; } }
        if (basename(path) !== basename(document.fileName)) continue;
        if (isAbsolute(path)) paths.push(normalize(path));
        else if (capture.cwd) paths.push(resolve(capture.cwd, path));
      }
      return paths;
    };
    const paths = [...references(result.output), ...(confidence !== vscode.TerminalShellExecutionCommandLineConfidence.Low ? references(command) : [])];
    const sourceConfirmed = paths.includes(normalize(document.fileName));
    if (paths.length && !sourceConfirmed) {
      this.onStatus('That command ran another copy of this file. Run the file open in your editor.', true); return;
    }
    if (!sourceConfirmed) { this.onStatus('I couldn’t identify that run. Use Run with Buddy, or share its result from settings.'); return; }
    if (!this.automatic && command) this.command = command;
    this.onRun({ ...run, ...result, command: command || 'Terminal run (command unavailable)',
      exitCode: event.exitCode, sourceConfirmed });
  }

  dispose(): void { this.disconnect(); this.subscriptions.forEach(subscription => subscription.dispose()); }
}
