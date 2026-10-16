import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';

export interface PanelState {
  trusted: boolean;
  provider: string; model: string; keyConfigured: boolean; file: string; status: string; working: boolean;
  retries: number; hasIssue: boolean; messages: { role: 'buddy' | 'learner'; text: string; category?: string }[];
  proposalId: string;
  confetti: boolean; celebration: number;
}

export class BuddyPanel implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private state?: PanelState;
  constructor(private uri: vscode.Uri, private onAction: (action: string, text?: string, proposalId?: string) => Promise<unknown>) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.uri, 'media')] };
    const nonce = randomBytes(16).toString('hex');
    const resource = (name: string) => view.webview.asWebviewUri(vscode.Uri.joinPath(this.uri, 'media', name));
    view.webview.html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${view.webview.cspSource}; style-src ${view.webview.cspSource}; script-src 'nonce-${nonce}';">
      <link rel="stylesheet" href="${resource('panel.css')}"><title>Coding Buddy</title></head><body>
      <header class="topbar"><div class="brand"><span class="wordmark"><span class="brand-dot" aria-hidden="true"></span>coding buddy<span class="brand-spark" aria-hidden="true">✦</span></span><span class="brand-caption">Your corner of the code.</span></div><button data-action="settings" class="icon-button" aria-label="Buddy settings" title="Buddy settings"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h5l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3z"/><circle cx="11.5" cy="12" r="3"/></svg></button></header>
      <div id="conversation" class="conversation"><section class="buddy-intro"><div class="buddy-scene"><span class="orbit" aria-hidden="true"></span><span class="scene-code" aria-hidden="true">{ }</span><span class="scene-spark" aria-hidden="true">✦</span><img class="mascot" src="${resource('buddy.png')}" alt="Your friendly robot coding buddy"><span id="buddyMood" class="mood">Ready when you are</span></div><p id="eyebrow" class="eyebrow">SMALL CLUES. BIG DISCOVERIES.</p><h1 id="greeting">You’ve got this.</h1><p id="status" role="status">Run your code. I’m right here if you get stuck.</p><p id="trustPrompt" hidden><button data-action="trust" class="primary">Trust this folder…</button></p><span id="file" class="file-label"></span><p id="setup" hidden>Add your AI key in <button data-action="settings" class="text-button">settings</button> to get started.</p></section>
      <section id="learningTrail" class="learning-trail" aria-label="Current help stage" hidden><span id="stageClue" class="trail-step"><span aria-hidden="true">01</span>Clue</span><span id="stageInline" class="trail-step"><span aria-hidden="true">02</span>Look closer</span><span id="stageFix" class="trail-step"><span aria-hidden="true">03</span>Review</span></section><main id="messages" aria-label="Learning conversation" aria-live="polite"></main>
      <section id="fixActions" class="fix-actions" aria-label="Review proposed change" hidden><p>A little help over the finish line?</p><div><button data-action="acceptFix" class="primary">Accept fix</button><button data-action="rejectFix" class="text-button">Keep my code</button></div></section>
      <div id="working" class="working" role="status" hidden><span class="thinking-dot"></span> Hmm, let’s think about this…</div><div id="progress" class="progress"></div></div>
      <footer><div class="composer-heading"><span>Your thinking space</span><span class="composer-spark" aria-hidden="true">↗</span></div><div class="composer"><label for="clarification" class="sr-only">Reply to your buddy</label><textarea id="clarification" maxlength="2000" rows="2" placeholder="What are you thinking?"></textarea><button id="send" data-action="clarify" class="send-button" aria-label="Send reply" title="Send reply (Ctrl+Enter)">↑</button></div><p class="footer-note"><span aria-hidden="true">✦</span> You do the discovering. I’ll bring the nudges.</p></footer><div id="celebration" class="confetti" aria-hidden="true"></div>
      <script nonce="${nonce}" src="${resource('panel.js')}"></script></body></html>`;
    view.webview.onDidReceiveMessage((message: unknown) => {
      if (!message || typeof message !== 'object') return;
      const { action, text, proposalId } = message as { action?: unknown; text?: unknown; proposalId?: unknown };
      if (action === 'ready') { this.send(); void this.onAction('ready'); return; }
      if (typeof action !== 'string' || !['trust','settings','clarify','acceptFix','rejectFix'].includes(action)) return;
      if (text !== undefined && (typeof text !== 'string' || text.length > 2_000)) return;
      if (proposalId !== undefined && (typeof proposalId !== 'string' || proposalId.length > 64)) return;
      void this.onAction(action, text as string | undefined, proposalId as string | undefined);
    });
    view.onDidDispose(() => { if (this.view === view) this.view = undefined; });
    this.send();
  }

  update(state: PanelState): void { this.state = state; this.send(); }
  private send(): void { if (this.state) void this.view?.webview.postMessage({ type: 'state', ...this.state }); }
}
