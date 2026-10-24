import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import type { ProjectView } from './project';

export interface PanelState {
  mode: 'debug' | 'project'; project?: ProjectView;
  trusted: boolean;
  provider: string; model: string; keyConfigured: boolean; file: string; status: string; working: boolean;
  retries: number; hasIssue: boolean; messages: { role: 'buddy' | 'learner'; text: string; category?: string }[];
  proposalId: string;
  confetti: boolean; animateCharacter: boolean; celebration: number;
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
      <link rel="stylesheet" href="${resource('panel.css')}"><title>CodeNudge</title></head><body>
      <header class="topbar"><span class="wordmark"><span class="brand-mark" aria-hidden="true">↳</span>CodeNudge</span><button data-action="settings" class="icon-button" aria-label="CodeNudge settings" title="CodeNudge settings"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M18.84,9.17 21.29,10.02 21.29,13.98 18.84,14.83 19.97,17.17 17.17,19.97 14.83,18.84 13.98,21.29 10.02,21.29 9.17,18.84 6.83,19.97 4.03,17.17 5.16,14.83 2.71,13.98 2.71,10.02 5.16,9.17 4.03,6.83 6.83,4.03 9.17,5.16 10.02,2.71 13.98,2.71 14.83,5.16 17.17,4.03 19.97,6.83 18.84,9.17Z"/><circle cx="12" cy="12" r="3.2"/></svg></button></header>
      <nav class="mode-tabs" aria-label="CodeNudge mode"><button id="modeDebug" data-action="modeDebug" aria-pressed="true"><span class="mode-icon" aria-hidden="true">&lt;/&gt;</span>Debug</button><button id="modeProject" data-action="modeProject" aria-pressed="false"><span class="mode-icon" aria-hidden="true">[+]</span>Project</button></nav>
      <div id="conversation" class="conversation"><div id="file" class="file-label"></div>
      <section class="buddy-intro" aria-label="CodeNudge status"><div class="buddy-hud"><span>YOUR SIDEKICK</span><span class="signal" aria-hidden="true"><i></i><i></i><i></i></span></div><div class="buddy-scene"><span class="orbit" aria-hidden="true"></span><span class="scene-code" aria-hidden="true">{ }</span><span class="scene-spark" aria-hidden="true">✦</span><img class="mascot" src="${resource('buddy.png')}" alt="CodeNudge robot"><span class="thinking-bubble" aria-hidden="true"><i></i><i></i><i></i></span><span class="mood">Right here with you</span></div><div class="buddy-copy"><h1 id="buddyMood">You’ve got this.</h1><p id="status" role="status">Run your code. I’m here if you get stuck.</p></div><p id="trustPrompt" hidden><button data-action="trust" class="primary">Trust this folder…</button></p><p id="setup" hidden>Choose your AI provider in <button data-action="settings" class="text-button">settings</button> to start.</p></section>
      <div id="learningSummary" class="learning-summary" hidden><section id="learningTrail" class="learning-trail" aria-label="Current help stage" hidden><span id="stageClue" class="trail-step"><span aria-hidden="true">01</span>Clue</span><span id="stageInline" class="trail-step"><span aria-hidden="true">02</span>Inline</span><span id="stageFix" class="trail-step"><span aria-hidden="true">03</span>Review</span></section><div class="effort-meter" aria-hidden="true"><span id="effortPip1"></span><span id="effortPip2"></span><span id="effortPip3"></span></div><p id="progress" class="progress" role="status"></p></div>
      <main id="messages" aria-label="Learning conversation" aria-live="polite"></main>
      <section id="project" class="project-card" aria-label="Your project" hidden></section>
      <section id="fixActions" class="fix-actions" aria-label="Review proposed change" hidden><p>Review the change in your editor.</p><div><button data-action="acceptFix" class="primary">Accept fix</button><button data-action="rejectFix" class="secondary">Keep my code</button></div></section>
      <div id="working" class="working" role="status" hidden><span class="thinking-dot" aria-hidden="true"></span>Thinking…</div></div>
      <footer><div class="composer-heading"><label for="clarification">Your move</label><span class="key-hint" aria-hidden="true">Ctrl / ⌘ ↵</span></div><div class="composer"><textarea id="clarification" maxlength="2000" rows="2" placeholder="A question, or what you’ve tried…"></textarea><button id="send" data-action="clarify" class="send-button" aria-label="Send reply" title="Send reply (Ctrl or Cmd+Enter)">↑</button></div></footer><div id="celebration" class="confetti" aria-hidden="true"></div>
      <script nonce="${nonce}" src="${resource('panel.js')}"></script></body></html>`;
    view.webview.onDidReceiveMessage((message: unknown) => {
      if (!message || typeof message !== 'object') return;
      const { action, text, proposalId } = message as { action?: unknown; text?: unknown; proposalId?: unknown };
      if (action === 'ready') { this.send(); void this.onAction('ready'); return; }
      if (typeof action !== 'string' || !['trust','settings','clarify','acceptFix','rejectFix','modeDebug','modeProject','projectFeatures','projectSuggest','projectStart','projectHint','projectReview','projectDone','projectReset','projectCancel','projectRetry'].includes(action)) return;
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
