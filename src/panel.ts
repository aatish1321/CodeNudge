import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';

export interface PanelState {
  provider: string; model: string; keyConfigured: boolean; file: string; status: string; working: boolean;
  retries: number; messages: { role: 'buddy' | 'learner'; text: string; category?: string }[];
}

export class BuddyPanel implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private state?: PanelState;
  constructor(private uri: vscode.Uri, private onAction: (action: string, text?: string) => Promise<void>) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.uri, 'media')] };
    const nonce = randomBytes(16).toString('hex');
    const resource = (name: string) => view.webview.asWebviewUri(vscode.Uri.joinPath(this.uri, 'media', name));
    view.webview.html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${view.webview.cspSource}; style-src ${view.webview.cspSource}; script-src 'nonce-${nonce}';">
      <link rel="stylesheet" href="${resource('panel.css')}"><title>Coding Buddy</title></head><body>
      <header><div class="eyebrow">A LITTLE HELP. A LOT OF LEARNING.</div><div class="title-row"><h1>Coding Buddy<span class="accent">.</span></h1><button data-action="settings" class="icon-button" aria-label="Open settings" title="Settings">⚙</button></div>
      <div class="hero"><img src="${resource('buddy.png')}" alt="Friendly robot coding buddy wearing a headset"><span class="hero-tag">YOUR CORNER OF THE CODE</span></div>
      <div class="provider-row"><span class="provider-dot" aria-hidden="true"></span><span id="provider"></span><button data-action="setKey" class="text-button" id="keyButton">Add key</button></div></header>
      <section class="connection" aria-label="Connected file"><div class="connection-heading"><span id="file">No file connected</span><button data-action="connect" class="text-button">Connect terminal</button></div><p id="status" role="status">Ready when you are.</p><div class="small-actions"><button data-action="disconnect" class="text-button">Disconnect</button><button data-action="reset" class="text-button">New issue</button></div></section>
      <main id="messages" aria-label="Learning conversation" aria-live="polite"></main>
      <div id="working" class="working" hidden><span class="thinking-dot"></span> Thinking it through…</div>
      <footer><label for="clarification">A little more context?</label><textarea id="clarification" maxlength="2000" rows="3" placeholder="Answer a question or explain what you expected…"></textarea><div class="composer-actions"><span class="quiet">YOU THINK. I NUDGE.</span><button id="send" data-action="clarify" class="primary">Send ↗</button></div><p class="privacy" id="model"></p></footer>
      <script nonce="${nonce}" src="${resource('panel.js')}"></script></body></html>`;
    view.webview.onDidReceiveMessage((message: unknown) => {
      if (!message || typeof message !== 'object') return;
      const { action, text } = message as { action?: unknown; text?: unknown };
      if (action === 'ready') { this.send(); return; }
      if (typeof action !== 'string' || !['settings','setKey','connect','disconnect','reset','clarify','retry'].includes(action)) return;
      if (text !== undefined && (typeof text !== 'string' || text.length > 2_000)) return;
      void this.onAction(action, text as string | undefined);
    });
    view.onDidDispose(() => { if (this.view === view) this.view = undefined; });
    this.send();
  }

  update(state: PanelState): void { this.state = state; this.send(); }
  private send(): void { if (this.state) void this.view?.webview.postMessage({ type: 'state', ...this.state }); }
}
