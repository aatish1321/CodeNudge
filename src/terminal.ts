import * as vscode from 'vscode';
import { stripVTControlCharacters } from 'node:util';
import { checkSource, RunSnapshot } from './teaching';

interface Captured { run: RunSnapshot; output: Promise<{ output: string; truncated: boolean; failed?: boolean }>; generation: number }

export class TerminalCapture implements vscode.Disposable {
  private document?: vscode.TextDocument;
  private terminal?: vscode.Terminal;
  private command?: string;
  private generation = 0;
  private pending = new Map<vscode.TerminalShellExecution, Captured>();
  private subscriptions: vscode.Disposable[];

  constructor(private onRun: (run: RunSnapshot) => void, private onStatus: (message: string) => void) {
    this.subscriptions = [
      vscode.window.onDidStartTerminalShellExecution(event => this.start(event)),
      vscode.window.onDidEndTerminalShellExecution(event => { void this.end(event).catch(() => this.onStatus('Could not read this run. Reconnect the terminal or share the result manually.')); }),
      vscode.window.onDidCloseTerminal(terminal => { if (terminal === this.terminal) { this.disconnect(); this.onStatus('Terminal closed. Connect another terminal to keep learning.'); } })
    ];
  }

  connect(document: vscode.TextDocument, terminal: vscode.Terminal): void {
    this.disconnect();
    this.document = document;
    this.terminal = terminal;
    this.onStatus('Connected. Your next code command sets the command to watch; save your file before running.');
  }

  disconnect(): void { this.generation++; this.document = undefined; this.terminal = undefined; this.command = undefined; this.pending.clear(); }

  private start(event: vscode.TerminalShellExecutionStartEvent): void {
    if (event.terminal !== this.terminal || !this.document) return;
    const command = event.execution.commandLine.value.trim();
    if (this.command && command && command !== this.command) return;
    if (this.document.isClosed || this.document.isDirty) { this.onStatus('Save the connected file, then run it again.'); return; }
    const source = this.document.getText();
    try { checkSource(source, this.document.fileName); } catch (error) { this.onStatus((error as Error).message); return; }
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
    this.pending.set(event.execution, { generation: this.generation, output,
      run: { uri: this.document.uri.toString(), version: this.document.version, language: this.document.languageId,
        source, command: event.execution.commandLine.value.trim(), output: '', exitCode: null, truncated: false, reported: false } });
  }

  private async end(event: vscode.TerminalShellExecutionEndEvent): Promise<void> {
    const capture = this.pending.get(event.execution);
    this.pending.delete(event.execution);
    if (!capture) return;
    const result = await capture.output;
    if (capture.generation !== this.generation || !this.document) return;
    if (result.failed) { this.onStatus('Could not read this command’s output. Share the result manually or reconnect.'); return; }
    let command = event.execution.commandLine.value.trim();
    if (event.exitCode === undefined) { this.onStatus('This command did not report a result. Share the result manually if needed.'); return; }
    if (this.command && command && command !== this.command) return;
    if (!command || (!this.command && event.execution.commandLine.confidence === vscode.TerminalShellExecutionCommandLineConfidence.Low)) {
      this.onStatus('Confirm the command in the VS Code dialog so I can check its result.');
      const confirmed = await vscode.window.showInputBox({ title: 'Coding Buddy: confirm the command you just ran',
        value: command || this.command || '', ignoreFocusOut: true,
        prompt: 'VS Code could not identify this run reliably. Enter its exact command to check the captured result. Nothing will be executed.',
        validateInput: value => !value.trim() ? 'Enter the command you just ran, or press Escape to skip.'
          : command && value.trim() !== command ? 'Confirm the detected command unchanged, or press Escape and share the result manually.' : undefined });
      if (capture.generation !== this.generation || !this.document) return;
      if (!confirmed?.trim() || (command && confirmed.trim() !== command)) { this.onStatus('Command not confirmed. Run again, or paste the output and choose Share run result.'); return; }
      command = confirmed.trim();
    }
    if (this.command && command !== this.command) return;
    if (capture.generation !== this.generation || !this.document) return;
    if (this.document.isClosed || this.document.isDirty || this.document.version !== capture.run.version || this.document.getText() !== capture.run.source) {
      this.onStatus('The code changed while it ran. Save and run the current version again.'); return;
    }
    this.command = command;
    this.onRun({ ...capture.run, ...result, command, exitCode: event.exitCode });
  }

  dispose(): void { this.disconnect(); this.subscriptions.forEach(subscription => subscription.dispose()); }
}
