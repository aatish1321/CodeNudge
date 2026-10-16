import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { RunSnapshot, TeachingReply } from './teaching';

export class EditorGuidance implements vscode.Disposable {
  private decoration = vscode.window.createTextEditorDecorationType({ after: { color: new vscode.ThemeColor('editorInfo.foreground'), margin: '0 0 0 1.5em', fontStyle: 'italic' } });
  private hint?: { uri: string; line: number; text: string; version: number };
  private documents = new Map<string, string>();
  private proposal?: { id: string; run: RunSnapshot; replacement: string };
  private subscriptions: vscode.Disposable[];

  constructor(private changed: () => void) {
    this.subscriptions = [
      vscode.workspace.registerTextDocumentContentProvider('coding-buddy', { provideTextDocumentContent: uri => this.documents.get(uri.toString()) ?? '' }),
      vscode.window.onDidChangeVisibleTextEditors(() => this.renderHint()),
      vscode.workspace.onDidChangeTextDocument(event => {
        if (!event.contentChanges.length) return;
        const uri = event.document.uri.toString();
        if (uri === this.hint?.uri || uri === this.proposal?.run.uri) this.clear();
      })
    ];
  }

  get proposalId(): string { return this.proposal?.id ?? ''; }

  showHint(run: RunSnapshot, reply: Pick<TeachingReply, 'line' | 'inlineHint'>): void {
    if (reply.line === null || !reply.inlineHint) return;
    this.hint = { uri: run.uri, version: run.version, line: reply.line - 1, text: reply.inlineHint };
    this.renderHint();
  }

  private renderHint(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      const hint = this.hint;
      const matches = hint && editor.document.uri.toString() === hint.uri && editor.document.version === hint.version && hint.line < editor.document.lineCount;
      editor.setDecorations(this.decoration, matches ? [{ range: editor.document.lineAt(hint.line).range,
        hoverMessage: new vscode.MarkdownString().appendText(hint.text), renderOptions: { after: { contentText: `<------- ${hint.text}` } } }] : []);
    }
  }

  async showProposal(run: RunSnapshot, reply: TeachingReply): Promise<void> {
    if (!reply.replacement) return;
    this.clearProposal();
    const id = randomUUID();
    const original = vscode.Uri.from({ scheme: 'coding-buddy', path: `/${id}/original/${basename(vscode.Uri.parse(run.uri).path)}` });
    const proposed = vscode.Uri.from({ scheme: 'coding-buddy', path: `/${id}/proposed/${basename(vscode.Uri.parse(run.uri).path)}` });
    this.documents.set(original.toString(), run.source);
    this.documents.set(proposed.toString(), reply.replacement);
    this.proposal = { id, run, replacement: reply.replacement };
    this.changed();
    await vscode.commands.executeCommand('vscode.diff', original, proposed, 'Your code ↔ CodeNudge suggestion', { preview: true });
  }

  async accept(id: string): Promise<void> {
    const proposal = this.proposal;
    if (!proposal || proposal.id !== id) throw new Error('This suggestion is no longer current. Review a fresh suggestion first.');
    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(proposal.run.uri));
    if (this.proposal !== proposal || document.version !== proposal.run.version || document.isDirty || document.getText() !== proposal.run.source) {
      this.clearProposal(); throw new Error('Your code changed since this suggestion. Run it again for a fresh review.');
    }
    const editor = await vscode.window.showTextDocument(document);
    if (this.proposal !== proposal || document.version !== proposal.run.version || document.getText() !== proposal.run.source) {
      this.clearProposal(); throw new Error('Your code changed. Review a fresh suggestion first.');
    }
    const applied = await editor.edit(edit => edit.replace(new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), proposal.replacement), { undoStopBefore: true, undoStopAfter: true });
    this.clear();
    if (!applied) throw new Error('VS Code could not apply the suggestion. Your code has been preserved.');
  }

  reject(id: string): void {
    if (!this.proposal || this.proposal.id !== id) throw new Error('This suggestion is no longer current.');
    this.clearProposal();
  }

  private clearProposal(): void { this.proposal = undefined; this.documents.clear(); this.changed(); }
  clear(): void { this.hint = undefined; this.renderHint(); this.clearProposal(); }
  dispose(): void { this.decoration.dispose(); this.subscriptions.forEach(item => item.dispose()); this.documents.clear(); }
}
