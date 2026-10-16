import * as vscode from 'vscode';
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import { checkSource, RunSnapshot } from './teaching';

export class FileRunner implements vscode.Disposable {
  private terminal?: vscode.Terminal;
  private child?: ChildProcessWithoutNullStreams;
  private write = new vscode.EventEmitter<string>();
  private ready?: Promise<void>;
  private rejectReady?: (error: Error) => void;
  private active = false;
  private input = '';
  private disposed = false;

  get busy(): boolean { return this.active; }

  async run(document: vscode.TextDocument, executable: string, args: string[], cwd: string): Promise<RunSnapshot> {
    if (this.active) throw new Error('A CodeNudge run is still active. Let it finish or press Ctrl+C in its terminal.');
    if (this.disposed || !vscode.workspace.isTrusted) throw new Error('Trust this folder before running code with CodeNudge.');
    if (document.isClosed || document.isDirty || document.uri.scheme !== 'file') throw new Error('Save this file before running it with CodeNudge.');
    checkSource(document.getText(), document.fileName);
    const version = document.version;
    const source = document.getText();
    this.active = true;
    try {
      if (!this.terminal) {
        this.ready = new Promise<void>((resolve, reject) => {
          this.rejectReady = reject;
          this.terminal = vscode.window.createTerminal({ name: 'CodeNudge Run', pty: {
            onDidWrite: this.write.event,
            open: () => { this.rejectReady = undefined; resolve(); },
            close: () => { this.rejectReady?.(new Error('CodeNudge terminal closed. Click Run with CodeNudge to try again.')); this.child?.kill(); this.terminal = undefined; },
            handleInput: (text: string) => this.handleInput(text)
          } });
        });
      }
      this.terminal!.show();
      await this.ready;
      if (!this.terminal || this.disposed || !vscode.workspace.isTrusted || document.isClosed || document.isDirty || document.version !== version || document.getText() !== source) {
        throw new Error('The file or window changed while starting. Click Run with CodeNudge again when ready.');
      }
      this.input = '';
      this.write.fire(`\r\n▶ ${executable} ${vscode.workspace.asRelativePath(document.uri, false)}\r\n`);
      const snapshot: RunSnapshot = { uri: document.uri.toString(), version, source, language: document.languageId,
        command: [executable, ...args.map(arg => JSON.stringify(arg))].join(' '), startedAt: Date.now(), output: '', exitCode: null,
        reported: false, truncated: false, sourceConfirmed: true };
      return await new Promise<RunSnapshot>((resolve, reject) => {
        const child = spawn(executable, args, { cwd, shell: false, stdio: 'pipe' });
        this.child = child;
        let raw = ''; let truncated = false; let failed = false;
        const data = (text: string) => {
          raw += text;
          if (raw.length > 16_000) { raw = raw.slice(-16_000); truncated = true; }
          this.write.fire(text.replace(/\r?\n/g, '\r\n'));
        };
        child.stdout.setEncoding('utf8').on('data', data);
        child.stderr.setEncoding('utf8').on('data', data);
        child.stdin.on('error', () => {});
        child.on('error', () => {
          failed = true;
          this.write.fire(`\r\nCould not start ${executable}. Check that it is installed and available to VS Code.\r\n`);
          reject(new Error(`Could not start ${executable}. Check that it is installed and on VS Code’s PATH.`));
        });
        child.on('close', (code, signal) => {
          if (this.child === child) this.child = undefined;
          if (failed) return;
          this.write.fire(`\r\n[${signal || code === null ? 'Stopped' : `Finished · exit ${code}`}]\r\n`);
          if (signal || code === null) { reject(new Error('Run stopped. Try again when you are ready.')); return; }
          const output = stripVTControlCharacters(raw).replace(/\r\n/g, '\n').replace(/\r/g, '');
          resolve({ ...snapshot, output: output.slice(-8_000), exitCode: code, truncated: truncated || output.length > 8_000 });
        });
      });
    } finally { this.active = false; }
  }

  private handleInput(text: string): void {
    if (!this.child) return;
    for (const character of text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r\n|\n/g, '\r')) {
      if (character === '\x03') { this.child.kill('SIGINT'); this.write.fire('^C\r\n'); }
      else if (character === '\r') { this.child.stdin.write(`${this.input}\n`); this.input = ''; this.write.fire('\r\n'); }
      else if (character === '\x7f' || character === '\b') { if (this.input) { this.input = this.input.slice(0, -1); this.write.fire('\b \b'); } }
      else if (character >= ' ') { this.input += character; this.write.fire(character); }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.rejectReady?.(new Error('CodeNudge stopped.'));
    this.child?.kill(); this.terminal?.dispose(); this.write.dispose();
  }
}
