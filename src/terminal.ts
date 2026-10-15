import * as vscode from 'vscode';
import { basename } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { checkSource, RunSnapshot } from './teaching';

interface Captured {
  document: vscode.TextDocument; terminal: vscode.Terminal; run: RunSnapshot;
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

  constructor(private onRun: (run: RunSnapshot) => void, private onStatus: (message: string) => void) {
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
    if (!document || (!this.automatic && event.terminal !== this.terminal)) return;
    if (document.uri.scheme !== 'file' || ['plaintext', 'markdown', 'json', 'jsonc', 'yaml', 'toml', 'log'].includes(document.languageId)) return;
    const command = event.execution.commandLine.value.trim();
    if (/^(?:git|ls|pwd|cd|clear|echo|printf|cat|less|man|history|which|whoami)(?:\s|$)/.test(command)) return;
    if (!this.automatic && this.command && command && command !== this.command) return;
    if (document.isClosed || document.isDirty) { this.onStatus('Save your code, then run it again.'); return; }
    const source = document.getText();
    try { checkSource(source, document.fileName); } catch (error) { this.onStatus((error as Error).message); return; }
    const stream = event.execution.read();
    const generation = this.generation;
    const output = (async () => {
      let raw = ''; let truncated = false;
      for await (const chunk of stream) {
        if (generation !== this.generation) break;
        raw += chunk;
        if (raw.length > 16_000) { raw = raw.slice(-16_000); truncated = true; }
      }
      const clean = stripVTControlCharacters(raw).replace(/\r\n/g, '\n').replace(/\r/g, '');
      return { output: clean.slice(-8_000), truncated: truncated || clean.length > 8_000 };
    })().catch(() => ({ output: '', truncated: true, failed: true }));
    this.pending.set(event.execution, { document, terminal: event.terminal, generation, output,
      run: { uri: document.uri.toString(), version: document.version, language: document.languageId,
        source, command, output: '', exitCode: null, truncated: false, reported: false } });
  }

  private async end(event: vscode.TerminalShellExecutionEndEvent): Promise<void> {
    const capture = this.pending.get(event.execution);
    this.pending.delete(event.execution);
    if (!capture) return;
    const result = await capture.output;
    if (capture.generation !== this.generation) return;
    if (result.failed) { this.onStatus('Could not read this result. You can share the output from settings.'); return; }
    if (event.exitCode === undefined) { this.onStatus('This run has not reported a result I can check yet.'); return; }
    const document = capture.document;
    if (document.isClosed || document.isDirty || document.version !== capture.run.version || document.getText() !== capture.run.source) {
      this.onStatus('The code changed while it ran. Save and run the current version again.'); return;
    }
    const command = event.execution.commandLine.value.trim();
    if (!this.automatic && this.command && command && command !== this.command) return;
    const filename = basename(document.fileName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mentionsFile = new RegExp(`(?:^|[\\s/\\\\"'(])${filename}(?=$|[\\s"':)])`);
    const sourceConfirmed = mentionsFile.test(result.output) ||
      (event.execution.commandLine.confidence !== vscode.TerminalShellExecutionCommandLineConfidence.Low && mentionsFile.test(command));
    // shortcut: unnamed shell runs use the focused file as a candidate; require clarification before escalating or celebrating when no filename links them.
    if (!this.automatic && command) this.command = command;
    this.onRun({ ...capture.run, ...result, command: command || 'Terminal run (command unavailable)',
      exitCode: event.exitCode, sourceConfirmed });
  }

  dispose(): void { this.disconnect(); this.subscriptions.forEach(subscription => subscription.dispose()); }
}
